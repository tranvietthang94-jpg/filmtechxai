/**
 * Danh sách nguồn RSS cho filmtechXAI
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
    name: "AWS Machine Learning Blog",
    url: "https://aws.amazon.com/blogs/machine-learning/feed/",
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
    name: "Newsshooter",
    url: "https://www.newsshooter.com/feed/",
    category: "film",
    language: "en",
  },
  {
    name: "CineD",
    url: "https://www.cined.com/feed/",
    category: "film",
    language: "en",
  },
  {
    name: "ProVideo Coalition",
    url: "https://www.provideocoalition.com/feed/",
    category: "film",
    language: "en",
  },
  {
    name: "fxguide",
    url: "https://www.fxguide.com/feed/",
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
    name: "Y.M.Cinema",
    url: "https://ymcinema.com/feed/",
    category: "film",
    language: "en",
  },
  {
    name: "Filmmaker Magazine",
    url: "https://www.filmmakermagazine.com/feed/",
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
    channelId: "UCXuqSBlHAE6Xw-yeJA0Tunw",
    category: "youtube",
  },
  {
    name: "Dave2D",
    channelId: "UCVYamHliCI9rw1tHR1xbkfw",
    category: "youtube",
  },
  {
    name: "Mrwhosetheboss",
    channelId: "UCMiJRAwDNSNzuYeN2uWa0pA",
    category: "youtube",
  },
  {
    name: "Gerald Undone",
    channelId: "UC09qASY4ixFS-KXIH6Nw0rg",
    category: "youtube",
  },
  {
    name: "CineD",
    channelId: "UCNz7Bd4cOw7f19Sz6nQjZNQ",
    category: "youtube",
  },
];

/**
 * Lấy danh sách nguồn theo category
 */
export function getSourcesByCategory(
  category: "ai" | "film" | "youtube"
): RssSource[] {
  return RSS_SOURCES.filter(source => source.category === category);
}

/**
 * Đếm số nguồn theo category
 */
export function countSourcesByCategory(): {
  ai: number;
  film: number;
  youtube: number;
} {
  return {
    ai: RSS_SOURCES.filter(s => s.category === "ai").length,
    film: RSS_SOURCES.filter(s => s.category === "film").length,
    youtube: YOUTUBE_CHANNELS.length,
  };
}
