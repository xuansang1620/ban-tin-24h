import { describe, expect, it } from "vitest";
import {
  groupArticlesByDay,
  getLocalDateKey,
  isSafeHttpUrl,
  matchesDateFilter,
  normalizeVietnamese,
  searchArticles,
  sortArticles,
} from "../src/lib/news";
import type { NewsArticle } from "../src/types/news";

const article: NewsArticle = {
  id: "1",
  title: "Công nghệ Việt Nam",
  summary: "Tin mới",
  category: "Công nghệ",
  sheetUpdatedAt: "2026-10-22",
  tags: ["AI"],
  language: "vi",
};

describe("news utilities", () => {
  it("searches Vietnamese with and without diacritics", () => {
    expect(normalizeVietnamese("Đổi mới sáng tạo")).toBe("doi moi sang tao");
    expect(searchArticles([article], "cong nghe viet nam")).toHaveLength(1);
  });

  it("uses Ho Chi Minh local calendar dates", () => {
    expect(getLocalDateKey("2026-10-21T17:30:00.000Z")).toBe("2026-10-22");
  });

  it("distinguishes the sheet update day from a published timestamp", () => {
    const now = new Date("2026-10-22T03:00:00.000Z");
    expect(matchesDateFilter(article, "today", now)).toBe(true);
    expect(matchesDateFilter(article, "yesterday", now)).toBe(false);
    expect(matchesDateFilter({ ...article, sheetUpdatedAt: "2026-10-21" }, "yesterday", now)).toBe(true);
    expect(matchesDateFilter(article, "last24", now)).toBe(false);
  });

  it("accepts only HTTP(S) URLs", () => {
    expect(isSafeHttpUrl("https://example.com/story")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("not a URL")).toBe(false);
  });

  it("puts the last spreadsheet row first and groups records by local day", () => {
    const rows = [
      { ...article, id: "older-day", sheetUpdatedAt: "2026-10-21", sourceRow: 30 },
      { ...article, id: "row-2", sourceRow: 2 },
      { ...article, id: "row-10", sourceRow: 10 },
    ];
    const sorted = sortArticles(rows, "newest");
    expect(sorted.map((item) => item.id)).toEqual(["row-10", "row-2", "older-day"]);
    const groups = groupArticlesByDay(sorted);
    expect(groups.map((group) => [group.key, group.articles.length])).toEqual([
      ["2026-10-22", 2],
      ["2026-10-21", 1],
    ]);
    expect(groups[0].label).toContain("22 tháng 10");
  });
});
