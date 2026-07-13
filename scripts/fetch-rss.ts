/**
 * Script fetch RSS từ các nguồn và tạo bài viết Markdown
 * Chạy tự động mỗi ngày qua Netlify Functions
 */

import { RSS_SOURCES, YOUTUBE_CHANNELS, type RssSource } from "../src/config/sources";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "AIzaSyCqvCS_QkHxD7AF_KqNrvo4Q37kFtzi1SE";

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  creator?: string;
  content?: string;
  thumbnail?: string;
}

interface ParsedRss {
  title: string;
  link: string;
  items: RssItem[];
}

interface YoutubeVideo {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  thumbnail: string;
  channelName: string;
  viewCount: string;
}

/**
 * Parse RSS XML thành object
 */
function parseRssXml(xml: string): ParsedRss {
  const items: RssItem[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, "title") ?? "";
    const link = extractTag(itemXml, "link") ?? "";
    const description = extractTag(itemXml, "description") ?? "";
    const pubDate = extractTag(itemXml, "pubDate") ?? extractTag(itemXml, "dc:date") ?? "";
    const creator = extractTag(itemXml, "dc:creator") ?? undefined;
    const content = extractTag(itemXml, "content:encoded") ?? extractTag(itemXml, "content") ?? undefined;

    const thumbnail =
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
        content: content ? stripHtml(content) : undefined,
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
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractAttribute(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

async function fetchRss(url: string): Promise<ParsedRss | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "filmtechxai-bot/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const xml = await response.text();
    return parseRssXml(xml);
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Fetch YouTube videos using YouTube Data API v3
 */
async function fetchYoutubeVideos(channelId: string, channelName: string): Promise<YoutubeVideo[]> {
  try {
    // Get uploads playlist ID
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const channelRes = await fetch(channelUrl);
    const channelData = await channelRes.json();

    if (!channelData.items || channelData.items.length === 0) {
      console.error(`  No channel found for ID: ${channelId}`);
      return [];
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Get videos from uploads playlist
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=3&key=${YOUTUBE_API_KEY}`;
    const playlistRes = await fetch(playlistUrl);
    const playlistData = await playlistRes.json();

    if (!playlistData.items) return [];

    // Get video details (view count)
    const videoIds = playlistData.items.map((item: any) => item.snippet.resourceId.videoId).join(",");
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    const videoRes = await fetch(videoUrl);
    const videoData = await videoRes.json();

    const viewCounts: Record<string, string> = {};
    if (videoData.items) {
      for (const video of videoData.items) {
        viewCounts[video.id] = video.statistics.viewCount || "0";
      }
    }

    return playlistData.items.map((item: any) => ({
      title: item.snippet.title,
      link: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
      description: item.snippet.description || "",
      pubDate: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || "",
      channelName,
      viewCount: viewCounts[item.snippet.resourceId.videoId] || "0",
    }));
  } catch (error) {
    console.error(`  Error fetching YouTube channel ${channelName}:`, error);
    return [];
  }
}

function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
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
title: "${title.replace(/"/g, '\\"')}"
description: "${description.substring(0, 160).replace(/"/g, '\\"')}"
pubDatetime: ${formatDate(pubDate)}
author: "${author.replace(/"/g, '\\"')}"
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
ogImage: "${ogImage || ""}"
featured: false
draft: false
---
`;
}

function createPostContent(item: RssItem | YoutubeVideo, source: RssSource | { name: string; category: string }): string {
  let content = "";

  if ("viewCount" in item) {
    // YouTube video
    const views = parseInt(item.viewCount).toLocaleString();
    content += `![${item.title}](${item.thumbnail})\n\n`;
    content += `**Kênh:** ${item.channelName} | **Lượt xem:** ${views}\n\n`;
    if (item.description) {
      content += `${item.description.substring(0, 500)}...\n\n`;
    }
    content += `---\n\n*Xem video đầy đủ tại: [YouTube](${item.link})*\n`;
  } else {
    // RSS article
    if (item.thumbnail) {
      content += `![${item.title}](${item.thumbnail})\n\n`;
    }
    if (item.description) {
      content += `${item.description}\n\n`;
    }
    if (item.content && item.content.length > item.description.length) {
      content += `${item.content}\n\n`;
    }
    content += `---\n\n*Đọc đầy đủ tại: [${source.name}](${item.link})*\n`;
  }

  return content;
}

export async function fetchAllRss(): Promise<{ success: number; failed: number; total: number }> {
  const postsDir = join(process.cwd(), "src/content/posts/_auto");
  const aiDir = join(postsDir, "ai");
  const filmDir = join(postsDir, "film");
  const youtubeDir = join(postsDir, "youtube");

  [postsDir, aiDir, filmDir, youtubeDir].forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  let success = 0;
  let failed = 0;
  let total = 0;

  console.log(" Starting RSS fetch for filmtechxai...\n");

  // Fetch RSS sources
  for (const source of RSS_SOURCES) {
    console.log(` Fetching: ${source.name} (${source.category})`);

    const rss = await fetchRss(source.url);

    if (!rss) {
      console.log(`  ❌ Failed to fetch\n`);
      failed++;
      continue;
    }

    const recentItems = rss.items.slice(0, 3);

    for (const item of recentItems) {
      const slug = createSlug(item.title);
      const date = new Date(item.pubDate || Date.now());
      const datePrefix = date.toISOString().split("T")[0];
      const filename = `${datePrefix}-${slug}.md`;

      const targetDir = source.category === "ai" ? aiDir : filmDir;
      const filepath = join(targetDir, filename);

      if (existsSync(filepath)) {
        console.log(`  ⏭️  Skipped (exists): ${filename}`);
        continue;
      }

      const tags = [source.category, source.name.toLowerCase().replace(/\s+/g, "-")];
      const frontmatter = createFrontmatter(item.title, item.description || "", item.pubDate || new Date().toISOString(), source.name, tags, item.thumbnail);
      const content = createPostContent(item, source);

      writeFileSync(filepath, frontmatter + "\n" + content, "utf-8");
      console.log(`  ✅ Created: ${filename}`);
      total++;
    }

    success++;
    console.log("");
  }

  // Fetch YouTube channels
  console.log("📺 Fetching YouTube channels...\n");
  for (const channel of YOUTUBE_CHANNELS) {
    console.log(`📺 Fetching: ${channel.name}`);

    const videos = await fetchYoutubeVideos(channel.channelId, channel.name);

    if (videos.length === 0) {
      console.log(`  ❌ No videos found\n`);
      failed++;
      continue;
    }

    for (const video of videos) {
      const slug = createSlug(video.title);
      const date = new Date(video.pubDate);
      const datePrefix = date.toISOString().split("T")[0];
      const filename = `${datePrefix}-${slug}.md`;
      const filepath = join(youtubeDir, filename);

      if (existsSync(filepath)) {
        console.log(`  ⏭️  Skipped (exists): ${filename}`);
        continue;
      }

      const tags = ["youtube", channel.name.toLowerCase().replace(/\s+/g, "-"), "video"];
      const frontmatter = createFrontmatter(video.title, video.description, video.pubDate, channel.name, tags, video.thumbnail);
      const content = createPostContent(video, { name: channel.name, category: "youtube" });

      writeFileSync(filepath, frontmatter + "\n" + content, "utf-8");
      console.log(`  ✅ Created: ${filename} (${parseInt(video.viewCount).toLocaleString()} views)`);
      total++;
    }

    success++;
    console.log("");
  }

  console.log("\n========================================");
  console.log(`✅ Success: ${success} sources`);
  console.log(`❌ Failed: ${failed} sources`);
  console.log(`📝 Total posts created: ${total}`);
  console.log("========================================\n");

  return { success, failed, total };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAllRss()
    .then((result) => {
      console.log("Done!", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}