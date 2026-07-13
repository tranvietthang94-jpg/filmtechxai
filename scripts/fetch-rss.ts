/**
 * Script fetch RSS từ các nguồn và tạo bài viết Markdown
 * Chạy tự động mỗi ngày qua Netlify Functions
 */

import { RSS_SOURCES, type RssSource } from "../src/config/sources";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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

/**
 * Parse RSS XML thành object
 */
function parseRssXml(xml: string): ParsedRss {
  const items: RssItem[] = [];

  // Extract items
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

    // Try to get thumbnail from media:content or enclosure
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

/**
 * Extract text content from XML tag
 */
function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle normal tags
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract attribute from XML tag
 */
function extractAttribute(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
}

/**
 * Strip HTML tags
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Decode HTML entities
 */
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

/**
 * Fetch RSS từ URL
 */
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
 * Tạo slug từ title
 */
function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

/**
 * Format date to ISO string
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Tạo frontmatter cho bài viết
 */
function createFrontmatter(
  title: string,
  description: string,
  pubDate: string,
  author: string,
  tags: string[],
  ogImage?: string
): string {
  const frontmatter = {
    title: title.replace(/"/g, '\\"'),
    description: description.substring(0, 160).replace(/"/g, '\\"'),
    pubDatetime: formatDate(pubDate),
    author: author.replace(/"/g, '\\"'),
    tags,
    ogImage: ogImage || "",
    featured: false,
    draft: false,
  };

  return `---
title: "${frontmatter.title}"
description: "${frontmatter.description}"
pubDatetime: ${frontmatter.pubDatetime}
author: "${frontmatter.author}"
tags: [${frontmatter.tags.map((t) => `"${t}"`).join(", ")}]
ogImage: "${frontmatter.ogImage}"
featured: ${frontmatter.featured}
draft: ${frontmatter.draft}
---
`;
}

/**
 * Tạo nội dung bài viết từ RSS item
 */
function createPostContent(item: RssItem, source: RssSource): string {
  let content = "";

  // Add thumbnail if available
  if (item.thumbnail) {
    content += `![${item.title}](${item.thumbnail})\n\n`;
  }

  // Add description
  if (item.description) {
    content += `${item.description}\n\n`;
  }

  // Add full content if available
  if (item.content && item.content.length > item.description.length) {
    content += `${item.content}\n\n`;
  }

  // Add source link
  content += `---\n\n*Đọc đầy đủ tại: [${source.name}](${item.link})*\n`;

  return content;
}

/**
 * Fetch tất cả RSS và tạo bài viết
 */
export async function fetchAllRss(): Promise<{ success: number; failed: number; total: number }> {
  const postsDir = join(process.cwd(), "src/content/posts/_auto");
  const aiDir = join(postsDir, "ai");
  const filmDir = join(postsDir, "film");
  const youtubeDir = join(postsDir, "youtube");

  // Create directories if not exist
  [postsDir, aiDir, filmDir, youtubeDir].forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  let success = 0;
  let failed = 0;
  let total = 0;

  console.log("🚀 Starting RSS fetch for filmtechxai...\n");

  for (const source of RSS_SOURCES) {
    console.log(`📡 Fetching: ${source.name} (${source.category})`);

    const rss = await fetchRss(source.url);

    if (!rss) {
      console.log(`  ❌ Failed to fetch\n`);
      failed++;
      continue;
    }

    // Get only the 3 most recent items from each source
    const recentItems = rss.items.slice(0, 3);

    for (const item of recentItems) {
      const slug = createSlug(item.title);
      const date = new Date(item.pubDate || Date.now());
      const datePrefix = date.toISOString().split("T")[0];
      const filename = `${datePrefix}-${slug}.md`;

      // Determine directory based on category
      const targetDir =
        source.category === "ai" ? aiDir : source.category === "film" ? filmDir : youtubeDir;

      const filepath = join(targetDir, filename);

      // Skip if file already exists
      if (existsSync(filepath)) {
        console.log(`  ⏭️  Skipped (exists): ${filename}`);
        continue;
      }

      // Create tags
      const tags = [source.category, source.name.toLowerCase().replace(/\s+/g, "-")];
      if (source.category === "youtube") {
        tags.push("video");
      }

      // Create frontmatter
      const frontmatter = createFrontmatter(
        item.title,
        item.description || "",
        item.pubDate || new Date().toISOString(),
        source.name,
        tags,
        item.thumbnail
      );

      // Create content
      const content = createPostContent(item, source);

      // Write file
      const fullContent = frontmatter + "\n" + content;
      writeFileSync(filepath, fullContent, "utf-8");

      console.log(`  ✅ Created: ${filename}`);
      total++;
    }

    success++;
    console.log("");
  }

  console.log("\n========================================");
  console.log(`✅ Success: ${success}/${RSS_SOURCES.length} sources`);
  console.log(`❌ Failed: ${failed}/${RSS_SOURCES.length} sources`);
  console.log(`📝 Total posts created: ${total}`);
  console.log("========================================\n");

  return { success, failed, total };
}

// Run if called directly
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