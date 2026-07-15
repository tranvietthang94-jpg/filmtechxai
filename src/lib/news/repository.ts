import type { SourceType } from "./types";

export interface DbSource {
  id: string;
  slug: string;
  name: string;
  type: SourceType;
  homepage_url: string | null;
  feed_url: string | null;
  external_id: string | null;
  handle: string | null;
}

export interface DbRawItem {
  id: string;
  source_id: string;
  external_id: string;
  canonical_url: string;
  original_title: string;
  original_text: string | null;
  image_url: string | null;
  author_name: string | null;
  language_code: string | null;
  published_at: string | null;
  content_hash: string | null;
}

export interface DbCluster {
  id: string;
  primary_raw_item_id: string | null;
  primary_type: SourceType;
  canonical_title: string;
  title_vi: string | null;
  topic_tags: string[];
  status: "pending" | "ready" | "suppressed" | "failed";
  source_count: number;
  heat_score: number;
  is_rising: boolean;
  first_seen_at: string;
  last_seen_at: string;
  published_at: string | null;
}

export interface DbClusterSource {
  is_primary: boolean;
  source_id: string;
  raw_item_id: string;
  sources: Pick<DbSource, "id" | "slug" | "name" | "type"> | null;
  raw_items: Pick<
    DbRawItem,
    | "id"
    | "canonical_url"
    | "original_title"
    | "original_text"
    | "image_url"
    | "author_name"
    | "published_at"
  > | null;
}

export interface DbSummary {
  kind: "short" | "detail" | "video" | "discussion" | "translation";
  language_code: string;
  status: "pending" | "ready" | "failed";
  content: string | null;
  bullets: unknown;
  generated_at: string | null;
}

export interface DbJob {
  id: string;
  kind:
    | "ingest_source"
    | "normalize_item"
    | "cluster_item"
    | "enrich_cluster"
    | "refresh_metrics";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  source_id: string | null;
  raw_item_id: string | null;
  cluster_id: string | null;
  dedupe_key: string | null;
  payload: Record<string, unknown>;
  priority: number;
  run_after: string;
  locked_at: string | null;
  locked_by: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
}

export interface DbClusterDetail extends DbCluster {
  cluster_sources: DbClusterSource[];
  summaries: DbSummary[];
}

export interface SourceUpsert {
  slug: string;
  name: string;
  type: SourceType;
  homepage_url?: string;
  feed_url?: string;
  external_id?: string;
  handle?: string;
}

export interface RawItemUpsert {
  source_id: string;
  external_id: string;
  canonical_url: string;
  original_title: string;
  original_text?: string;
  original_html?: string;
  author_name?: string;
  image_url?: string;
  language_code?: string;
  published_at?: string;
  content_hash?: string;
  status: "fetched" | "normalized" | "rejected" | "failed";
  raw_payload: Record<string, unknown>;
}

export interface ClusterInsert {
  primary_raw_item_id: string;
  primary_type: SourceType;
  canonical_title: string;
  topic_tags: string[];
  status: "pending" | "ready" | "suppressed" | "failed";
  first_seen_at: string;
  last_seen_at: string;
  published_at?: string;
}

export interface ClusterUpdate {
  title_vi?: string;
  topic_tags?: string[];
  status?: "pending" | "ready" | "suppressed" | "failed";
  heat_score?: number;
  is_rising?: boolean;
  last_seen_at?: string;
  published_at?: string;
}

export interface JobInsert {
  kind:
    | "ingest_source"
    | "normalize_item"
    | "cluster_item"
    | "enrich_cluster"
    | "refresh_metrics";
  source_id?: string;
  raw_item_id?: string;
  cluster_id?: string;
  dedupe_key: string;
  payload: Record<string, unknown>;
  priority?: number;
}

export interface MetricInsert {
  raw_item_id: string;
  collected_at: string;
  views?: number;
}

export interface SummaryUpsert {
  cluster_id: string;
  kind: "short" | "detail" | "video" | "discussion" | "translation";
  language_code: string;
  status: "pending" | "ready" | "failed";
  content?: string;
  bullets?: string[];
  model?: string;
  prompt_version?: string;
  error_message?: string;
  generated_at?: string;
}

export interface FeedQuery {
  limit: number;
  sourceType?: SourceType;
  tag?: string;
}

