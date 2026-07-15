export const SOURCE_TYPES = [
  "press",
  "youtube",
  "x",
  "reddit",
  "hacker_news",
  "tiktok",
] as const;

export const RAW_ITEM_STATUSES = [
  "fetched",
  "normalized",
  "rejected",
  "failed",
] as const;

export const CLUSTER_STATUSES = [
  "pending",
  "ready",
  "suppressed",
  "failed",
] as const;

export const SUMMARY_KINDS = [
  "short",
  "detail",
  "video",
  "discussion",
  "translation",
] as const;

export const SUMMARY_STATUSES = ["pending", "ready", "failed"] as const;

export const JOB_KINDS = [
  "ingest_source",
  "normalize_item",
  "cluster_item",
  "enrich_cluster",
  "refresh_metrics",
] as const;

export const JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];
export type RawItemStatus = (typeof RAW_ITEM_STATUSES)[number];
export type ClusterStatus = (typeof CLUSTER_STATUSES)[number];
export type SummaryKind = (typeof SUMMARY_KINDS)[number];
export type SummaryStatus = (typeof SUMMARY_STATUSES)[number];
export type JobKind = (typeof JOB_KINDS)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface NewsSource {
  id: string;
  slug: string;
  name: string;
  type: SourceType;
  homepageUrl: string | null;
  feedUrl: string | null;
  externalId: string | null;
  handle: string | null;
  fetchIntervalMinutes: number;
  isActive: boolean;
  metadata: Record<string, JsonValue>;
  createdAt: string;
  updatedAt: string;
}

export interface RawItem {
  id: string;
  sourceId: string;
  externalId: string;
  canonicalUrl: string;
  originalTitle: string;
  originalText: string | null;
  originalHtml: string | null;
  authorName: string | null;
  imageUrl: string | null;
  languageCode: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  contentHash: string | null;
  status: RawItemStatus;
  rawPayload: Record<string, JsonValue>;
}

export interface NewsCluster {
  id: string;
  primaryRawItemId: string | null;
  primaryType: SourceType;
  canonicalTitle: string;
  titleVi: string | null;
  topicTags: string[];
  status: ClusterStatus;
  sourceCount: number;
  heatScore: number;
  isRising: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  publishedAt: string | null;
  metadata: Record<string, JsonValue>;
}

export interface ClusterSource {
  clusterId: string;
  rawItemId: string;
  sourceId: string;
  matchConfidence: number;
  isPrimary: boolean;
  addedAt: string;
}

export interface ClusterSummary {
  id: string;
  clusterId: string;
  kind: SummaryKind;
  languageCode: string;
  status: SummaryStatus;
  content: string | null;
  bullets: string[];
  model: string | null;
  promptVersion: string | null;
  errorMessage: string | null;
  generatedAt: string | null;
}

export interface SourceMetric {
  id: string;
  rawItemId: string;
  collectedAt: string;
  views: number | null;
  likes: number | null;
  reposts: number | null;
  comments: number | null;
  shares: number | null;
  metadata: Record<string, JsonValue>;
}

export interface NewsJob {
  id: string;
  kind: JobKind;
  status: JobStatus;
  sourceId: string | null;
  rawItemId: string | null;
  clusterId: string | null;
  dedupeKey: string | null;
  payload: Record<string, JsonValue>;
  priority: number;
  runAfter: string;
  lockedAt: string | null;
  lockedBy: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  completedAt: string | null;
}
