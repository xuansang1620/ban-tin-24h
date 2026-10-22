import type { NewsArticle } from "../types/news";

export type DateFilter = "today" | "last24" | "yesterday" | "all";

export function normalizeVietnamese(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi")
    .trim();
}

export function getLocalDateKey(value: string | Date, timeZone = "Asia/Ho_Chi_Minh"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function parseSheetDate(value?: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatVietnameseDate(value?: string, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "Chưa có dữ liệu";
  const date = parseSheetDate(value) ?? new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có dữ liệu";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  }).format(date);
}

export function matchesDateFilter(article: NewsArticle, filter: DateFilter, now = new Date()): boolean {
  if (filter === "all") return true;
  if (filter === "last24") {
    if (!article.publishedAt) return false;
    const published = new Date(article.publishedAt).getTime();
    return published <= now.getTime() && published >= now.getTime() - 24 * 60 * 60 * 1000;
  }

  const dateValue = article.publishedAt ?? article.sheetUpdatedAt ?? article.collectedAt;
  if (!dateValue) return false;
  const date = article.publishedAt ? getLocalDateKey(dateValue) : dateValue.slice(0, 10);
  const today = getLocalDateKey(now);
  const reference = new Date(`${today}T12:00:00Z`);
  reference.setUTCDate(reference.getUTCDate() - 1);
  const yesterday = reference.toISOString().slice(0, 10);
  return filter === "today" ? date === today : date === yesterday;
}

export function searchArticles(articles: NewsArticle[], query: string): NewsArticle[] {
  const term = normalizeVietnamese(query);
  if (!term) return articles;
  return articles.filter((article) =>
    [
      article.title,
      article.summary,
      article.source,
      article.category,
      ...article.tags,
    ]
      .filter(Boolean)
      .some((value) => normalizeVietnamese(value ?? "").includes(term)),
  );
}

export function isSafeHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function getUniqueValues(articles: NewsArticle[], selector: (article: NewsArticle) => string | undefined): string[] {
  return [...new Set(articles.map(selector).filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
}

export function sortArticles(articles: NewsArticle[], direction: "newest" | "oldest"): NewsArticle[] {
  return [...articles].sort((a, b) => {
    const value = (article: NewsArticle) =>
      article.publishedAt ? new Date(article.publishedAt).getTime() : Date.parse(`${article.sheetUpdatedAt ?? "1970-01-01"}T00:00:00+07:00`);
    return direction === "newest" ? value(b) - value(a) : value(a) - value(b);
  });
}
