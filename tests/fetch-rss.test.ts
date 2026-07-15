import assert from "node:assert/strict";
import test from "node:test";
import {
  createSlug,
  decodeHtmlEntities,
  formatDate,
  isFeedDocument,
  parseRssXml,
} from "../scripts/fetch-rss";

test("parses RSS items and normalizes their HTML fields", () => {
  const feed = parseRssXml(`
    <rss version="2.0">
      <channel>
        <title>Example feed</title>
        <item>
          <title><![CDATA[Camera &amp; AI]]></title>
          <link>https://example.com/post</link>
          <description><![CDATA[<p>A &amp; B</p>]]></description>
          <pubDate>2026-07-15T09:00:00Z</pubDate>
          <dc:creator>Example Author</dc:creator>
          <media:content url="https://example.com/cover.jpg" />
        </item>
      </channel>
    </rss>
  `);

  assert.equal(feed.title, "Example feed");
  assert.deepEqual(feed.items, [
    {
      title: "Camera & AI",
      link: "https://example.com/post",
      description: "A & B",
      pubDate: "2026-07-15T09:00:00Z",
      creator: "Example Author",
      content: undefined,
      thumbnail: "https://example.com/cover.jpg",
    },
  ]);
});

test("decodes numeric and double-encoded HTML entities from feeds", () => {
  assert.equal(
    decodeHtmlEntities("Women&#8217;s &amp;#8216;film&#8217; &ndash; A&nbsp;B"),
    "Women’s ‘film’ – A B"
  );
  assert.equal(decodeHtmlEntities("&#x1F3AC;"), "🎬");
  assert.equal(decodeHtmlEntities("&#x110000;"), "&#x110000;");
});

test("parses Atom entries with link attributes and summary dates", () => {
  const feed = parseRssXml(`
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom feed</title>
      <entry>
        <title>Atom post</title>
        <link href="https://example.com/atom-post" />
        <summary><![CDATA[<p>Atom summary</p>]]></summary>
        <published>2026-07-15T10:00:00Z</published>
      </entry>
    </feed>
  `);

  assert.deepEqual(feed.items, [
    {
      title: "Atom post",
      link: "https://example.com/atom-post",
      description: "Atom summary",
      pubDate: "2026-07-15T10:00:00Z",
      creator: undefined,
      content: undefined,
      thumbnail: undefined,
    },
  ]);
});

test("rejects non-feed documents and safely normalizes unsafe filenames", () => {
  assert.equal(isFeedDocument("<html><body>Blocked</body></html>"), false);
  assert.equal(isFeedDocument("<feed><title>Atom</title></feed>"), true);
  assert.equal(createSlug("  Camera   Test!  "), "camera-test");
  assert.equal(createSlug("!!!"), "untitled");
});

test("uses the current time when a source supplies an invalid date", () => {
  const normalizedDate = formatDate("not-a-date");
  assert.equal(Number.isNaN(Date.parse(normalizedDate)), false);
});
