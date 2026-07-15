/**
 * Fetch RSS/YouTube sources and generate Markdown posts.
 *
 * This script must run before the static site build. The scheduled GitHub
 * Action commits generated posts so GitHub Pages can publish the static site
 * from source.
 */

import {
  RSS_SOURCES,
  YOUTUBE_CHANNELS,
  type RssSource,
} from "../src/config/sources";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

const logger = {
  info(message = "") {
    process.stdout.write(`${message}\n`);
  },
  error(message: string, detail?: unknown) {
    const suffix = detail ? ` ${formatLogDetail(detail)}` : "";
    process.stderr.write(`${message}${suffix}\n`);
  },
};

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  creator?: string;
  content?: string;
  thumbnail?: string;
}

export interface ParsedRss {
  title: string;
  link: string;
  items: RssItem[];
}

export interface YoutubeVideo {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  thumbnail: string;
  channelName: string;
  viewCount: string;
}

interface YouTubeApiThumbnail {
  url?: string;
}

interface YouTubeApiItem {
  id?: string;
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
  snippet?: {
    resourceId?: {
      videoId?: string;
    };
    title?: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: {
      maxres?: YouTubeApiThumbnail;
      high?: YouTubeApiThumbnail;
      medium?: YouTubeApiThumbnail;
    };
  };
  statistics?: {
    viewCount?: string;
  };
}

interface YouTubeApiResponse {
  items?: YouTubeApiItem[];
}

const FEED_FETCH_ATTEMPTS = 3;
const MAX_SOURCE_EXCERPT_LENGTH = 900;
const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
};

function formatLogDetail(detail: unknown): string {
  if (detail instanceof Error) {
    return detail.stack ?? detail.message;
  }

  if (typeof detail === "string") {
    return detail;
  }

  return JSON.stringify(detail);
}

function getYoutubeApiKey(): string | null {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  if (!apiKey) {
    logger.info("YOUTUBE_API_KEY is not set. Skipping YouTube sources.");
    return null;
  }

  return apiKey;
}

export function isFeedDocument(xml: string): boolean {
  return /<(?:rss|feed)(?:\s|>)/i.test(xml);
}

export function parseRssXml(xml: string): ParsedRss {
  const items: RssItem[] = [];

  const itemRegex = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[2];

    const title = extractTag(itemXml, "title") ?? "";
    const link =
      extractTag(itemXml, "link") ??
      extractAttribute(itemXml, "link", "href") ??
      "";
    const description =
      extractTag(itemXml, "description") ??
      extractTag(itemXml, "summary") ??
      extractTag(itemXml, "media:description") ??
      "";
    const pubDate =
      extractTag(itemXml, "pubDate") ??
      extractTag(itemXml, "published") ??
      extractTag(itemXml, "updated") ??
      extractTag(itemXml, "dc:date") ??
      "";
    const creator = extractTag(itemXml, "dc:creator") ?? undefined;
    const content =
      extractTag(itemXml, "content:encoded") ??
      extractTag(itemXml, "content") ??
      undefined;

    const thumbnail =
      extractAttribute(itemXml, "media:thumbnail", "url") ??
      extractAttribute(itemXml, "media:content", "url") ??
      extractAttribute(itemXml, "enclosure", "url") ??
      undefined;

    if (title && link) {
      items.push({
        title: decodeHtmlEntities(title),
        link,
        description: decodeHtmlEntities(stripHtml(description || "")),
        pubDate,
        creator: creator ? decodeHtmlEntities(creator) : undefined,
        content: content ? decodeHtmlEntities(stripHtml(content)) : undefined,
        thumbnail,
      });
    }
  }

  return {
    title: extractTag(xml, "title") || "Unknown",
    link: extractTag(xml, "link") || "",
    items,
  };
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  if (!match) return null;

  const value = match[1].trim();
  const cdataMatch = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdataMatch ? cdataMatch[1].trim() : value;
}

