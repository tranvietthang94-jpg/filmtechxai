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

  // ============ YOUTUBE CHANNELS ============
  // Lưu ý: YouTube RSS cần channel ID, không phải @handle
  // Format: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
  {
    name: "MKBHD",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCBcRF18a7Qf58cCRy5xuWwQ",
    category: "youtube",
    language: "en",
  },
  {
    name: "Linus Tech Tips",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXuqSBlHAE6XwvKRl5Rojg",
    category: "youtube",
    language: "en",
  },
  {
    name: "Dave2D",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCV8H1vQBMwJuTQe4YmS1PjA",
    category: "youtube",
    language: "en",
  },
  {
    name: "Mrwhosetheboss",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCMiJRAwDNSNzuYeN2eWa0lA",
    category: "youtube",
    language: "en",
  },
  {
    name: "Gerald Undone",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC0vhkS1hWQc7cK1YnKjKz1g",
    category: "youtube",
    language: "en",
  },
  {
    name: "Cinema5D",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCY1kGpU4Q0zWWw_1g-jB7AA",
    category: "youtube",
    language: "en",
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
    youtube: RSS_SOURCES.filter((s) => s.category === "youtube").length,
  };
}