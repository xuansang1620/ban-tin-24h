import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inferRegion,
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
  assert.equal(valid.articles[0].imageUrlSource, "sheet");
  assert.equal(unsafe.articles[0].imageUrl, undefined);
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
  assert.equal(merged[0].imageUrl, undefined);
  assert.equal(merged[0].imageLookupAt, undefined);
});

test("cleans unverified historical images but preserves explicit Sheet images", () => {
  const merged = mergeArticles([
    {
      id: "legacy",
      title: "Tin cũ",
      sheetUpdatedAt: "2026-10-22",
      imageUrl: "https://example.com/old-image.jpg",
      imageLookupStatus: "found",
    },
    {
      id: "sheet-image",
      title: "Tin có ảnh riêng",
      sheetUpdatedAt: "2026-10-22",
      imageUrl: "https://example.com/sheet-image.jpg",
      imageUrlSource: "sheet",
    },
  ], []);
  assert.equal(merged.find((article) => article.id === "legacy").imageUrl, undefined);
  assert.equal(merged.find((article) => article.id === "legacy").imageLookupStatus, undefined);
  assert.equal(merged.find((article) => article.id === "sheet-image").imageUrl, "https://example.com/sheet-image.jpg");
});

test("clearing an image URL in the Sheet removes the previous image", () => {
  const previous = {
    id: "record",
    title: "Tin có ảnh",
    sheetUpdatedAt: "2026-10-22",
    imageUrl: "https://example.com/sheet-image.jpg",
    imageUrlSource: "sheet",
  };
  const incoming = { ...previous, imageUrl: undefined, imageUrlSource: undefined };
  const merged = mergeArticles([previous], [incoming]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].imageUrl, undefined);
  assert.equal(merged[0].imageUrlSource, undefined);
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
