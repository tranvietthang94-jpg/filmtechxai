import type { Config, Context } from "@netlify/functions";
import { fetchAllRss } from "../../scripts/fetch-rss";

/**
 * Netlify Function để fetch RSS tự động
 * Chạy mỗi ngày lúc 6:00 sáng (GMT+7) = 23:00 UTC hôm trước
 */
export default async (request: Request, context: Context) => {
  console.log("⏰ Scheduled RSS fetch started at:", new Date().toISOString());

  try {
    const result = await fetchAllRss();

    return new Response(
      JSON.stringify({
        success: true,
        message: "RSS fetch completed",
        result,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error in scheduled RSS fetch:", error);

    return new Response(
      JSON.stringify({
        success: false,
        message: "RSS fetch failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

// Cấu hình schedule: chạy mỗi ngày lúc 23:00 UTC (6:00 sáng GMT+7)
export const config: Config = {
  schedule: "0 23 * * *",
};