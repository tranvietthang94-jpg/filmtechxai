/**
 * Danh sách nguồn RSS cho filmtechxai
 * Tự động fetch tin tức AI và thiết bị ngành Film mỗi ngày
 */

export interface RssSource {
  name: string;
  url: string;
  category: "ai" | "film" | "youtube";
  language?: "vi" | "en";
}

export interface YoutubeChannel {
  name: string;
  channelId: string;
  category: "youtube";
}

export const RSS_SOURCES: RssSource[] = [
  // ============ AI NEWS ============
  {
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
    category: "ai",
    language: "en",
  },
  {
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    category: "ai",
    language: "en",
  },
  {
    name: "Anthropic",
    url: "https://www.anthropic.com/rss.xml",
    category: "ai",
    language: "en",
  },
  {
    name: "Hugging Face",
    url: "https://huggingface.co/blog/feed.xml",
    category: "ai",
    language: "en",
  },
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    category: "ai",
    language: "en",
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    category: "ai",
    language: "en",
  },
  {
    name: "Ars Technica AI",
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    category: "ai",
    language: "en",
  },
  {
    name: "MIT Technology Review AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    category: "ai",
    language: "en",
  },
  {
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    category: "ai",
    language: "en",
  },
  {
    name: "AI News",
    url: "https://www.artificialintelligence-news.com/feed/",
    category: "ai",
    language: "en",
  },

  // ============ FILM & VIDEO TECH ============
  {
    name: "PetaPixel",
    url: "https://petapixel.com/feed/",
    category: "film",
    language: "en",
  },
  {
    name: "DPReview",
    url: "https://www.dpreview.com/feeds/news/latest",
    category: "film",
    language: "en",
  },
  {
    name: "No Film School",
    url: "https://nofilmschool.com/rss.xml",
    category: "film",
    language: "en",
  },
  {
    name: "Cinema5D",
    url: "https://cine5d.com/feed/",
    category: "film",
    language: "en",
  },
  {
    name: "Red Shark News",
    url: "https://www.redsharknews.com/feed",
    category: "film",
    language: "en",
  },
  {
    name: "Filmmaker IQ",
    url: "https://filmmakeriq.com/feed/",
    category: "film",
    language: "en",
  },
  {
    name: "Shotdeck",
    url: "https://shotdeck.com/blog/feed/",
    category: "film",
    language: "en",
  },
  {
    name: "StudioBinder",
    url: "https://www.studiobinder.com/blog/feed/",
    category: "film",
    language: "en",
  },
];

// YouTube channels với channel ID chính xác
export const YOUTUBE_CHANNELS: YoutubeChannel[] = [
  {
    name: "MKBHD",
    channelId: "UCBJycsmduvYEL83R_U4JriQ",
    category: "youtube",
  },
  {
    name: "Linus Tech Tips",
    channelId: "UCXuqSBlHAE6Xw-yeVR0TjDw",
    category: "youtube",
  },
  {
    name: "Dave2D",
    channelId: "UCVYamHliCI9rw1tHR1xbkfw",
    category: "youtube",
  },
  {
    name: "Mrwhosetheboss",
    channelId: "UCMiJRAwDNSNzuYeN2eWa0lA",
    category: "youtube",
  },
  {
    name: "Gerald Undone",
    channelId: "UC0vhkS1hWQc7cK1YnKjKz1g",
    category: "youtube",
  },
  {
    name: "Cinema5D",
    channelId: "UCY1kGpU4Q0zWWw_1g-jB7AA",
    category: "youtube",
  },
];

/**
 * Lấy danh sách nguồn theo category
 */
export function getSourcesByCategory(category: "ai" | "film" | "youtube"): RssSource[] {
  return RSS_SOURCES.filter((source) => source.category === category);
}

/**
 * Đếm số nguồn theo category
 */
export function countSourcesByCategory(): { ai: number; film: number; youtube: number } {
  return {
    ai: RSS_SOURCES.filter((s) => s.category === "ai").length,
    film: RSS_SOURCES.filter((s) => s.category === "film").length,
    youtube: YOUTUBE_CHANNELS.length,
  };
}