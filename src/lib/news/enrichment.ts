import type { ClusterSummarizer } from "./summarizer";
import type { DbJob, NewsRepository } from "./repository";

export interface EnrichmentResult {
  claimed: number;
  completed: number;
  deferred: number;
  failed: number;
}

export interface EnrichmentOptions {
  workerId: string;
  limit: number;
  now?: () => Date;
  onCompleted?: (job: DbJob) => void;
  onFailure?: (input: {
    job: DbJob;
    error: string;
    terminal: boolean;
    releaseError?: string;
  }) => void;
}

export async function runEnrichmentBatch(
  repository: NewsRepository,
  summarizer: ClusterSummarizer,
  options: EnrichmentOptions
): Promise<EnrichmentResult> {
  const now = options.now ?? (() => new Date());
  const jobs = await repository.claimJobs({
    workerId: options.workerId,
    kind: "enrich_cluster",
    limit: options.limit,
  });
  const result: EnrichmentResult = {
    claimed: jobs.length,
    completed: 0,
    deferred: 0,
    failed: 0,
  };

  for (const job of jobs) {
    try {
      await enrichJob(repository, summarizer, job, options.workerId, now);
      result.completed++;
      options.onCompleted?.(job);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      const terminal = job.attempts >= job.max_attempts;
      try {
        await repository.releaseJob(job, options.workerId, {
          status: terminal ? "failed" : "queued",
          runAfter: terminal ? undefined : retryAt(job.attempts, now),
          error: detail,
        });
        if (terminal) result.failed++;
        else result.deferred++;
        options.onFailure?.({ job, error: detail, terminal });
      } catch (releaseError) {
        const releaseDetail =
          releaseError instanceof Error
            ? releaseError.message
            : "unknown error";
        result.failed++;
        options.onFailure?.({
          job,
          error: detail,
          terminal,
          releaseError: releaseDetail,
        });
      }
    }
  }

  return result;
}

async function enrichJob(
  repository: NewsRepository,
  summarizer: ClusterSummarizer,
  job: DbJob,
  workerId: string,
  now: () => Date
): Promise<void> {
  if (!job.cluster_id) {
    throw new Error("Enrichment job does not reference a cluster.");
  }

  const cluster = await repository.getClusterDetail(job.cluster_id);
  if (!cluster) {
    throw new Error("Referenced cluster was not found.");
  }

  const generated = await summarizer.summarize(cluster);
  const generatedAt = now().toISOString();
  await repository.upsertSummary({
    cluster_id: cluster.id,
    kind: "short",
    language_code: "vi",
    status: "ready",
    content: generated.shortSummary,
    bullets: generated.bullets,
    model: generated.model,
    prompt_version: generated.promptVersion,
    generated_at: generatedAt,
  });
  await repository.upsertSummary({
    cluster_id: cluster.id,
    kind: "detail",
    language_code: "vi",
    status: "ready",
    content: generated.detailSummary,
    bullets: generated.bullets,
    model: generated.model,
    prompt_version: generated.promptVersion,
    generated_at: generatedAt,
  });
  await repository.updateCluster(cluster.id, { title_vi: generated.titleVi });
  await repository.completeJob(job.id, workerId);
}

function retryAt(attempts: number, now: () => Date): string {
  const delayMinutes = Math.min(60, 5 * 2 ** Math.max(0, attempts - 1));
  return new Date(now().getTime() + delayMinutes * 60_000).toISOString();
}
