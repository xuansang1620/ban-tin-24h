import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "public", "data");
const spreadsheetId = process.env.GOOGLE_SHEETS_ID || "1BKvEFsK-SjtW0CPBylrXOWSNIo7vDEWhEFemPsOs--Y";
const sheetGid = process.env.GOOGLE_SHEETS_GID || "0";
const sheetRange = process.env.GOOGLE_SHEETS_RANGE || "A:Z";
const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
const publicCsvUrl = `${spreadsheetUrl}/export?format=csv&gid=${encodeURIComponent(sheetGid)}`;
const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
const accessToken = process.env.GOOGLE_SHEETS_ACCESS_TOKEN;

export function normalizeHeader(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi")
    .replace(/[()]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function columnIndex(headers, candidates) {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.findIndex((header) => header === normalizeHeader(candidate));
    if (index !== -1) return index;
  }
  return -1;
}

export function parseSheetDate(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCDate() === Number(day) && date.getUTCMonth() === Number(month) - 1) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : text;
  }
  return undefined;
}

export function safeSourceUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  return String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

export function inferRegion(text) {
  const normalized = normalizeHeader(text);
  if (/\b(viet nam|vn index|ha noi|da nang|ho chi minh|chinh phu|bo giao duc|ngan hang nha nuoc)\b/.test(normalized)) {
    return "Việt Nam";
  }
  if (/\b(my|hoa ky|trung quoc|nhat ban|han quoc|chau au|the gioi|quoc te|comcast|discord|threads|perm)\b/.test(normalized)) {
    return "Quốc tế";
  }
  return undefined;
}

function isTopSection(section) {
  return normalizeHeader(section).includes("top 5 tin quan trong");
}

export function mapRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return { articles: [], inputRows: Math.max(0, (rows?.length ?? 0) - 1), rejectedRows: 0, duplicates: 0 };
  }
  const headers = rows[0].map((value) => String(value ?? ""));
  const columns = {
    date: columnIndex(headers, ["ngay cap nhat date", "ngay cap nhat"]),
    section: columnIndex(headers, ["phan section", "phan"]),
    category: columnIndex(headers, ["muc linh vuc category", "muc linh vuc", "chuyen muc category", "category"]),
    title: columnIndex(headers, ["tieu de headline", "tieu de", "headline", "title"]),
    summary: columnIndex(headers, ["thong tin chinh so lieu main information figures", "thong tin chinh so lieu", "tom tat summary", "summary"]),
    context: columnIndex(headers, ["boi canh nguyen nhan context background", "boi canh nguyen nhan", "context"]),
    impact: columnIndex(headers, ["tac dong co hoi rui ro impact opportunities risks", "tac dong co hoi rui ro", "analysis"]),
    sourceUrl: columnIndex(headers, ["link bai goc source url", "link bai goc", "source url", "url"]),
    source: columnIndex(headers, ["nguon source", "nguon"]),
  };
  if (columns.title < 0) {
    return { articles: [], inputRows: rows.length - 1, rejectedRows: rows.length - 1, duplicates: 0 };
  }

  const seen = new Set();
  const articles = [];
  let rejectedRows = 0;
  let duplicates = 0;
  for (const row of rows.slice(1)) {
    if (!Array.isArray(row)) {
      rejectedRows++;
      continue;
    }
    const get = (index) => index < 0 ? "" : canonical(row[index]);
    const title = get(columns.title);
    if (!title) {
      rejectedRows++;
      continue;
    }
    const sheetUpdatedAt = parseSheetDate(get(columns.date));
    const category = get(columns.category) || "Chưa phân loại";
    const sourceUrl = safeSourceUrl(get(columns.sourceUrl));
    const normalizedTitle = normalizeHeader(title);
    const titleDateKey = `title:${normalizedTitle}|${sheetUpdatedAt ?? "undated"}`;
    const sourceTitleKey = sourceUrl ? `source:${sourceUrl.toLowerCase()}|title:${normalizedTitle}` : undefined;
    if (seen.has(titleDateKey) || (sourceTitleKey && seen.has(sourceTitleKey))) {
      duplicates++;
      continue;
    }
    seen.add(titleDateKey);
    if (sourceTitleKey) seen.add(sourceTitleKey);

    const section = get(columns.section) || undefined;
    const summary = get(columns.summary);
    const context = get(columns.context);
    const impact = get(columns.impact);
    const region = inferRegion(`${title} ${summary} ${category} ${section ?? ""}`);
    const article = {
      id: stableHash(titleDateKey),
      title,
      summary,
      category,
      ...(section ? { section } : {}),
      ...(region ? { region } : {}),
      ...(get(columns.source) ? { source: get(columns.source) } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(sheetUpdatedAt ? { sheetUpdatedAt } : {}),
      ...(context || impact ? { analysis: [context, impact].filter(Boolean).join("\n") } : {}),
      ...(isTopSection(section) ? { importance: Math.max(1, 5 - articles.filter((entry) => entry.section === section).length) } : {}),
      tags: [...new Set([category, ...(section ? [section] : [])])],
      language: "vi",
    };
    article.contentHash = stableHash(JSON.stringify(article));
    articles.push(article);
  }
  return { articles, inputRows: rows.length - 1, rejectedRows, duplicates };
}

