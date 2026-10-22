export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  section?: string;
  region?: "Việt Nam" | "Quốc tế";
  source?: string;
  sourceUrl?: string;
  imageUrl?: string;
  publishedAt?: string;
  collectedAt?: string;
  sheetUpdatedAt?: string;
  analysis?: string;
  importance?: number;
  tags: string[];
  language: string;
  contentHash?: string;
}

export interface NewsMetadata {
  lastUpdatedAt: string | null;
  inputRows: number;
  validRows: number;
  duplicates: number;
  rejectedRows: number;
  outputRows: number;
  source: string;
}
