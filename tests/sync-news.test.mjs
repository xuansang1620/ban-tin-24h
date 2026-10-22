import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inferRegion,
  extractOpenGraphImage,
  isPublicHttpUrl,
  fetchOpenGraphImage,
  mapRows,
  mergeArticles,
  normalizeHeader,
  parseSheetDate,
  safeSourceUrl,
  synchronizeNews,
} from "../scripts/sync-news.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const headers = [
  "Ngày cập nhật (Date)",
  "Phần (Section)",
  "Mục / Lĩnh vực (Category)",
  "Tiêu đề (Headline)",
  "Thông tin chính & Số liệu (Main Information & Figures)",
  "Bối cảnh / Nguyên nhân (Context & Background)",
  "Tác động / Cơ hội & Rủi ro (Impact, Opportunities & Risks)",
  "Link bài gốc (Source URL)",
];

test("maps the observed sheet schema without treating its date as publication time", () => {
  const mapped = mapRows([headers, [
    "22/10/2026", "PHẦN A – TOP 5 TIN QUAN TRỌNG", "Top 5 Tin ngày",
    "Tiêu đề thật", "Tóm tắt thật", "Bối cảnh", "Tác động", "Xem nguồn",
  ]]);
  assert.equal(mapped.articles.length, 1);
  assert.equal(mapped.articles[0].category, "Top 5 Tin ngày");
  assert.equal(mapped.articles[0].sheetUpdatedAt, "2026-10-22");
  assert.equal(mapped.articles[0].publishedAt, undefined);
  assert.equal(mapped.articles[0].sourceUrl, undefined);
  assert.equal(mapped.articles[0].analysis, "Bối cảnh\nTác động");
  assert.equal(mapped.articles[0].importance, 5);
  assert.equal(mapped.articles[0].sourceRow, 2);
});

test("maps optional image URL columns without accepting unsafe image links", () => {
  const imageHeaders = [...headers, "Ảnh minh họa (Image URL)"];
  const valid = mapRows([imageHeaders, [
    "22/10/2026", "PHẦN B", "Công nghệ", "Tin có ảnh", "Tóm tắt", "", "",
    "https://example.com/story", "https://images.example.com/story.jpg",
  ]]);
  const unsafe = mapRows([imageHeaders, [
    "22/10/2026", "PHẦN B", "Công nghệ", "Tin ảnh không an toàn", "Tóm tắt", "", "",
    "https://example.com/story-2", "javascript:alert(1)",
  ]]);
  assert.equal(valid.articles[0].imageUrl, "https://images.example.com/story.jpg");
  assert.equal(unsafe.articles[0].imageUrl, undefined);
});

test("extracts a safe Open Graph thumbnail URL from source page metadata", () => {
  const html = '<html><head><meta content="../thumb.jpg?size=large&amp;v=2" property="og:image"></head></html>';
  assert.equal(
    extractOpenGraphImage(html, "https://publisher.example/news/story"),
    "https://publisher.example/thumb.jpg?size=large&v=2",
  );
  assert.equal(
    extractOpenGraphImage('<meta property="og:image" content="javascript:alert(1)">', "https://publisher.example/story"),
    undefined,
  );
});

test("blocks private metadata addresses and validates public DNS results", async () => {
  assert.equal(await isPublicHttpUrl("http://127.0.0.1/image.jpg"), false);
  assert.equal(await isPublicHttpUrl("https://example.com/image.jpg", async () => [{ address: "203.0.113.10" }]), false);
  assert.equal(await isPublicHttpUrl("https://example.com/image.jpg", async () => [{ address: "93.184.216.34" }]), true);
});