export interface NewsRepository {
  upsertSource(input: SourceUpsert): Promise<DbSource>;
  upsertRawItem(input: RawItemUpsert): Promise<DbRawItem>;
  findClusterIdForRawItem(rawItemId: string): Promise<string | null>;
  listRecentClusters(since: string, limit: number): Promise<DbCluster[]>;
  getCluster(clusterId: string): Promise<DbCluster | null>;
  createCluster(input: ClusterInsert): Promise<DbCluster>;
  updateCluster(clusterId: string, input: ClusterUpdate): Promise<DbCluster>;
  attachRawItemToCluster(input: {
    clusterId: string;
    rawItemId: string;
    sourceId: string;
    isPrimary: boolean;
  }): Promise<void>;
  recordMetric(input: MetricInsert): Promise<void>;
  enqueueJob(input: JobInsert): Promise<void>;
  claimJobs(input: {
    workerId: string;
    kind: DbJob["kind"];
    limit: number;
  }): Promise<DbJob[]>;
  completeJob(jobId: string, workerId: string): Promise<void>;
  releaseJob(
    job: DbJob,
    workerId: string,
    input: { status: "queued" | "failed"; runAfter?: string; error: string }
  ): Promise<void>;
  upsertSummary(input: SummaryUpsert): Promise<DbSummary>;
  listFeed(input: FeedQuery): Promise<DbClusterDetail[]>;
  getClusterDetail(clusterId: string): Promise<DbClusterDetail | null>;
}

type FetchImplementation = typeof fetch;

const clusterFields =
  "id,primary_raw_item_id,primary_type,canonical_title,title_vi,topic_tags,status,source_count,heat_score,is_rising,first_seen_at,last_seen_at,published_at";
const clusterDetailFields = `${clusterFields},cluster_sources(is_primary,source_id,raw_item_id,sources(id,slug,name,type),raw_items(id,canonical_url,original_title,original_text,image_url,author_name,published_at)),summaries(kind,language_code,status,content,bullets,generated_at)`;

export class SupabaseNewsRepository implements NewsRepository {
  private readonly restUrl: string;

  constructor(
    projectUrl: string,
    private readonly serviceRoleKey: string,
    private readonly fetchImplementation: FetchImplementation = fetch
  ) {
    this.restUrl = `${projectUrl.replace(/\/+$/, "")}/rest/v1`;
  }

  async upsertSource(input: SourceUpsert): Promise<DbSource> {
    return this.writeOne<DbSource>("sources?on_conflict=slug", input, {
      Prefer: "resolution=merge-duplicates,return=representation",
    });
  }

  async upsertRawItem(input: RawItemUpsert): Promise<DbRawItem> {
    return this.writeOne<DbRawItem>(
      "raw_items?on_conflict=source_id,external_id",
      input,
      { Prefer: "resolution=merge-duplicates,return=representation" }
    );
  }

  async findClusterIdForRawItem(rawItemId: string): Promise<string | null> {
    const rows = await this.getRows<{ cluster_id: string }>("cluster_sources", {
      select: "cluster_id",
      raw_item_id: `eq.${rawItemId}`,
      limit: "1",
    });
    return rows[0]?.cluster_id ?? null;
  }

  listRecentClusters(since: string, limit: number): Promise<DbCluster[]> {
    return this.getRows<DbCluster>("clusters", {
      select: clusterFields,
      status: "in.(pending,ready)",
      last_seen_at: `gte.${since}`,
      order: "last_seen_at.desc",
      limit: String(limit),
    });
  }

  async getCluster(clusterId: string): Promise<DbCluster | null> {
    const rows = await this.getRows<DbCluster>("clusters", {
      select: clusterFields,
      id: `eq.${clusterId}`,
      limit: "1",
    });
    return rows[0] ?? null;
  }

  createCluster(input: ClusterInsert): Promise<DbCluster> {
    return this.writeOne<DbCluster>("clusters", input, {
      Prefer: "return=representation",
    });
  }

  updateCluster(clusterId: string, input: ClusterUpdate): Promise<DbCluster> {
    return this.patchOne<DbCluster>(`clusters?id=eq.${clusterId}`, input);
  }

