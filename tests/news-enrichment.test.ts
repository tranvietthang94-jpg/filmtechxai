import assert from "node:assert/strict";
import test from "node:test";
import { runEnrichmentBatch } from "../src/lib/news/enrichment";
import type { ClusterSummarizer, GeneratedSummary } from "../src/lib/news/summarizer";
import type {
  DbClusterDetail,
  DbJob,
  NewsRepository,
  SummaryUpsert,
} from "../src/lib/news/repository";

const now = new Date("2026-07-15T10:00:00.000Z");
const job: DbJob = {
  id: "job-1",
  kind: "enrich_cluster",
  status: "running",
  source_id: null,
  raw_item_id: null,
  cluster_id: "cluster-1",
  dedupe_key: "enrich:cluster-1:1",
  payload: {},
  priority: 0,
  run_after: now.toISOString(),
  locked_at: now.toISOString(),
  locked_by: "test-worker",
  attempts: 1,
  max_attempts: 3,
  last_error: null,
};

const cluster: DbClusterDetail = {
  id: "cluster-1",
  primary_raw_item_id: null,
  primary_type: "press",
  canonical_title: "News title",
  title_vi: null,
  topic_tags: ["ai"],
  status: "ready",
  source_count: 1,
  heat_score: 10,
  is_rising: false,
  first_seen_at: now.toISOString(),
  last_seen_at: now.toISOString(),
  published_at: now.toISOString(),
  cluster_sources: [],
  summaries: [],
};

const generated: GeneratedSummary = {
  titleVi: "Tiêu đề tiếng Việt",
  shortSummary: "Tóm tắt ngắn.",
  detailSummary: "Tóm tắt chi tiết.",
  bullets: ["Ý một.", "Ý hai."],
  model: "test-model",
  promptVersion: "test-v1",
};

test("persists two summaries and completes a claimed enrichment job", async () => {
  const writes: SummaryUpsert[] = [];
  let completed: string | undefined;
  let updatedTitle: string | undefined;
  const repository = {
    claimJobs: async () => [job],
    getClusterDetail: async () => cluster,
    upsertSummary: async (input: SummaryUpsert) => {
      writes.push(input);
      return {};
    },
    updateCluster: async (_id: string, input: { title_vi?: string }) => {
      updatedTitle = input.title_vi;
      return cluster;
    },
    completeJob: async (jobId: string) => {
      completed = jobId;
    },
  } as unknown as NewsRepository;
  const summarizer: ClusterSummarizer = { summarize: async () => generated };

  const result = await runEnrichmentBatch(repository, summarizer, {
    workerId: "test-worker",
    limit: 10,
    now: () => now,
  });

  assert.deepEqual(result, { claimed: 1, completed: 1, deferred: 0, failed: 0 });
  assert.deepEqual(writes.map(write => write.kind), ["short", "detail"]);
  assert.equal(updatedTitle, generated.titleVi);
  assert.equal(completed, job.id);
});

test("requeues a failed enrichment job with bounded backoff", async () => {
  let released:
    | { status: "queued" | "failed"; runAfter?: string; error: string }
    | undefined;
  const repository = {
    claimJobs: async () => [job],
    getClusterDetail: async () => cluster,
    releaseJob: async (
      _job: DbJob,
      _workerId: string,
      input: { status: "queued" | "failed"; runAfter?: string; error: string }
    ) => {
      released = input;
    },
  } as unknown as NewsRepository;
  const summarizer: ClusterSummarizer = {
    summarize: async () => {
      throw new Error("provider timeout");
    },
  };

  const result = await runEnrichmentBatch(repository, summarizer, {
    workerId: "test-worker",
    limit: 10,
    now: () => now,
  });

  assert.deepEqual(result, { claimed: 1, completed: 0, deferred: 1, failed: 0 });
  assert.deepEqual(released, {
    status: "queued",
    runAfter: "2026-07-15T10:05:00.000Z",
    error: "provider timeout",
  });
});