function extractAttribute(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(
    `<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`,
    "i"
  );
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function decodeHtmlEntities(text: string): string {
  let decoded = text;

  // Feeds sometimes encode entities twice, for example &amp;#8217;. Two passes
  // handle that common case while avoiding unbounded decoding of source text.
  for (let pass = 0; pass < 2; pass++) {
    const next = decoded.replace(
      /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi,
      (entity, decimal?: string, hexadecimal?: string, named?: string) => {
        const normalizedName = named?.toLowerCase();

        if (normalizedName) {
          return NAMED_HTML_ENTITIES[normalizedName] ?? entity;
        }

        const value = Number.parseInt(
          hexadecimal ?? decimal ?? "",
          hexadecimal ? 16 : 10
        );

        if (!Number.isSafeInteger(value) || value < 0 || value > 0x10ffff) {
          return entity;
        }

        return String.fromCodePoint(value);
      }
    );

    if (next === decoded) {
      break;
    }

    decoded = next;
  }

  return decoded;
}

function getGeneratedPostFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filepath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return getGeneratedPostFiles(filepath);
    }

    return entry.isFile() && entry.name.endsWith(".md") ? [filepath] : [];
  });
}

function normalizeGeneratedPostEntities(postsDir: string): number {
  if (!existsSync(postsDir)) {
    return 0;
  }

  let normalized = 0;

  for (const filepath of getGeneratedPostFiles(postsDir)) {
    const content = readFileSync(filepath, "utf-8");
    const decoded = decodeHtmlEntities(content).replace(/[ \t]+$/gm, "");

    if (decoded !== content) {
      writeFileSync(filepath, decoded, "utf-8");
      normalized++;
    }
  }

  return normalized;
}

function getExistingSourceUrls(postsDir: string): Set<string> {
  if (!existsSync(postsDir)) {
    return new Set();
  }

  const sourceUrls = new Set<string>();

  for (const filepath of getGeneratedPostFiles(postsDir)) {
    const content = readFileSync(filepath, "utf-8");
    for (const match of content.matchAll(/\]\(<(https?:\/\/[^>\s]+)>\)/g)) {
      sourceUrls.add(match[1]);
    }
  }

  return sourceUrls;
}

export async function fetchRss(url: string): Promise<ParsedRss | null> {
  for (let attempt = 1; attempt <= FEED_FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "filmtechxai-bot/1.0",
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        if (response.status < 500 && response.status !== 408 && response.status !== 429) {
          logger.error(`Failed to fetch ${url}: ${response.status}`);
          return null;
        }

        throw new Error(`HTTP ${response.status}`);
      }

      const xml = await response.text();
      if (!isFeedDocument(xml)) {
        logger.error(`Response from ${url} is not an RSS or Atom feed.`);
        return null;
      }

      const feed = parseRssXml(xml);
      if (feed.items.length === 0) {
        logger.error(`No feed items found in ${url}.`);
        return null;
      }

      return feed;
    } catch (error) {
      if (attempt === FEED_FETCH_ATTEMPTS) {
        logger.error(`Error fetching ${url}:`, error);
        return null;
      }

      logger.info(
        `  Retry ${attempt}/${FEED_FETCH_ATTEMPTS - 1} after a temporary fetch error.`
      );
    }
  }

  return null;
}

export async function fetchYoutubeVideos(
  channelId: string,
  channelName: string,
  youtubeApiKey: string
): Promise<YoutubeVideo[]> {
  try {
    const channelData = await fetchYoutubeJson(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(youtubeApiKey)}`,
      "channel"
    );
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (typeof uploadsPlaylistId !== "string") {
      logger.error(`  No upload playlist found for YouTube channel ${channelName}.`);
      return [];
    }

    const playlistData = await fetchYoutubeJson(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=3&key=${encodeURIComponent(youtubeApiKey)}`,
      "playlist"
    );
    const playlistItems = Array.isArray(playlistData.items) ? playlistData.items : [];
    const videoIds = playlistItems
      .map(item => item?.snippet?.resourceId?.videoId)
      .filter((id): id is string => typeof id === "string")
      .join(",");
    if (!videoIds) return [];

    const videoData = await fetchYoutubeJson(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoIds)}&key=${encodeURIComponent(youtubeApiKey)}`,
      "video statistics"
    );
    const viewCounts = new Map<string, string>();
    for (const video of Array.isArray(videoData.items) ? videoData.items : []) {
      const id = video?.id;
      if (typeof id === "string") {
        viewCounts.set(id, String(video?.statistics?.viewCount ?? "0"));
      }
    }

    return playlistItems.flatMap(item => {
      const snippet = item?.snippet;
      const videoId = snippet?.resourceId?.videoId;
      if (typeof videoId !== "string" || typeof snippet?.title !== "string") {
        return [];
      }

      return [
        {
          title: snippet.title,
          link: `https://www.youtube.com/watch?v=${videoId}`,
          description: typeof snippet.description === "string" ? snippet.description : "",
          pubDate:
            typeof snippet.publishedAt === "string"
              ? snippet.publishedAt
              : new Date().toISOString(),
          thumbnail:
            snippet.thumbnails?.maxres?.url ??
            snippet.thumbnails?.high?.url ??
            snippet.thumbnails?.medium?.url ??
            "",
          channelName,
          viewCount: viewCounts.get(videoId) ?? "0",
        },
      ];
    });
  } catch (error) {
    logger.error(`  Error fetching YouTube channel ${channelName}:`, error);
    return [];
  }
}