test("reads Open Graph image metadata from public source pages", async () => {
  const calls = [];
  const page = async (url, options) => {
    calls.push({ url, redirect: options.redirect });
    return new Response('<meta property="og:image" content="https://images.example.com/story.jpg">', {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
  const image = await fetchOpenGraphImage(
    "https://publisher.example/story",
    page,
    async () => [{ address: "93.184.216.34" }],
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].redirect, "manual");
  assert.deepEqual(image, { status: "found", imageUrl: "https://images.example.com/story.jpg" });
});

test("does not follow a redirect to a private network address", async () => {
  let calls = 0;
  const page = async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/latest/meta-data" } });
  };
  const result = await fetchOpenGraphImage(
    "https://publisher.example/story",
    page,
    async (hostname) => hostname === "publisher.example"
      ? [{ address: "93.184.216.34" }]
      : [{ address: "127.0.0.1" }],
  );
  assert.equal(calls, 1);
  assert.equal(result, undefined);
});

test("deduplicates repeated rows and infers region only from available text", () => {
  const row = [
    "22/10/2026", "PHẦN B", "Kinh tế", "VN-Index phục hồi",
    "Thị trường Việt Nam tăng điểm", "", "", "Xem nguồn",
  ];
  const mapped = mapRows([headers, row, row]);
  assert.equal(mapped.articles.length, 1);
  assert.equal(mapped.duplicates, 1);
  assert.equal(mapped.articles[0].region, "Việt Nam");
  assert.equal(inferRegion("Một bài viết không nêu khu vực nào"), undefined);
});

test("keeps distinct headlines that share a source URL", () => {
  const first = [
    "22/10/2026", "PHẦN B", "Xã hội", "Tiêu đề thứ nhất",
    "Tóm tắt thứ nhất", "", "", "https://example.com/daily-roundup",
  ];
  const second = [
    "22/10/2026", "PHẦN B", "Xã hội", "Tiêu đề thứ hai",
    "Tóm tắt thứ hai", "", "", "https://example.com/daily-roundup",
  ];
  const mapped = mapRows([headers, first, second]);
  assert.equal(mapped.articles.length, 2);
  assert.equal(mapped.duplicates, 0);
});

test("adding source URLs updates legacy records instead of creating duplicates", () => {
  const legacy = {
    id: "legacy",
    title: "Một tin thật",
    sheetUpdatedAt: "2026-10-22",
    tags: [],
    language: "vi",
  };
  const updated = {
    ...legacy,
    id: "url-based-id",
    sourceUrl: "https://example.com/story",
  };
  const merged = mergeArticles([legacy, { ...legacy }], [updated]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "url-based-id");
  assert.equal(merged[0].sourceUrl, "https://example.com/story");
});

test("updates an existing URL/title when the Sheet stops providing its date", () => {
  const previous = {
    id: "dated-record",
    title: "Tin cập nhật",
    sheetUpdatedAt: "2026-10-22",
    sourceUrl: "https://example.com/story",
    imageUrl: "https://example.com/image.jpg",
    imageLookupAt: "2026-10-22T06:00:00.000Z",
    imageLookupStatus: "found",
    tags: [],
    language: "vi",
  };
  const incoming = {
    ...previous,
    id: "undated-record",
    sheetUpdatedAt: undefined,
    collectedAt: "2026-10-22T07:00:00.000Z",
    sourceRow: 42,
  };
  const merged = mergeArticles([previous], [incoming]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "undated-record");
  assert.equal(merged[0].imageUrl, previous.imageUrl);
  assert.equal(merged[0].imageLookupAt, previous.imageLookupAt);
});

test("rejects empty sheets and schemas with no title field", () => {
  assert.equal(mapRows([]).articles.length, 0);
  assert.equal(mapRows([["Columna"], ["dato"]]).rejectedRows, 1);
});

test("handles null cells, invalid dates, and unsafe source links", () => {
  const rows = mapRows([headers, [
    "31/02/2026", "PHẦN B", "Công nghệ", "Tiêu đề", null, null, null, "javascript:alert(1)",
  ]], new Date("2026-10-22T06:00:00.000Z"));
  assert.equal(rows.articles.length, 1);
  assert.equal(rows.articles[0].sheetUpdatedAt, undefined);
  assert.equal(rows.articles[0].collectedAt, "2026-10-22T06:00:00.000Z");
  assert.equal(rows.articles[0].summary, "");
  assert.equal(rows.articles[0].sourceUrl, undefined);
  assert.equal(rows.rejectedRows, 0);
});

test("normalizes schema names and accepts only safe HTTP links", () => {
  assert.equal(normalizeHeader("  Tiêu đề (Headline) "), "tieu de headline");
  assert.equal(parseSheetDate("22/10/2026"), "2026-10-22");
  assert.equal(parseSheetDate("31/02/2026"), undefined);
  assert.equal(safeSourceUrl("Xem nguồn"), undefined);
  assert.equal(safeSourceUrl("https://example.com/a"), "https://example.com/a");
});

test("network failure does not modify the current dataset", async () => {
  const dataFile = path.join(projectRoot, "public", "data", "news.json");
  const before = await readFile(dataFile, "utf8");
  await assert.rejects(
    synchronizeNews({ fetchData: async () => { throw new Error("network unavailable"); } }),
    /network unavailable/,
  );
  assert.equal(await readFile(dataFile, "utf8"), before);
});

test("an empty sheet does not replace the current dataset", async () => {
  const dataFile = path.join(projectRoot, "public", "data", "news.json");
  const before = await readFile(dataFile, "utf8");
  await assert.rejects(
    synchronizeNews({ fetchData: async () => [] }),
    /Sheet rỗng/,
  );
  assert.equal(await readFile(dataFile, "utf8"), before);
});
