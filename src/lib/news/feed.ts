import type { DbClusterDetail, DbClusterSource, DbSummary } from "./repository";

export interface NewsFeedItem {
  id: string;
  title: string;
  titleVi: string | null;
  type: string;
  tags: string[];
  sourceCount: number;
  heatScore: number;
  isRising: boolean;
  publishedAt: string | null;
  lastSeenAt: string;
  summary: string | null;
  bullets: string[];
  primary: {
    title: string;
    url: string;
    imageUrl: string | null;
    source: { name: string; slug: string; type: string } | null;
  } | null;
}

export interface NewsDetail extends NewsFeedItem {
  sources: Array<{
    title: string;
    text: string | null;
    url: string;
    imageUrl: string | null;
    authorName: string | null;
    publishedAt: string | null;
    isPrimary: boolean;
    source: { name: string; slug: string; type: string } | null;
  }>;
}

export function toNewsFeedItem(cluster: DbClusterDetail): NewsFeedItem {
  const primary = selectPrimarySource(cluster.cluster_sources);
  const summary = selectSummary(cluster.summaries);

  return {
    id: cluster.id,
    title: cluster.canonical_title,
    titleVi: cluster.title_vi,
    type: cluster.primary_type,
    tags: cluster.topic_tags,
    sourceCount: cluster.source_count,
    heatScore: cluster.heat_score,
    isRising: cluster.is_rising,
    publishedAt: cluster.published_at,
    lastSeenAt: cluster.last_seen_at,
    summary: summary?.content ?? null,
    bullets: summary ? toStringArray(summary.bullets) : [],
    primary: primary ? toPrimarySource(primary) : null,
  };
}

export function toNewsDetail(cluster: DbClusterDetail): NewsDetail {
  return {
    ...toNewsFeedItem(cluster),
    sources: cluster.cluster_sources
      .filter(source => source.raw_items)
      .map(source => ({
        title: source.raw_items?.original_title ?? "",
        text: source.raw_items?.original_text ?? null,
        url: source.raw_items?.canonical_url ?? "",
        imageUrl: source.raw_items?.image_url ?? null,
        authorName: source.raw_items?.author_name ?? null,
        publishedAt: source.raw_items?.published_at ?? null,
        isPrimary: source.is_primary,
        source: source.sources
          ? {
              name: source.sources.name,
              slug: source.sources.slug,
              type: source.sources.type,
            }
          : null,
      })),
  };
}

function selectPrimarySource(
  sources: DbClusterSource[]
): DbClusterSource | undefined {
  return sources.find(source => source.is_primary) ?? sources[0];
}

function toPrimarySource(
  source: DbClusterSource
): NonNullable<NewsFeedItem["primary"]> {
  return {
    title: source.raw_items?.original_title ?? "",
    url: source.raw_items?.canonical_url ?? "",
    imageUrl: source.raw_items?.image_url ?? null,
    source: source.sources
      ? {
          name: source.sources.name,
          slug: source.sources.slug,
          type: source.sources.type,
        }
      : null,
  };
}

function selectSummary(summaries: DbSummary[]): DbSummary | undefined {
  return (
    summaries.find(
      summary =>
        summary.status === "ready" &&
        summary.language_code === "vi" &&
        summary.kind === "short"
    ) ??
    summaries.find(
      summary => summary.status === "ready" && summary.kind === "short"
    )
  );
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