function articleTitleDateKey(article) {
  if (!article.title) return undefined;
  return `title:${normalizeHeader(article.title)}|${article.sheetUpdatedAt ?? "undated"}`;
}

export function mergeArticles(existing, incoming) {
  const incomingKeys = new Set(incoming.map(articleTitleDateKey).filter(Boolean));
  const byId = new Map();
  for (const article of existing) {
    if (incomingKeys.has(articleTitleDateKey(article))) continue;
    byId.set(article.id, article);
  }
  for (const article of incoming) byId.set(article.id, article);
  return [...byId.values()];
}

async function fetchRows() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    let url = publicCsvUrl;
    const headers = {};
    if (apiKey || accessToken) {
      const range = encodeURIComponent(sheetRange);
      url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}${apiKey ? `?key=${encodeURIComponent(apiKey)}` : ""}`;
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    }
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(url, { headers, signal: controller.signal });
      } catch (error) {
        if (attempt === 2 || controller.signal.aborted) throw error;
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      if (response.ok) break;
      if (response.status < 500 || attempt === 2) {
        throw new Error(`Google Sheets trả về HTTP ${response.status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
    if (!response?.ok) throw new Error("Không thể đọc Google Sheets sau 3 lần thử");
    if (apiKey || accessToken) {
      const payload = await response.json();
      if (!Array.isArray(payload.values)) throw new Error("Google Sheets API không trả về values");
      return payload.values;
    }
    const csv = await response.text();
    const parsed = Papa.parse(csv, { skipEmptyLines: "greedy" });
    if (parsed.errors.length) throw new Error(`CSV không hợp lệ: ${parsed.errors[0].message}`);
    return parsed.data;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonAtomically(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

async function getExistingArticles() {
  const current = await readJson(path.join(dataDir, "news.json"), []);
  const archiveDir = path.join(dataDir, "archive");
  let files = [];
  try {
    files = (await readdir(archiveDir)).filter((file) => /^\d{4}-\d{2}\.json$/.test(file));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const archives = await Promise.all(files.map((file) => readJson(path.join(archiveDir, file), [])));
  return [...current, ...archives.flat()].filter((article) => article && typeof article.id === "string");
}

export async function synchronizeNews({ fetchData = fetchRows, now = new Date() } = {}) {
  const rows = await fetchData();
  const mapped = mapRows(rows);
  if (mapped.inputRows === 0 || mapped.articles.length === 0) {
    throw new Error(`Sheet rỗng hoặc không có tiêu đề hợp lệ (dòng vào: ${mapped.inputRows}, dòng lỗi: ${mapped.rejectedRows}); giữ nguyên dữ liệu hiện tại.`);
  }

  const existing = await getExistingArticles();
  const previousMetadata = await readJson(path.join(dataDir, "metadata.json"), null);
  const existingById = new Map(existing.map((article) => [article.id, article]));
  const contentChanged = mapped.articles.some((article) => {
    const previous = existingById.get(article.id);
    return !previous || previous.contentHash !== article.contentHash;
  }) || previousMetadata?.inputRows !== mapped.inputRows
    || previousMetadata?.validRows !== mapped.articles.length
    || previousMetadata?.duplicates !== mapped.duplicates
    || previousMetadata?.rejectedRows !== mapped.rejectedRows;
  const allArticles = mergeArticles(existing, mapped.articles);
  const byMonth = new Map();
  for (const article of allArticles) {
    const month = (article.publishedAt ?? article.sheetUpdatedAt ?? article.collectedAt ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(article);
  }

  const metadata = {
    lastUpdatedAt: contentChanged || !previousMetadata?.lastUpdatedAt
      ? now.toISOString()
      : previousMetadata.lastUpdatedAt,
    inputRows: mapped.inputRows,
    validRows: mapped.articles.length,
    duplicates: mapped.duplicates,
    rejectedRows: mapped.rejectedRows,
    outputRows: allArticles.length,
    source: `${spreadsheetUrl}/edit?gid=${encodeURIComponent(sheetGid)}#gid=${encodeURIComponent(sheetGid)}`,
  };
  const changes = [];
  const updateIfChanged = async (file, value) => {
    const prior = await readJson(file, null);
    if (JSON.stringify(prior) !== JSON.stringify(value)) {
      await writeJsonAtomically(file, value);
      changes.push(path.relative(root, file));
    }
  };
  await updateIfChanged(path.join(dataDir, "news.json"), allArticles);
  await updateIfChanged(path.join(dataDir, "metadata.json"), metadata);
  for (const [month, articles] of byMonth) {
    await updateIfChanged(path.join(dataDir, "archive", `${month}.json`), articles);
  }
  return { ...metadata, changedFiles: changes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await synchronizeNews();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Đồng bộ thất bại: ${error.message}`);
    process.exitCode = 1;
  }
}