async function fetchYoutubeJson(
  url: string,
  label: string
): Promise<YouTubeApiResponse> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`YouTube ${label} request returned HTTP ${response.status}.`);
  }
  return response.json();
}

export function createSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);

  return slug || "untitled";
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function escapeFrontmatterString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ");
}

function createFrontmatter(
  title: string,
  description: string,
  pubDate: string,
  author: string,
  tags: string[],
  ogImage?: string
): string {
  return `---
title: "${escapeFrontmatterString(title)}"
description: "${escapeFrontmatterString(description.substring(0, 160))}"
pubDatetime: ${formatDate(pubDate)}
author: "${escapeFrontmatterString(author)}"
tags: [${tags.map((tag) => `"${escapeFrontmatterString(tag)}"`).join(", ")}]
ogImage: "${escapeFrontmatterString(ogImage || "")}"
featured: false
draft: false
---
`;
}

function createPostContent(
  item: RssItem | YoutubeVideo,
  source: RssSource | { name: string; category: string }
): string {
  let content = "";

  if ("channelName" in item) {
    content += markdownImage(item.title, item.thumbnail);
    content += `**Kênh:** ${toPlainText(item.channelName)} | **Lượt xem:** ${formatViewCount(item.viewCount)}\n\n`;
    content += markdownExcerpt(item.description, 500);
    content += `---\n\n*Xem video đầy đủ tại: ${markdownLink("YouTube", item.link)}*\n`;
  } else {
    content += markdownImage(item.title, item.thumbnail);
    content += markdownExcerpt(item.description || item.content || "");
    content += `---\n\n*Đọc đầy đủ tại: ${markdownLink(source.name, item.link)}*\n`;
  }

  return content;
}

function markdownImage(alt: string, url?: string): string {
  const safeUrl = toSafeExternalUrl(url);
  return safeUrl ? `![${toPlainText(alt)}](<${safeUrl}>)\n\n` : "";
}

function markdownLink(label: string, url: string): string {
  const safeUrl = toSafeExternalUrl(url);
  return safeUrl ? `[${toPlainText(label)}](<${safeUrl}>)` : toPlainText(label);
}

function markdownExcerpt(value: string, maxLength = MAX_SOURCE_EXCERPT_LENGTH): string {
  const text = toPlainText(value);
  if (!text) return "";

  const suffix = text.length > maxLength ? "..." : "";
  return `${text.slice(0, maxLength)}${suffix}\n\n`;
}