  async attachRawItemToCluster(input: {
    clusterId: string;
    rawItemId: string;
    sourceId: string;
    isPrimary: boolean;
  }): Promise<void> {
    await this.request<void>(
      "cluster_sources?on_conflict=cluster_id,raw_item_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          cluster_id: input.clusterId,
          raw_item_id: input.rawItemId,
          source_id: input.sourceId,
          is_primary: input.isPrimary,
        }),
      }
    );
  }

  async enqueueJob(input: JobInsert): Promise<void> {
    await this.request<void>("jobs?on_conflict=dedupe_key", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ ...input, status: "queued" }),
    });
  }

  claimJobs(input: {
    workerId: string;
    kind: DbJob["kind"];
    limit: number;
  }): Promise<DbJob[]> {
    return this.request<DbJob[]>("rpc/claim_news_jobs", {
      method: "POST",
      body: JSON.stringify({
        worker_id: input.workerId,
        requested_kind: input.kind,
        max_jobs: input.limit,
      }),
    });
  }

  async completeJob(jobId: string, workerId: string): Promise<void> {
    await this.patchOne<DbJob>(
      this.path("jobs", {
        id: `eq.${jobId}`,
        status: "eq.running",
        locked_by: `eq.${workerId}`,
      }),
      {
        status: "completed",
        completed_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        last_error: null,
      }
    );
  }

  async releaseJob(
    job: DbJob,
    workerId: string,
    input: { status: "queued" | "failed"; runAfter?: string; error: string }
  ): Promise<void> {
    await this.patchOne<DbJob>(
      this.path("jobs", {
        id: `eq.${job.id}`,
        status: "eq.running",
        locked_by: `eq.${workerId}`,
      }),
      {
        status: input.status,
        run_after: input.runAfter,
        locked_at: null,
        locked_by: null,
        last_error: input.error.slice(0, 2000),
      }
    );
  }

  upsertSummary(input: SummaryUpsert): Promise<DbSummary> {
    return this.writeOne<DbSummary>(
      "summaries?on_conflict=cluster_id,kind,language_code",
      input,
      { Prefer: "resolution=merge-duplicates,return=representation" }
    );
  }

  async recordMetric(input: MetricInsert): Promise<void> {
    await this.request<void>("metrics?on_conflict=raw_item_id,collected_at", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(input),
    });
  }

  listFeed(input: FeedQuery): Promise<DbClusterDetail[]> {
    const params: Record<string, string> = {
      select: clusterDetailFields,
      status: "eq.ready",
      order: "heat_score.desc,last_seen_at.desc",
      limit: String(input.limit),
    };

    if (input.sourceType) {
      params.primary_type = `eq.${input.sourceType}`;
    }
    if (input.tag) {
      params.topic_tags = `cs.{${input.tag}}`;
    }

    return this.getRows<DbClusterDetail>("clusters", params);
  }

  async getClusterDetail(clusterId: string): Promise<DbClusterDetail | null> {
    const rows = await this.getRows<DbClusterDetail>("clusters", {
      select: clusterDetailFields,
      id: `eq.${clusterId}`,
      limit: "1",
    });
    return rows[0] ?? null;
  }

  private async writeOne<T>(
    path: string,
    body: object,
    headers: Record<string, string>
  ): Promise<T> {
    const rows = await this.request<T[]>(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!rows[0]) {
      throw new Error("Supabase did not return the persisted record.");
    }
    return rows[0];
  }

  private async patchOne<T>(path: string, body: object): Promise<T> {
    const rows = await this.request<T[]>(path, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    if (!rows[0]) {
      throw new Error("Supabase did not return the updated record.");
    }
    return rows[0];
  }

  private getRows<T>(
    table: string,
    params: Record<string, string>
  ): Promise<T[]> {
    return this.request<T[]>(`${table}?${new URLSearchParams(params)}`);
  }

  private path(table: string, params: Record<string, string>): string {
    return `${table}?${new URLSearchParams(params)}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("apikey", this.serviceRoleKey);
    headers.set("authorization", `Bearer ${this.serviceRoleKey}`);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");

    let response: Response;
    try {
      response = await this.fetchImplementation(`${this.restUrl}/${path}`, {
        ...init,
        headers,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "network error";
      throw new Error(`Supabase request could not be completed: ${detail}`);
    }

    const responseBody = await response.text();
    if (!response.ok) {
      const detail = responseBody.replace(/\s+/g, " ").slice(0, 300);
      throw new Error(
        `Supabase request failed with ${response.status}: ${detail}`
      );
    }
    if (!responseBody) return undefined as T;

    try {
      return JSON.parse(responseBody) as T;
    } catch {
      throw new Error("Supabase returned invalid JSON.");
    }
  }
}

export function createNewsRepositoryFromEnvironment(
  environment: Record<string, string | undefined> = process.env
): SupabaseNewsRepository | null {
  const projectUrl = environment.SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!projectUrl || !serviceRoleKey) return null;

  try {
    new URL(projectUrl);
  } catch {
    return null;
  }

  return new SupabaseNewsRepository(projectUrl, serviceRoleKey);
}
