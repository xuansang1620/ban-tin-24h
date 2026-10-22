import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Clock3,
  ExternalLink,
  Filter,
  Globe2,
  List,
  Menu,
  Moon,
  Newspaper,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import {
  formatVietnameseDate,
  getUniqueValues,
  isSafeHttpUrl,
  matchesDateFilter,
  searchArticles,
  sortArticles,
  type DateFilter,
} from "./lib/news";
import type { NewsArticle, NewsMetadata } from "./types/news";

type Theme = "light" | "dark";
type ViewMode = "cards" | "list";
type Section = "home" | "categories" | "search" | "saved";

const CACHE_KEY = "ban-tin-24h-cache-v1";
const SAVED_KEY = "ban-tin-24h-saved-v1";
const emptyMetadata: NewsMetadata = {
  lastUpdatedAt: null,
  inputRows: 0,
  validRows: 0,
  duplicates: 0,
  rejectedRows: 0,
  outputRows: 0,
  source: "",
};

function readSaved(): { ids: string[]; warning: string } {
  try {
    const value = localStorage.getItem(SAVED_KEY);
    const ids: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
      throw new Error("Danh sách bài đã lưu không hợp lệ.");
    }
    return { ids, warning: "" };
  } catch {
    return { ids: [], warning: "Trình duyệt đang chặn lưu trữ cục bộ; bài đã lưu có thể không được giữ lại." };
  }
}

function isNewsArticle(value: unknown): value is NewsArticle {
  if (!value || typeof value !== "object") return false;
  const article = value as Partial<NewsArticle>;
  return typeof article.id === "string"
    && typeof article.title === "string"
    && typeof article.summary === "string"
    && typeof article.category === "string"
    && Array.isArray(article.tags);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

async function copyLink(value: string): Promise<boolean> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  return copied;
}

