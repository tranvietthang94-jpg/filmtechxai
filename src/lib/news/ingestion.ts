import type {
  ClusterUpdate,
  DbCluster,
  NewsRepository,
  SourceUpsert,
} from "./repository";
import type { SourceType } from "./types";

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

export interface IngestionSource {
  slug: string;
  name: string;
  type: SourceType;
  homepageUrl?: string;
  feedUrl?: string;
  externalId?: string;
  handle?: string;
  tags: string[];
}

export interface IncomingNewsItem {
  externalId?: string;
  url: string;
  title: string;
  text?: string;
  html?: string;
  authorName?: string;
  imageUrl?: string;
  languageCode?: string;
  publishedAt?: string;
  rawPayload?: Record<string, unknown>;
  views?: number;
}

export interface IngestionResult {
  processed: number;
  failed: number;
  createdClusters: number;
  errors: string[];
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ["fbclid", "gclid"].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

export function titleSimilarity(left: string, right: string): number {
  const leftTokens = titleTokens(left);
  const rightTokens = titleTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;

  const intersection = [...leftTokens].filter(token => rightTokens.has(token));
  if (intersection.length < 2) return 0;

  const unionSize = new Set([...leftTokens, ...rightTokens]).size;
  return intersection.length / unionSize;
}

export function calculateHeatScore(input: {
  sourceCount: number;
  publishedAt: string | undefined;
  views?: number;
  now: Date;
}): number {
  const publishedAt = input.publishedAt ? Date.parse(input.publishedAt) : NaN;
  const ageHours = Number.isNaN(publishedAt)
    ? 48
    : Math.max(0, (input.now.getTime() - publishedAt) / 3_600_000);
  const freshness = Math.max(0, 36 - ageHours) * 1.25;
  const confirmation = Math.min(input.sourceCount, 10) * 8;
  const viewBoost = input.views
    ? Math.min(12, Math.log10(Math.max(1, input.views)) * 2)
    : 0;

  return Number((freshness + confirmation + viewBoost).toFixed(4));
}

export async function ingestSourceItems(
  repository: NewsRepository,
  source: IngestionSource,
  items: IncomingNewsItem[],
  options: { now?: Date; onItemError?: (message: string) => void } = {}
): Promise<IngestionResult> {
  const now = options.now ?? new Date();
  const sourceRow = await repository.upsertSource(toSourceUpsert(source));
  const lookback = new Date(now.getTime() - 72 * 3_600_000).toISOString();
  const candidates = await repository.listRecentClusters(lookback, 150);
  const result: IngestionResult = {
    processed: 0,
    failed: 0,
    createdClusters: 0,
    errors: [],
  };

  for (const item of items) {
    try {
      const normalizedUrl = normalizeUrl(item.url);
      const normalizedTitle = normalizeText(item.title);
      if (!normalizedUrl || !normalizedTitle) {
        throw new Error("item requires a URL and title");
      }

      const publishedAt = toIsoDate(item.publishedAt, now);
      const rawItem = await repository.upsertRawItem({
        source_id: sourceRow.id,
        external_id: item.externalId?.trim() || normalizedUrl,
        canonical_url: normalizedUrl,
        original_title: normalizedTitle,
        original_text: normalizeText(item.text),
        original_html: normalizeText(item.html),
        author_name: normalizeText(item.authorName),
        image_url: normalizeText(item.imageUrl),
        language_code: normalizeText(item.languageCode),
        published_at: publishedAt,
        status: "normalized",
        raw_payload: item.rawPayload ?? {},
      });

      if (Number.isSafeInteger(item.views) && item.views !== undefined) {
        await repository.recordMetric({
          raw_item_id: rawItem.id,
          collected_at: now.toISOString(),
          views: item.views,
        });
      }

      const assignedClusterId = await repository.findClusterIdForRawItem(
        rawItem.id
      );
      let cluster = assignedClusterId
        ? await repository.getCluster(assignedClusterId)
        : findMatchingCluster(candidates, normalizedTitle);

      if (!cluster) {
        cluster = await repository.createCluster({
          primary_raw_item_id: rawItem.id,
          primary_type: source.type,
          canonical_title: normalizedTitle,
          topic_tags: uniqueTags(source.tags),
          status: "pending",
          first_seen_at: now.toISOString(),
          last_seen_at: now.toISOString(),
          published_at: publishedAt,
        });
        candidates.unshift(cluster);
        result.createdClusters++;
      }

      await repository.attachRawItemToCluster({
        clusterId: cluster.id,
        rawItemId: rawItem.id,
        sourceId: sourceRow.id,
        isPrimary: cluster.primary_raw_item_id === rawItem.id,
      });

      const refreshedCluster = await repository.getCluster(cluster.id);
      if (!refreshedCluster) {
        throw new Error("cluster disappeared while ingesting an item");
      }

      const update = clusterUpdateForItem(
        refreshedCluster,
        item,
        source.tags,
        publishedAt,
        now
      );
      const updatedCluster = await repository.updateCluster(
        refreshedCluster.id,
        update
      );
      updateCandidate(candidates, updatedCluster);

      await repository.enqueueJob({
        kind: "enrich_cluster",
        cluster_id: updatedCluster.id,
        dedupe_key: `enrich:${updatedCluster.id}:${updatedCluster.source_count}`,
        payload: {
          sourceCount: updatedCluster.source_count,
          canonicalTitle: updatedCluster.canonical_title,
        },
        priority: updatedCluster.source_count > 1 ? 10 : 0,
      });
      result.processed++;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      const message = `Could not ingest ${item.url}: ${detail}`;
      result.failed++;
      result.errors.push(message);
      options.onItemError?.(message);
    }
  }

  return result;
}

function toSourceUpsert(source: IngestionSource): SourceUpsert {
  return {
    slug: source.slug,
    name: source.name,
    type: source.type,
    homepage_url: source.homepageUrl,
    feed_url: source.feedUrl,
    external_id: source.externalId,
    handle: source.handle,
  };
}

function titleTokens(value: string): Set<string> {
  return new Set(
    value
      .normalize("NFKD")
      .toLocaleLowerCase("en-US")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter(token => token.length > 1 && !TITLE_STOP_WORDS.has(token))
  );
}

function findMatchingCluster(
  candidates: DbCluster[],
  title: string
): DbCluster | null {
  let bestMatch: DbCluster | null = null;
  let bestScore = 0.72;

  for (const candidate of candidates) {
    const score = titleSimilarity(title, candidate.canonical_title);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

function clusterUpdateForItem(
  cluster: DbCluster,
  item: IncomingNewsItem,
  sourceTags: string[],
  publishedAt: string,
  now: Date
): ClusterUpdate {
  const earliestPublishedAt = cluster.published_at
    ? new Date(cluster.published_at) < new Date(publishedAt)
      ? cluster.published_at
      : publishedAt
    : publishedAt;

  return {
    topic_tags: uniqueTags([...cluster.topic_tags, ...sourceTags]),
    status: "ready",
    last_seen_at: now.toISOString(),
    published_at: earliestPublishedAt,
    heat_score: calculateHeatScore({
      sourceCount: cluster.source_count,
      publishedAt: earliestPublishedAt,
      views: item.views,
      now,
    }),
    is_rising: cluster.source_count > 1,
  };
}

function updateCandidate(candidates: DbCluster[], updated: DbCluster): void {
  const index = candidates.findIndex(candidate => candidate.id === updated.id);
  if (index >= 0) candidates[index] = updated;
}

function uniqueTags(tags: string[]): string[] {
  return [
    ...new Set(tags.map(tag => tag.trim().toLowerCase()).filter(Boolean)),
  ];
}

function toIsoDate(value: string | undefined, fallback: Date): string {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isNaN(timestamp)
    ? fallback.toISOString()
    : new Date(timestamp).toISOString();
}
