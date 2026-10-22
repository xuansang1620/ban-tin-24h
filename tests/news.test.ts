import { describe, expect, it } from "vitest";
import {
  getLocalDateKey,
  isSafeHttpUrl,
  matchesDateFilter,
  normalizeVietnamese,
  searchArticles,
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
});
