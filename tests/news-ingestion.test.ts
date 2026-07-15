import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateHeatScore,
  ingestSourceItems,
  normalizeUrl,
  titleSimilarity,
} from "../src/lib/news/ingestion";
import type {
  ClusterInsert,
  ClusterUpdate,
  DbCluster,
  DbClusterDetail,
  DbJob,
  DbRawItem,
  DbSource,
  FeedQuery,
  JobInsert,
  MetricInsert,
  NewsRepository,
  RawItemUpsert,
  SummaryUpsert,
  SourceUpsert,
} from "../src/lib/news/repository";

test("normalizes tracking URLs and matches only close news titles", () => {
  assert.equal(
    normalizeUrl("https://example.com/news?utm_source=feed&b=2&a=1#section"),
    "https://example.com/news?a=1&b=2"
  );
  assert.ok(
    titleSimilarity(
      "OpenAI releases a new vision model",
      "OpenAI releases new vision model"
    ) > 0.72
  );
  assert.equal(
    titleSimilarity("Camera price drops", "Film festival winners announced"),
    0
  );
});

test("clusters matching sources, records metrics, and queues enrichment", async () => {
  const repository = new InMemoryNewsRepository();
  const now = new Date("2026-07-15T10:00:00.000Z");

  const firstResult = await ingestSourceItems(
    repository,
    {
      slug: "press-openai",
      name: "OpenAI Blog",
      type: "press",
      feedUrl: "https://openai.com/blog/rss.xml",
      tags: ["ai"],
    },
    [
      {
        url: "https://example.com/openai-vision?utm_source=rss",
        title: "OpenAI releases a new vision model",
        text: "A source article.",
        publishedAt: "2026-07-15T09:00:00Z",
      },
    ],
    { now }
  );
  const secondResult = await ingestSourceItems(
    repository,
    {
      slug: "youtube-review",
      name: "Review Channel",
      type: "youtube",
      externalId: "channel-1",
      tags: ["youtube", "ai"],
    },
    [
      {
        externalId: "video-1",
        url: "https://www.youtube.com/watch?v=video-1",
        title: "OpenAI releases new vision model",
        text: "A video discussion.",
        publishedAt: "2026-07-15T09:15:00Z",
        views: 1200,
      },
    ],
    { now }
  );

  assert.equal(firstResult.createdClusters, 1);
  assert.equal(secondResult.createdClusters, 0);
  assert.equal(repository.clusters.length, 1);
  assert.equal(repository.clusters[0].source_count, 2);
  assert.equal(repository.clusters[0].status, "ready");
  assert.equal(repository.metrics.length, 1);
  assert.equal(repository.jobs.size, 2);
  assert.equal(
    repository.rawItems[0].canonical_url,
    "https://example.com/openai-vision"
  );
  assert.ok(
    calculateHeatScore({
      sourceCount: 2,
      publishedAt: "2026-07-15T09:00:00Z",
      now,
    }) > 0
  );
});

class InMemoryNewsRepository implements NewsRepository {
  readonly sources: DbSource[] = [];
  readonly rawItems: DbRawItem[] = [];
  readonly clusters: DbCluster[] = [];
  readonly metrics: MetricInsert[] = [];
  readonly jobs = new Map<string, JobInsert>();
  private readonly clusterByRawItem = new Map<string, string>();
  private readonly sourceIdsByCluster = new Map<string, Set<string>>();
  private sequence = 0;

  async upsertSource(input: SourceUpsert): Promise<DbSource> {
    const existing = this.sources.find(source => source.slug === input.slug);
    if (existing) return existing;

    const source: DbSource = {
      id: this.nextId(),
      slug: input.slug,
      name: input.name,
      type: input.type,
      homepage_url: input.homepage_url ?? null,
      feed_url: input.feed_url ?? null,
      external_id: input.external_id ?? null,
      handle: input.handle ?? null,
    };
    this.sources.push(source);
    return source;
  }