function getArticleDateLabel(article: NewsArticle): string {
  if (article.publishedAt) {
    return `Xuất bản ${formatVietnameseDate(article.publishedAt, { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (article.sheetUpdatedAt) return `Nguồn cập nhật ${formatVietnameseDate(article.sheetUpdatedAt)}`;
  if (article.collectedAt) return `Thu thập ${formatVietnameseDate(article.collectedAt, { hour: "2-digit", minute: "2-digit" })}`;
  return "Chưa có thời điểm xuất bản";
}

function App() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [metadata, setMetadata] = useState<NewsMetadata>(emptyMetadata);
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState("");
  const [isStale, setIsStale] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem("ban-tin-24h-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [textScale, setTextScale] = useState(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [region, setRegion] = useState("Tất cả");
  const [source, setSource] = useState("Tất cả");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [savedIds, setSavedIds] = useState<string[]>(() => readSaved().ids);
  const [saveWarning, setSaveWarning] = useState(() => readSaved().warning);
  const [notice, setNotice] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [now, setNow] = useState(new Date());
  const dataIsOutdated = Boolean(metadata.lastUpdatedAt)
    && now.getTime() - new Date(metadata.lastUpdatedAt!).getTime() > 24 * 60 * 60 * 1000;
  const showStaleWarning = isStale || dataIsOutdated;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("ban-tin-24h-theme", theme);
    } catch {
      setNotice("Không thể lưu giao diện do trình duyệt chặn lưu trữ.");
    }
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        changeSection("search");
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadNews() {
      try {
        const [newsResponse, metadataResponse] = await Promise.all([
          fetch("./data/news.json", { cache: "no-cache" }),
          fetch("./data/metadata.json", { cache: "no-cache" }),
        ]);
        if (!newsResponse.ok) throw new Error(`Không tải được dữ liệu tin (HTTP ${newsResponse.status})`);
        const newsValue: unknown = await newsResponse.json();
        if (!Array.isArray(newsValue) || !newsValue.every(isNewsArticle)) {
          throw new Error("Tệp dữ liệu tin không đúng cấu trúc.");
        }
        const metadataValue = metadataResponse.ok ? await metadataResponse.json() as Partial<NewsMetadata> : {};
        if (!active) return;
        const nextMetadata = { ...emptyMetadata, ...metadataValue };
        setArticles(newsValue);
        setMetadata(nextMetadata);
        setIsStale(false);
        setLoadMessage("");
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ articles: newsValue, metadata: nextMetadata }));
        } catch {
          setLoadMessage("Dữ liệu đã tải nhưng trình duyệt không cho phép lưu bản dự phòng.");
        }
      } catch (error) {
        let cached = false;
        try {
          const value = localStorage.getItem(CACHE_KEY);
          if (value) {
            const parsed = JSON.parse(value) as { articles?: unknown; metadata?: Partial<NewsMetadata> };
            if (Array.isArray(parsed.articles) && parsed.articles.every(isNewsArticle)) {
              setArticles(parsed.articles);
              setMetadata({ ...emptyMetadata, ...parsed.metadata });
              setIsStale(true);
              setLoadMessage("Đang hiển thị dữ liệu đã lưu gần nhất vì không thể kết nối nguồn cập nhật.");
              cached = true;
            }
          }
        } catch {
          setLoadMessage("Không thể đọc dữ liệu hoặc bản dự phòng đã lưu trong trình duyệt.");
        }
        if (!cached && active) {
          setLoadMessage(error instanceof Error ? error.message : "Không thể tải dữ liệu tin.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadNews();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds));
    } catch {
      setSaveWarning("Trình duyệt đang chặn lưu trữ; danh sách đã lưu chỉ còn trong phiên này.");
    }
  }, [savedIds]);

  const categories = useMemo(() => ["Tất cả", ...getUniqueValues(articles, (article) => article.category)], [articles]);
  const sources = useMemo(() => ["Tất cả", ...getUniqueValues(articles, (article) => article.source)], [articles]);
  const filteredArticles = useMemo(() => {
    let result = articles;
    if (activeSection === "saved") result = result.filter((article) => savedIds.includes(article.id));
    result = searchArticles(result, query);
    if (category !== "Tất cả") result = result.filter((article) => article.category === category);
    if (region !== "Tất cả") result = result.filter((article) => article.region === region);
    if (source !== "Tất cả") result = result.filter((article) => article.source === source);
    result = result.filter((article) => matchesDateFilter(article, dateFilter, now));
    return sortArticles(result, sortOrder);
  }, [activeSection, articles, category, dateFilter, now, query, region, savedIds, sortOrder, source]);

  const featuredArticles = useMemo(() => {
    return [...articles]
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
      .slice(0, 4);
  }, [articles]);
  const updatedToday = articles.filter((article) => matchesDateFilter(article, "today", now)).length;
  const publishedLast24 = articles.filter((article) => matchesDateFilter(article, "last24", now)).length;
  const regions = getUniqueValues(articles, (article) => article.region);
  const hasFilters = query || category !== "Tất cả" || region !== "Tất cả" || source !== "Tất cả" || dateFilter !== "today";

  function toggleSaved(articleId: string) {
    setSavedIds((ids) => ids.includes(articleId) ? ids.filter((id) => id !== articleId) : [...ids, articleId]);
    setNotice(savedIds.includes(articleId) ? "Đã bỏ lưu bài viết." : "Đã lưu bài viết trên thiết bị này.");
  }

  async function shareArticle(article: NewsArticle) {
    const url = isSafeHttpUrl(article.sourceUrl)
      ? article.sourceUrl
      : `${window.location.origin}${window.location.pathname}#tin-${encodeURIComponent(article.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: article.title, text: article.summary, url });
        setNotice("Đã mở bảng chia sẻ.");
      } else {
        const copied = await copyLink(url);
        setNotice(copied
          ? (isSafeHttpUrl(article.sourceUrl) ? "Đã sao chép liên kết bài gốc." : "Chưa có liên kết bài gốc; đã sao chép liên kết bài trên trang này.")
          : "Không thể sao chép liên kết trên thiết bị này.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setNotice("Không thể chia sẻ liên kết. Vui lòng thử lại.");
    }
  }

  function changeSection(section: Section) {
    if (section === "saved") {
      setQuery("");
      setCategory("Tất cả");
      setRegion("Tất cả");
      setSource("Tất cả");
      setDateFilter("all");
    } else if (activeSection === "saved") {
      setDateFilter("today");
    }
    setActiveSection(section);
    if (section === "search") {
      window.setTimeout(() => document.getElementById("search-input")?.focus(), 0);
    }
    if (section === "categories") {
      window.setTimeout(() => document.getElementById("filter-category")?.focus(), 0);
    }
  }

  const shownArticles = filteredArticles.slice(0, visibleCount);

  return (
    <div className="app-shell" style={{ "--text-scale": textScale } as React.CSSProperties}>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#" onClick={() => changeSection("home")} aria-label="Bản tin 24h, về trang chủ">
            <span className="brand-mark"><Newspaper size={24} aria-hidden="true" /></span>
            <span><strong>BẢN TIN <b>24H</b></strong><small>VIỆT NAM &amp; THẾ GIỚI</small></span>
          </a>
          <div className="header-date">
            <span>{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(now)}</span>
            <strong><Clock3 size={14} aria-hidden="true" /> {formatTime(now)} · GMT+7</strong>
          </div>
          <div className="header-actions">
            <button className="icon-button" type="button" aria-label="Tìm kiếm tin" onClick={() => changeSection("search")}><Search /></button>
            <button className="icon-button" type="button" aria-label={theme === "light" ? "Bật chế độ tối" : "Bật chế độ sáng"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
              {theme === "light" ? <Moon /> : <Sun />}
            </button>
            <button className="text-size-button" type="button" onClick={() => setTextScale((scale) => scale >= 1.15 ? 1 : Math.round((scale + 0.05) * 100) / 100)} aria-label="Tăng cỡ chữ">A+</button>
          </div>
        </div>
      </header>

      <nav className="desktop-nav" aria-label="Điều hướng chính">
        <div className="content-width nav-inner">
          <button className={activeSection === "home" ? "nav-link active" : "nav-link"} onClick={() => changeSection("home")} type="button">Trang chủ</button>
          <button className={activeSection === "categories" ? "nav-link active" : "nav-link"} onClick={() => changeSection("categories")} type="button">Chuyên mục</button>
          <button className={activeSection === "search" ? "nav-link active" : "nav-link"} onClick={() => changeSection("search")} type="button">Tìm kiếm</button>
          <button className={activeSection === "saved" ? "nav-link active" : "nav-link"} onClick={() => changeSection("saved")} type="button">Đã lưu <span className="nav-count">{savedIds.length}</span></button>
          <div className="nav-updated"><span className={showStaleWarning ? "status-dot stale" : "status-dot"} /> Cập nhật: {metadata.lastUpdatedAt ? formatVietnameseDate(metadata.lastUpdatedAt, { hour: "2-digit", minute: "2-digit" }) : "chưa có"}</div>
        </div>
      </nav>

      <main className="content-width main-content">
        {loadMessage && <div className={isStale ? "status-banner warning" : "status-banner"} role="status"><AlertTriangle size={17} />{loadMessage}</div>}
        {saveWarning && <div className="status-banner warning" role="status"><AlertTriangle size={17} />{saveWarning}</div>}
        {showStaleWarning && <div className="stale-line">{isStale ? "Dữ liệu đang xem là bản lưu gần nhất; có thể chưa phản ánh nội dung mới." : "Dữ liệu đã quá 24 giờ chưa được đồng bộ; thông tin có thể đã cũ."}</div>}

        {activeSection !== "saved" && (
          <>
            <section className="welcome-row">
              <div>
                <div className="eyebrow"><span className="live-dot" /> ĐIỂM TIN TRONG NGÀY</div>
                <h1>Tin tức, <span>nhìn toàn cảnh.</span></h1>
                <p>Tổng hợp có chọn lọc, cập nhật minh bạch từ dữ liệu nguồn.</p>
              </div>
              <div className="update-chip"><CalendarDays size={17} /><span><small>DỮ LIỆU CẬP NHẬT</small><strong>{metadata.lastUpdatedAt ? formatVietnameseDate(metadata.lastUpdatedAt, { hour: "2-digit", minute: "2-digit" }) : "Đang chờ đồng bộ"}</strong></span></div>
            </section>
            <section className="stats-grid" aria-label="Thống kê dữ liệu">
              <Stat icon={<Newspaper />} label="Tin cập nhật hôm nay" value={updatedToday} />
              <Stat icon={<Clock3 />} label="Tin có giờ xuất bản trong 24h" value={publishedLast24} />
              <Stat icon={<Filter />} label="Chuyên mục" value={categories.length - 1} />
              <Stat icon={<Newspaper />} label="Nguồn tin" value={sources.length - 1} />
              <Stat icon={<Globe2 />} label="Tin Việt Nam" value={articles.filter((article) => article.region === "Việt Nam").length} />
              <Stat icon={<Globe2 />} label="Tin quốc tế" value={articles.filter((article) => article.region === "Quốc tế").length} />
            </section>
            {featuredArticles.length > 0 && activeSection === "home" && (
              <section className="featured-section" aria-labelledby="featured-title">
                <div className="section-heading">
                  <div><span className="section-kicker">ĐỌC ĐẦU TIÊN</span><h2 id="featured-title">Tin nổi bật</h2></div>
                  <span className="editorial-note"><Sparkles size={15} /> Ưu tiên theo mục đánh dấu trong nguồn</span>
                </div>
                <div className="featured-grid">
                  {featuredArticles.map((article, index) => (
                    <article className={index === 0 ? "featured-card lead" : "featured-card"} key={article.id}>
                      <span className="featured-number">{String(index + 1).padStart(2, "0")}</span>
                      <span className="category-pill">{article.category}</span>
                      <h3><a href={`#tin-${encodeURIComponent(article.id)}`}>{article.title}</a></h3>
                      {index === 0 && article.summary && <p>{article.summary}</p>}
                      <span className="article-date">{getArticleDateLabel(article)}</span>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section className="news-section" id="news">
          <div className="section-heading news-heading">
            <div>
              <span className="section-kicker">{activeSection === "saved" ? "CÁ NHÂN" : activeSection === "search" ? "TRA CỨU" : "TỔNG HỢP"}</span>
              <h2>{activeSection === "saved" ? "Tin đã lưu" : "Bản tin hôm nay"} <span className="result-count">{filteredArticles.length}</span></h2>
            </div>
            <div className="view-toggle" role="group" aria-label="Kiểu hiển thị">
              <button className={viewMode === "cards" ? "selected" : ""} type="button" onClick={() => setViewMode("cards")} aria-label="Hiển thị dạng thẻ"><Menu size={17} /></button>
              <button className={viewMode === "list" ? "selected" : ""} type="button" onClick={() => setViewMode("list")} aria-label="Hiển thị dạng danh sách"><List size={17} /></button>
            </div>
          </div>

          <div className="filter-panel">
            <label className="search-box" htmlFor="search-input"><Search size={18} /><input id="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tiêu đề, nội dung, từ khóa..." /><kbd>⌘ K</kbd></label>
            <div className="filter-row">
              <label className="select-wrap"><span className="sr-only">Ngày</span><CalendarDays size={16} /><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}><option value="today">Hôm nay · ngày nguồn cập nhật</option><option value="last24">24 giờ qua · ngày xuất bản</option><option value="yesterday">Hôm qua · ngày nguồn cập nhật</option><option value="all">Mọi thời điểm</option></select></label>
              <label className="select-wrap"><span className="sr-only">Chuyên mục</span><SlidersHorizontal size={16} /><select id="filter-category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="select-wrap"><span className="sr-only">Khu vực</span><Globe2 size={16} /><select value={region} onChange={(event) => setRegion(event.target.value)}><option>Tất cả</option>{regions.map((item) => <option key={item}>{item}</option>)}</select></label>
              {sources.length > 1 && <label className="select-wrap"><span className="sr-only">Nguồn tin</span><Newspaper size={16} /><select value={source} onChange={(event) => setSource(event.target.value)}>{sources.map((item) => <option key={item}>{item}</option>)}</select></label>}
              <button className="sort-button" type="button" onClick={() => setSortOrder((order) => order === "newest" ? "oldest" : "newest")}>
                {sortOrder === "newest" ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}
                {sortOrder === "newest" ? "Mới nhất" : "Cũ nhất"}
              </button>
              {hasFilters && <button className="clear-button" type="button" onClick={() => { setQuery(""); setCategory("Tất cả"); setRegion("Tất cả"); setSource("Tất cả"); setDateFilter("today"); }}>Xóa lọc</button>}
            </div>
            <div className="category-chips" aria-label="Lọc nhanh theo chuyên mục">
              {categories.map((item) => <button key={item} className={category === item ? "category-chip active" : "category-chip"} onClick={() => setCategory(item)} type="button">{item}</button>)}
            </div>
          </div>

          {loading ? (
            <div className="article-grid" aria-label="Đang tải tin" aria-busy="true">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><span /><span /><span /></div>)}</div>
          ) : filteredArticles.length === 0 ? (
            <div className="empty-state"><Search size={28} /><h3>{articles.length ? "Không tìm thấy tin phù hợp" : "Chưa có dữ liệu tin"}</h3><p>{articles.length ? "Thử đổi từ khóa hoặc nới bộ lọc ngày, chuyên mục." : "Dữ liệu sẽ xuất hiện sau khi đồng bộ Google Sheets thành công."}</p>{articles.length > 0 && <button type="button" className="secondary-button" onClick={() => { setQuery(""); setCategory("Tất cả"); setRegion("Tất cả"); setSource("Tất cả"); setDateFilter("all"); }}>Xem tất cả tin</button>}</div>
          ) : (
            <>
              <div className={viewMode === "cards" ? "article-grid" : "article-list"}>
                {shownArticles.map((article) => <ArticleCard key={article.id} article={article} saved={savedIds.includes(article.id)} list={viewMode === "list"} onSave={() => toggleSaved(article.id)} onShare={() => void shareArticle(article)} />)}
              </div>
              {visibleCount < filteredArticles.length && <button type="button" className="load-more" onClick={() => setVisibleCount((count) => count + 12)}>Xem thêm tin <span>({filteredArticles.length - visibleCount} còn lại)</span></button>}
            </>
          )}
        </section>

        {activeSection !== "saved" && (
          <section className="insight-strip" aria-label="Thông tin dữ liệu">
            <div className="insight-icon"><Activity size={19} /></div>
            <div><strong>Minh bạch về thời gian</strong><p>Ngày cập nhật nguồn không được xem là ngày xuất bản. Tin thiếu thời điểm xuất bản sẽ không tính vào bộ lọc “24 giờ qua”.</p></div>
            <a href={metadata.source || "https://docs.google.com/spreadsheets/d/1BKvEFsK-SjtW0CPBylrXOWSNIo7vDEWhEFemPsOs--Y/edit?gid=0#gid=0"} target="_blank" rel="noreferrer">Google Sheets <ExternalLink size={14} /></a>
          </section>
        )}
        <footer className="site-footer"><span>© {now.getFullYear()} Bản tin 24h</span><span>Dữ liệu: Google Sheets · Múi giờ hiển thị: Asia/Ho_Chi_Minh</span></footer>
      </main>

      <nav className="mobile-nav" aria-label="Điều hướng điện thoại">
        <MobileNavItem active={activeSection === "home"} icon={<Newspaper />} label="Trang chủ" onClick={() => changeSection("home")} />
        <MobileNavItem active={activeSection === "categories"} icon={<Filter />} label="Mục tin" onClick={() => changeSection("categories")} />
        <MobileNavItem active={activeSection === "search"} icon={<Search />} label="Tìm kiếm" onClick={() => changeSection("search")} />
        <MobileNavItem active={activeSection === "saved"} icon={<Bookmark />} label="Đã lưu" onClick={() => changeSection("saved")} />
      </nav>
      {notice && <div className="toast" role="status">{notice}<button type="button" aria-label="Đóng thông báo" onClick={() => setNotice("")}><X size={16} /></button></div>}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="stat-card"><span className="stat-icon">{icon}</span><span className="stat-value">{value}</span><span className="stat-label">{label}</span></div>;
}

function ArticleCard({ article, saved, list, onSave, onShare }: {
  article: NewsArticle;
  saved: boolean;
  list: boolean;
  onSave: () => void;
  onShare: () => void;
}) {
  return (
    <article className={`article-card${list ? " list-card" : ""}`} id={`tin-${article.id}`}>
      {article.imageUrl && isSafeHttpUrl(article.imageUrl) && <img className="article-image" src={article.imageUrl} alt="" loading="lazy" />}
      <div className="article-content">
        <div className="article-topline"><span className="category-pill">{article.category}</span>{article.region && <span className="region-label">{article.region}</span>}</div>
        <h3>{article.title}</h3>
        {article.summary && <p className="article-summary">{article.summary}</p>}
        {article.analysis && <details className="analysis-details"><summary>Phân tích &amp; bối cảnh</summary><p>{article.analysis}</p></details>}
        <div className="article-meta">
          <span><Clock3 size={14} />{getArticleDateLabel(article)}</span>
          {article.source && <span>{article.source}</span>}
        </div>
        <div className="article-actions">
          {isSafeHttpUrl(article.sourceUrl) ? <a className="source-link" href={article.sourceUrl} target="_blank" rel="noopener noreferrer">Đọc bài gốc <ExternalLink size={14} /></a> : <span className="no-source">Chưa có liên kết bài gốc</span>}
          <button className="action-button" type="button" onClick={onSave} aria-label={saved ? "Bỏ lưu bài viết" : "Lưu bài viết"} aria-pressed={saved}>{saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}<span>{saved ? "Đã lưu" : "Lưu"}</span></button>
          <button className="action-button" type="button" onClick={onShare} aria-label="Chia sẻ bài viết"><Share2 size={17} /><span>Chia sẻ</span></button>
        </div>
      </div>
    </article>
  );
}

function MobileNavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={active ? "mobile-nav-item active" : "mobile-nav-item"} type="button" onClick={onClick}>{icon}<span>{label}</span></button>;
}

export default App;
