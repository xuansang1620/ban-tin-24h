# Bản tin 24h – Việt Nam & Thế giới

Website tĩnh React + TypeScript, tối ưu cho điện thoại. Dữ liệu được đọc từ Google Sheets, chuẩn hóa thành JSON bằng Node.js và phát hành qua GitHub Pages. Frontend không cần backend hoặc API key.

## Phase 1: kiểm tra nguồn và mapping

Đã kiểm tra quyền đọc CSV công khai của Spreadsheet `1BKvEFsK-SjtW0CPBylrXOWSNIo7vDEWhEFemPsOs--Y`, GID `0`. Tại thời điểm kiểm tra, Sheet có 32 bản ghi và 8 cột:

| Cột Google Sheets thực tế | Trường website | Cách xử lý |
| --- | --- | --- |
| Ngày cập nhật (Date) | `sheetUpdatedAt` | Chuyển `dd/mm/yyyy` thành `yyyy-mm-dd`; không gán thành ngày xuất bản/thu thập |
| Phần (Section) | `section` | Giữ nhãn nguồn; mục “TOP 5 TIN QUAN TRỌNG” cung cấp thứ tự ưu tiên |
| Mục / Lĩnh vực (Category) | `category` | Giữ tên chuyên mục thực tế |
| Tiêu đề (Headline) | `title` | Bắt buộc; dòng không có tiêu đề bị loại |
| Thông tin chính & Số liệu (Main Information & Figures) | `summary` | Tóm tắt theo nội dung nguồn |
| Bối cảnh / Nguyên nhân (Context & Background) | `analysis` | Ghép với cột tác động nếu có |
| Tác động / Cơ hội & Rủi ro (Impact, Opportunities & Risks) | `analysis` | Giữ nguyên nội dung, không tạo thêm phân tích |
| Link bài gốc (Source URL) | `sourceUrl` | Chỉ nhận URL HTTP(S) hợp lệ |

Một số giới hạn dữ liệu đã xác nhận: cột link xuất chuỗi “Xem nguồn” cho cả 32 hàng; CSV không cung cấp URL đích và bản XLSX tải về cũng không chứa hyperlink đích. Sheet cũng chỉ có ngày cập nhật, không có giờ/ngày xuất bản hoặc thời gian thu thập, nhà xuất bản, ảnh minh họa hay ngôn ngữ. Vì vậy website không tạo các giá trị này giả tạo; liên kết nguồn chỉ hiện khi có URL hợp lệ. Nhãn Việt Nam/quốc tế chỉ được gán khi có chỉ dấu từ nội dung, nếu không để trống.

## Chạy tại máy

Yêu cầu Node.js 20 trở lên.

```powershell
npm ci
npm test
npm run sync:news
npm run dev
```

`npm run sync:news` đọc CSV công khai theo mặc định, kiểm tra tiêu đề và dữ liệu rồi cập nhật `public/data/news.json`, `public/data/metadata.json` và `public/data/archive/YYYY-MM.json`. Sheet rỗng, không có tiêu đề hợp lệ, lỗi mạng hoặc lỗi schema sẽ làm lệnh thất bại và không thay thế dữ liệu hiện hành. Bản tin cũ được hợp nhất thay vì xóa khi Sheet chỉ còn một cửa sổ dữ liệu ngắn.

## Google Sheets và bảo mật

- Chia sẻ Sheet ở chế độ cho phép đọc CSV công khai để dùng cấu hình mặc định.
- Đổi ID/GID/range bằng biến môi trường `GOOGLE_SHEETS_ID`, `GOOGLE_SHEETS_GID`, `GOOGLE_SHEETS_RANGE` trong `.env` (sao chép từ `.env.example`) hoặc GitHub Actions Variables cùng tên.
- Với Sheets API, đặt `GOOGLE_SHEETS_API_KEY` hoặc access token ngắn hạn qua GitHub Actions Secrets. API key chỉ hoạt động khi sheet/API cho phép truy cập tương ứng; sheet riêng tư cần token OAuth có quyền đọc. Không đưa khóa/token vào frontend hoặc commit vào Git.
- `GOOGLE_SHEETS_ID` mặc định là ID đã được kiểm tra. `GOOGLE_SHEETS_GID` mặc định là `0`.

## GitHub Pages

1. Tạo repository GitHub và đưa toàn bộ source lên nhánh `main`.
2. Trong **Settings → Pages → Build and deployment**, chọn **GitHub Actions**.
3. Workflow `.github/workflows/pages.yml` chạy đồng bộ 4 lần/ngày (02:00, 08:00, 14:00, 20:00 UTC; tương ứng 09:00, 15:00, 21:00, 03:00 giờ Việt Nam), khi push `main`, hoặc thủ công qua **Run workflow**.
4. Workflow kiểm tra/đồng bộ dữ liệu, chỉ commit JSON và deploy khi dữ liệu đổi (push `main` vẫn deploy mã nguồn). Nếu đồng bộ thất bại khi push mã, bước đồng bộ báo đỏ nhưng website vẫn build bằng dữ liệu hợp lệ gần nhất; nếu thất bại trong lần chạy lịch/thủ công, website đang xuất bản tiếp tục giữ nguyên. GitHub có thể chạy cron trễ nên đây không phải dịch vụ thời gian thực.
5. Cấu hình repository để `GITHUB_TOKEN` có quyền ghi Contents nếu muốn workflow commit JSON; quyền Pages được cấp tối thiểu trong job deploy.
6. `vite.config.ts` dùng base tương đối để hỗ trợ URL dạng `https://<owner>.github.io/<repository>/` và custom domain. Sau khi biết URL thật, cập nhật địa chỉ mẫu trong `public/sitemap.xml`.

## Tính năng

- Tìm kiếm tiếng Việt có dấu/không dấu; lọc ngày, chuyên mục, khu vực và nguồn; sắp xếp, dạng thẻ/danh sách.
- Lọc “Hôm nay” theo ngày nguồn cập nhật nếu không có ngày xuất bản; “24 giờ qua” chỉ tính bản ghi có `publishedAt` thực.
- Lưu bài trên thiết bị, chia sẻ qua Web Share API hoặc sao chép liên kết; chủ đề sáng/tối và điều chỉnh cỡ chữ.
- Bản tin được tải tuần tự, có trạng thái lỗi/cache cũ, tải thêm theo đợt, ảnh lazy-load, liên kết chỉ nhận HTTP(S).
- Responsive từ 320px, có điều hướng dưới màn hình và hỗ trợ `prefers-reduced-motion`.

## Kiểm thử và giới hạn

`npm test` bao gồm kiểm thử hàm lọc/ngày giờ/URL và kiểm thử ETL: ánh xạ header, Sheet rỗng, thiếu cột, null, ngày sai, link không an toàn và schema thực tế.

Chưa thể triển khai GitHub Pages hoặc đo Lighthouse trong môi trường này vì chưa có repository/URL GitHub đã xác nhận và quyền GitHub tương ứng. Lighthouse cần đo sau khi deploy. Các mục tiêu điểm Lighthouse trong yêu cầu là mục tiêu, không phải kết quả đã đo.