  async upsertRawItem(input: RawItemUpsert): Promise<DbRawItem> {
    const existing = this.rawItems.find(
      item =>
        item.source_id === input.source_id && item.external_id === input.external_id
    );
    if (existing) return existing;

    const item: DbRawItem = {
      id: this.nextId(),
      source_id: input.source_id,
      external_id: input.external_id,
      canonical_url: input.canonical_url,
      original_title: input.original_title,
      original_text: input.original_text ?? null,
      image_url: input.image_url ?? null,
      author_name: input.author_name ?? null,
      language_code: input.language_code ?? null,
      published_at: input.published_at ?? null,
      content_hash: input.content_hash ?? null,
    };
    this.rawItems.push(item);
    return item;
  }

  async findClusterIdForRawItem(rawItemId: string): Promise<string | null> {
    return this.clusterByRawItem.get(rawItemId) ?? null;
  }

  async listRecentClusters(since: string, limit: number): Promise<DbCluster[]> {
    return this.clusters
      .filter(cluster => cluster.last_seen_at >= since)
      .slice(0, limit);
  }

  async getCluster(clusterId: string): Promise<DbCluster | null> {
    return this.clusters.find(cluster => cluster.id === clusterId) ?? null;
  }

  async createCluster(input: ClusterInsert): Promise<DbCluster> {
    const cluster: DbCluster = {
      id: this.nextId(),
      primary_raw_item_id: input.primary_raw_item_id,
      primary_type: input.primary_type,
      canonical_title: input.canonical_title,
      title_vi: null,
      topic_tags: input.topic_tags,
      status: input.status,
      source_count: 0,
      heat_score: 0,
      is_rising: false,
      first_seen_at: input.first_seen_at,
      last_seen_at: input.last_seen_at,
      published_at: input.published_at ?? null,
    };
    this.clusters.push(cluster);
    return cluster;
  }

  async updateCluster(
    clusterId: string,
    input: ClusterUpdate
  ): Promise<DbCluster> {
    const cluster = await this.getCluster(clusterId);
    if (!cluster) throw new Error("cluster not found");
    Object.assign(cluster, input);
    return cluster;
  }

  async attachRawItemToCluster(input: {
    clusterId: string;
    rawItemId: string;
    sourceId: string;
    isPrimary: boolean;
  }): Promise<void> {
    const existingClusterId = this.clusterByRawItem.get(input.rawItemId);
    if (existingClusterId && existingClusterId !== input.clusterId) {
      throw new Error("raw item is already attached to another cluster");
    }
    this.clusterByRawItem.set(input.rawItemId, input.clusterId);
    const sourceIds = this.sourceIdsByCluster.get(input.clusterId) ?? new Set();
    sourceIds.add(input.sourceId);
    this.sourceIdsByCluster.set(input.clusterId, sourceIds);
    const cluster = await this.getCluster(input.clusterId);
    if (cluster) cluster.source_count = sourceIds.size;
  }

  async recordMetric(input: MetricInsert): Promise<void> {
    this.metrics.push(input);
  }

  async enqueueJob(input: JobInsert): Promise<void> {
    this.jobs.set(input.dedupe_key, input);
  }

  async claimJobs(_input: {
    workerId: string;
    kind: DbJob["kind"];
    limit: number;
  }): Promise<DbJob[]> {
    return [];
  }

  async completeJob(_jobId: string, _workerId: string): Promise<void> {}

  async releaseJob(
    _job: DbJob,
    _workerId: string,
    _input: { status: "queued" | "failed"; runAfter?: string; error: string }
  ): Promise<void> {}

  async upsertSummary(_input: SummaryUpsert) {
    return {
      kind: "short" as const,
      language_code: "vi",
      status: "ready" as const,
      content: "",
      bullets: [],
      generated_at: null,
    };
  }

  async listFeed(_input: FeedQuery): Promise<DbClusterDetail[]> {
    return [];
  }

  async getClusterDetail(_clusterId: string): Promise<DbClusterDetail | null> {
    return null;
  }

  private nextId(): string {
    this.sequence += 1;
    return `id-${this.sequence}`;
  }
}
