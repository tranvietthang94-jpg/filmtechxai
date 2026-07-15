import assert from "node:assert/strict";
import test from "node:test";
import { OpenAiResponsesSummarizer } from "../src/lib/news/summarizer";
import type { DbClusterDetail } from "../src/lib/news/repository";

const cluster: DbClusterDetail = {
  id: "cluster-1",
  primary_raw_item_id: "item-1",
  primary_type: "press",
  canonical_title: "OpenAI releases a new vision model",
  title_vi: null,
  topic_tags: ["ai"],
  status: "ready",
  source_count: 1,
  heat_score: 40,
  is_rising: false,
  first_seen_at: "2026-07-15T09:00:00.000Z",
  last_seen_at: "2026-07-15T10:00:00.000Z",
  published_at: "2026-07-15T09:00:00.000Z",
  cluster_sources: [
    {
      is_primary: true,
      source_id: "source-1",
      raw_item_id: "item-1",
      sources: { id: "source-1", slug: "openai", name: "OpenAI", type: "press" },
      raw_items: {
        id: "item-1",
        canonical_url: "https://example.com/vision",
        original_title: "OpenAI releases a new vision model",
        original_text: "The source article describes the release.",
        image_url: null,
        author_name: null,
        published_at: "2026-07-15T09:00:00.000Z",
      },
    },
  ],
  summaries: [],
};

test("sends a structured, non-stored OpenAI summary request", async () => {
  let request: Request | undefined;
  const summarizer = new OpenAiResponsesSummarizer(
    "test-api-key",
    "test-model",
    async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        output_text: JSON.stringify({
          title_vi: "OpenAI ra mắt mô hình thị giác mới",
          short_summary: "OpenAI công bố mô hình thị giác mới.",
          detail_summary: "Bài viết nguồn mô tả việc phát hành mô hình.",
          bullets: ["Mô hình mới được công bố.", "Thông tin dựa trên bài viết nguồn."],
        }),
      });
    }
  );

  const result = await summarizer.summarize(cluster);

  assert.equal(result.model, "test-model");
  assert.equal(result.bullets.length, 2);
  assert.equal(request?.url, "https://api.openai.com/v1/responses");
  assert.equal(request?.headers.get("authorization"), "Bearer test-api-key");
  const body = (await request?.json()) as {
    model: string;
    store: boolean;
    text: { format: { type: string; strict: boolean } };
  };
  assert.equal(body.model, "test-model");
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
});

test("rejects malformed structured output", async () => {
  const summarizer = new OpenAiResponsesSummarizer(
    "test-api-key",
    "test-model",
    async () =>
      Response.json({
        output_text: JSON.stringify({
          title_vi: "Thiếu nội dung",
          short_summary: "Tóm tắt",
          detail_summary: "Chi tiết",
          bullets: [],
        }),
      })
  );

  await assert.rejects(() => summarizer.summarize(cluster), /at least two bullets/);
});