function toPlainText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([\\`*_[\]{}<>])/g, "\\$1");
}

function toSafeExternalUrl(value?: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function formatViewCount(value: string): string {
  const views = Number(value);
  return Number.isSafeInteger(views) && views >= 0 ? views.toLocaleString() : "0";
}

export async function fetchAllRss(options: { dryRun?: boolean } = {}): Promise<{
  success: number;
  failed: number;
  total: number;
}> {
  const { dryRun = false } = options;
  const postsDir = join(process.cwd(), "src/content/posts/_auto");
  const aiDir = join(postsDir, "ai");
  const filmDir = join(postsDir, "film");
  const youtubeDir = join(postsDir, "youtube");

  [postsDir, aiDir, filmDir, youtubeDir].forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  if (!dryRun) {
    const normalizedPostCount = normalizeGeneratedPostEntities(postsDir);
    if (normalizedPostCount > 0) {
      logger.info(`Normalized HTML entities in ${normalizedPostCount} generated posts.`);
      logger.info();
    }
  }

  const existingSourceUrls = getExistingSourceUrls(postsDir);

  let success = 0;
  let failed = 0;
  let total = 0;

  logger.info("Starting RSS fetch for filmtechxai...");
  logger.info();

  for (const source of RSS_SOURCES) {
    logger.info(`Fetching: ${source.name} (${source.category})`);

    const rss = await fetchRss(source.url);

    if (!rss) {
      logger.info("  Failed to fetch");
      logger.info();
      failed++;
      continue;
    }

    const recentItems = rss.items.slice(0, 3);

    for (const item of recentItems) {
      const slug = createSlug(item.title);
      const datePrefix = formatDate(item.pubDate).split("T")[0];
      const filename = `${datePrefix}-${slug}.md`;

      const targetDir = source.category === "ai" ? aiDir : filmDir;
      const filepath = join(targetDir, filename);

      if (existsSync(filepath) || existingSourceUrls.has(item.link)) {
        logger.info(`  Skipped (exists): ${filename}`);
        continue;
      }

      const tags = [
        source.category,
        source.name.toLowerCase().replace(/\s+/g, "-"),
      ];
      const frontmatter = createFrontmatter(
        item.title,
        item.description || "",
        item.pubDate || new Date().toISOString(),
        source.name,
        tags,
        toSafeExternalUrl(item.thumbnail) ?? undefined
      );
      const content = createPostContent(item, source);

      if (dryRun) {
        logger.info(`  Would create: ${filename}`);
      } else {
        writeFileSync(filepath, frontmatter + "\n" + content, "utf-8");
        existingSourceUrls.add(item.link);
        logger.info(`  Created: ${filename}`);
      }
      total++;
    }

    success++;
    logger.info();
  }

  const youtubeApiKey = getYoutubeApiKey();
  if (youtubeApiKey) {
    logger.info("Fetching YouTube channels with the free quota API...");
    logger.info();

    for (const channel of YOUTUBE_CHANNELS) {
      logger.info(`Fetching: ${channel.name}`);

      const videos = await fetchYoutubeVideos(
        channel.channelId,
        channel.name,
        youtubeApiKey
      );

    if (videos.length === 0) {
      logger.info("  No videos found");
      logger.info();
      failed++;
      continue;
    }

    for (const video of videos) {
        const slug = createSlug(video.title);
        const datePrefix = formatDate(video.pubDate).split("T")[0];
        const filename = `${datePrefix}-${slug}.md`;
        const filepath = join(youtubeDir, filename);

        if (existsSync(filepath) || existingSourceUrls.has(video.link)) {
          logger.info(`  Skipped (exists): ${filename}`);
          continue;
        }

        const tags = [
          "youtube",
          channel.name.toLowerCase().replace(/\s+/g, "-"),
          "video",
        ];
        const frontmatter = createFrontmatter(
          video.title,
          video.description,
          video.pubDate,
          channel.name,
          tags,
          toSafeExternalUrl(video.thumbnail) ?? undefined
        );
        const content = createPostContent(video, {
          name: channel.name,
          category: "youtube",
        });

        if (!dryRun) {
          writeFileSync(filepath, frontmatter + "\n" + content, "utf-8");
          existingSourceUrls.add(video.link);
        }
        logger.info(`  ${dryRun ? "Would create" : "Created"}: ${filename}`);
        total++;
    }

      success++;
      logger.info();
    }
  }

  logger.info();
  logger.info("========================================");
  logger.info(`Success: ${success} sources`);
  logger.info(`Failed: ${failed} sources`);
  logger.info(`Total posts created: ${total}`);
  logger.info("========================================");
  logger.info();

  return { success, failed, total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fetchAllRss({ dryRun: process.argv.includes("--dry-run") })
    .then((result) => {
      logger.info(`Done: ${JSON.stringify(result)}`);
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Error:", error);
      process.exit(1);
    });
}
