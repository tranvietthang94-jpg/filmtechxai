/**
 * Fetch configured RSS/YouTube sources and persist them in the Supabase news
 * schema. Markdown generation remains a separate static-site fallback.
 */

import {
  type RssItem,
  fetchRss,
  fetchYoutubeVideos,
} from "./fetch-rss";
import { RSS_SOURCES, YOUTUBE_CHANNELS } from "../src/config/sources";
import { ingestSourceItems, type IncomingNewsItem } from "../src/lib/news/ingestion";
import { createNewsRepositoryFromEnvironment } from "../src/lib/news/repository";

const ITEMS_PER_SOURCE = 3;

const logger = {
  info(message = "") {
    process.stdout.write(`${message}\n`);
  },
  error(message: string) {
    process.stderr.write(`${message}\n`);
  },
};

interface WorkerTotals {
  sourcesSucceeded: number;
  sourcesFailed: number;
  itemsProcessed: number;
  itemsFailed: number;
  clustersCreated: number;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const repository = createNewsRepositoryFromEnvironment();
  if (!dryRun && !repository) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured for news ingestion."
    );
  }

  const totals: WorkerTotals = {
    sourcesSucceeded: 0,
    sourcesFailed: 0,
    itemsProcessed: 0,
    itemsFailed: 0,
    clustersCreated: 0,
  };

  logger.info(`Starting ${dryRun ? "dry-run " : ""}news ingestion...`);

  for (const source of RSS_SOURCES) {
    logger.info(`Fetching RSS: ${source.name}`);
    const feed = await fetchRss(source.url);
    if (!feed) {
      totals.sourcesFailed++;
      continue;
    }

    const items = feed.items.slice(0, ITEMS_PER_SOURCE).map(toRssItem);
    if (dryRun) {
      logger.info(`  Would ingest ${items.length} item(s).`);
      totals.sourcesSucceeded++;
      totals.itemsProcessed += items.length;
      continue;
    }

    const result = await ingestSourceItems(
      repository!,
      {
        slug: `press-${slugify(source.name)}`,
        name: source.name,
        type: "press",
        homepageUrl: feed.link || source.url,
        feedUrl: source.url,
        tags: [source.category],
      },
      items,
      { onItemError: message => logger.error(`  ${message}`) }
    );
    totals.sourcesSucceeded++;
    totals.itemsProcessed += result.processed;
    totals.itemsFailed += result.failed;
    totals.clustersCreated += result.createdClusters;
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!youtubeApiKey) {
    logger.info("YOUTUBE_API_KEY is not set. Skipping optional YouTube ingestion.");
  } else {
    for (const channel of YOUTUBE_CHANNELS) {
      logger.info(`Fetching YouTube: ${channel.name}`);
      const videos = await fetchYoutubeVideos(
        channel.channelId,
        channel.name,
        youtubeApiKey
      );
      if (!videos.length) {
        totals.sourcesFailed++;
        continue;
      }

      const items = videos.slice(0, ITEMS_PER_SOURCE).map(video => ({
        externalId: youtubeVideoId(video.link),
        url: video.link,
        title: video.title,
        text: video.description,
        imageUrl: video.thumbnail,
        languageCode: "en",
        publishedAt: video.pubDate,
        rawPayload: { channelId: channel.channelId },
        views: safeInteger(video.viewCount),
      }));
      if (dryRun) {
        logger.info(`  Would ingest ${items.length} item(s).`);
        totals.sourcesSucceeded++;
        totals.itemsProcessed += items.length;
        continue;
      }

      const result = await ingestSourceItems(
        repository!,
        {
          slug: `youtube-${slugify(channel.name)}`,
          name: channel.name,
          type: "youtube",
          homepageUrl: `https://www.youtube.com/channel/${channel.channelId}`,
          externalId: channel.channelId,
          tags: ["youtube"],
        },
        items,
        { onItemError: message => logger.error(`  ${message}`) }
      );
      totals.sourcesSucceeded++;
      totals.itemsProcessed += result.processed;
      totals.itemsFailed += result.failed;
      totals.clustersCreated += result.createdClusters;
    }
  }

  logger.info(
    `Done: ${totals.sourcesSucceeded} source(s) succeeded, ${totals.sourcesFailed} failed, ${totals.itemsProcessed} item(s) processed, ${totals.itemsFailed} item(s) failed, ${totals.clustersCreated} cluster(s) created.`
  );
}

function toRssItem(item: RssItem): IncomingNewsItem {
  return {
    url: item.link,
    title: item.title,
    text: item.content || item.description,
    authorName: item.creator,
    imageUrl: item.thumbnail,
    languageCode: "en",
    publishedAt: item.pubDate,
  };
}

function slugify(value: string): string {
  const slug = value
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "source";
}

function youtubeVideoId(url: string): string {
  try {
    return new URL(url).searchParams.get("v") || url;
  } catch {
    return url;
  }
}

function safeInteger(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}


main().catch(error => {
  const detail = error instanceof Error ? error.message : "unknown error";
  logger.error(`News ingestion failed: ${detail}`);
  process.exitCode = 1;
});
