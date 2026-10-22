import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inferRegion,
  mapRows,
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

test("rejects empty sheets and schemas with no title field", () => {
  assert.equal(mapRows([]).articles.length, 0);
  assert.equal(mapRows([["Columna"], ["dato"]]).rejectedRows, 1);
});

test("handles null cells, invalid dates, and unsafe source links", () => {
  const rows = mapRows([headers, [
    "31/02/2026", "PHẦN B", "Công nghệ", "Tiêu đề", null, null, null, "javascript:alert(1)",
  ]]);
  assert.equal(rows.articles.length, 1);
  assert.equal(rows.articles[0].sheetUpdatedAt, undefined);
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
