# PROMPT CODEX – PHÁT TRIỂN WEBSITE BẢN TIN TỔNG HỢP 24H

## 1. Vai trò

Bạn là Senior Full-stack Developer, UI/UX Designer và DevOps Engineer.

Hãy thiết kế, lập trình, kiểm thử và triển khai một website tổng hợp tin tức hiện đại, tối ưu mobile-first, sử dụng Google Sheets làm nguồn dữ liệu và GitHub Pages để xuất bản.

Tên website: **Bản tin 24h – Việt Nam & Thế giới**.

Ngôn ngữ hiển thị: Tiếng Việt.

Mục tiêu: Cung cấp trải nghiệm đọc nhanh, theo dõi và phân tích tin tức trong 24 giờ gần nhất, thuận tiện trên điện thoại.

## 2. Nguồn dữ liệu

Google Sheets:

https://docs.google.com/spreadsheets/d/1BKvEFsK-SjtW0CPBylrXOWSNIo7vDEWhEFemPsOs--Y/edit?usp=sharing

Spreadsheet ID:

`1BKvEFsK-SjtW0CPBylrXOWSNIo7vDEWhEFemPsOs--Y`

Sheet GID: `0`

Yêu cầu:

1. Kiểm tra quyền truy cập Google Sheets.
2. Đọc hàng tiêu đề và tối thiểu 10 bản ghi mẫu nếu có quyền.
3. Tự động xác định các trường dữ liệu thực tế.
4. Xây dựng bảng ánh xạ giữa các cột Google Sheets và dữ liệu website.
5. Không tự giả định tên cột tồn tại.
6. Nếu không truy cập được, thông báo rõ và hỗ trợ cấu hình qua CSV hoặc Google Sheets API.
7. Không tự ý thay đổi dữ liệu nguồn.

### Mô hình dữ liệu chuẩn hóa

Xây dựng NewsArticle với các thuộc tính:

- id: định danh duy nhất, ổn định
- title: tiêu đề
- summary: nội dung tóm tắt
- category: chuyên mục
- region: Việt Nam hoặc Quốc tế
- source: tên nguồn
- sourceUrl: liên kết bài gốc
- imageUrl: ảnh minh họa, nếu có
- publishedAt: thời điểm xuất bản
- collectedAt: thời điểm thu thập
- analysis: phân tích hoặc tác động, nếu có
- importance: mức độ quan trọng, nếu có
- tags: từ khóa
- language: ngôn ngữ

Các trường không có trong Sheet phải được xử lý dưới dạng optional hoặc giá trị mặc định phù hợp. Không tạo nội dung tin tức giả.

Sử dụng URL nguồn, tiêu đề chuẩn hóa và ngày xuất bản để hỗ trợ phát hiện bản ghi trùng lặp.

## 3. Thiết kế UI/UX

Thiết kế theo phong cách báo điện tử hiện đại kết hợp dashboard tin tức.

Yêu cầu:

- Mobile-first, responsive từ 320px.
- Tối ưu cho điện thoại Android, iPhone, tablet và desktop.
- Giao diện sạch, dễ đọc, ít thao tác.
- Màu chủ đạo: trắng, xanh navy và đỏ nhấn.
- Font tiếng Việt dễ đọc.
- Có chế độ sáng/tối.
- Hỗ trợ người dùng lớn tuổi bằng cỡ chữ dễ đọc và nút điều chỉnh kích thước chữ.
- Các nút thao tác có kích thước phù hợp cho cảm ứng.
- Hạn chế hiệu ứng nặng và chuyển động không cần thiết.
- Tuân thủ các nguyên tắc WCAG 2.2 AA ở mức khả thi.

### 3.1. Header

Hiển thị:

- Logo và tên website.
- Ngày giờ hiện tại theo Asia/Ho_Chi_Minh.
- Thời gian cập nhật dữ liệu gần nhất.
- Nút tìm kiếm.
- Chuyển đổi Dark/Light Mode.
- Menu điều hướng.

### 3.2. Trang chủ

Bố cục:

A. Khu vực tin nổi bật:

- Một tin chính có tiêu đề lớn.
- Các tin nổi bật tiếp theo.
- Ưu tiên theo importance nếu dữ liệu có trường này; nếu không, dùng quy tắc mới nhất.
- Không đánh đồng tin mới nhất với tin quan trọng nhất.

B. Khu vực bản tin 24h:

- Danh sách bài viết theo thời gian giảm dần.
- Mỗi bài có tiêu đề, tóm tắt, nguồn, thời gian, chuyên mục và hình ảnh nếu có.
- Nút đọc bài gốc.
- Nút lưu bài và chia sẻ.
- Chế độ danh sách và thẻ tin.

C. Khu vực chuyên mục:

- Tất cả
- Việt Nam
- Quốc tế
- Kinh tế
- Xã hội
- Công nghệ
- AI
- Hot Trends
- Các chuyên mục bổ sung lấy từ Sheet.

D. Khu vực tin đáng chú ý:

- Tin quan trọng trong ngày.
- Tin được cập nhật gần nhất.
- Các chủ đề xuất hiện nhiều, chỉ dựa trên thống kê dữ liệu có thật.


 ###  3.2.1 News Data Synchronization** cho website Bản tin tổng hợp 24h.

Nguồn: Google Sheets ID `1BKvEFsK-SjtW0CPBylrXOWSNIo7vDEWhEFemPsOs--Y`, GID `0`.

Yêu cầu:

1. Kiểm tra quyền đọc CSV hoặc Google Sheets API và ánh xạ cột thực tế.
2. Thiết kế script ETL bằng Python hoặc Node.js.
3. Đồng bộ theo GitHub Actions, mặc định 4 lần/ngày theo múi giờ Việt Nam, có thể cấu hình.
4. Chuẩn hóa Unicode, URL, chuyên mục, thời gian và dữ liệu thiếu.
5. Loại bản ghi trùng theo định danh ổn định.
6. Tính hash nội dung để phát hiện thay đổi.
7. Chỉ ghi JSON và kích hoạt build/deploy khi dữ liệu thực sự thay đổi.
8. Lưu dữ liệu hiện hành và phân vùng archive theo tháng.
9. Không xóa lịch sử khi Sheet chỉ chứa tin 24 giờ gần nhất.
10. Khi đồng bộ thất bại, giữ dữ liệu hợp lệ gần nhất.
11. Ghi log số dòng đầu vào, dòng mới, trùng, lỗi và thời gian cập nhật.
12. Hiển thị "Cập nhật lần cuối" và cảnh báo khi dữ liệu quá cũ trên website.
13. Có workflow_dispatch để chạy đồng bộ thủ công.
14. Xây dựng tests cho dữ liệu trùng, Sheet rỗng, lỗi mạng, sai ngày giờ và thay đổi schema.
15. Hoàn thiện GitHub Pages deployment, xác minh phiên bản website thực tế.

Ưu tiên chi phí thấp, xử lý đơn giản, bảo mật, ít bảo trì và không cần backend liên tục.
### 3.3. Điều hướng điện thoại

Thiết kế thanh điều hướng dưới màn hình với tối đa 4 mục:

- Trang chủ
- Chuyên mục
- Tìm kiếm
- Đã lưu

Menu phải hoạt động tốt bằng thao tác một tay.

## 4. Nghiệp vụ lọc và tìm kiếm

Cho phép:

- Tìm theo tiêu đề, tóm tắt, nguồn và từ khóa.
- Lọc theo chuyên mục.
- Lọc Việt Nam hoặc quốc tế.
- Lọc theo ngày.
- Sắp xếp mới nhất, cũ nhất.
- Lọc theo nguồn tin.
- Kết hợp nhiều bộ lọc.

Định nghĩa thời gian:

- "24 giờ qua": khoảng thời gian trượt 24 giờ tính tới hiện tại.
- "Hôm nay": từ 00:00 tới hiện tại theo Asia/Ho_Chi_Minh.
- "Hôm qua": ngày lịch liền trước theo Asia/Ho_Chi_Minh.

Mặc định chọn "Hôm nay", có lựa chọn "24 giờ qua".

Thời điểm xuất bản và thời điểm thu thập phải được phân biệt rõ.

Với bản ghi thiếu publishedAt, không tự coi collectedAt là thời gian xuất bản. Hiển thị nhãn phù hợp và cho phép lọc theo thời gian thu thập khi cần.

## 5. Nghiệp vụ đồng bộ dữ liệu

Ưu tiên kiến trúc tĩnh:

Google Sheets → GitHub Actions → JSON → Website.

Yêu cầu:

1. Xây dựng script đọc Google Sheets.
2. Hỗ trợ Google Sheets API khi nguồn cần xác thực.
3. Hỗ trợ CSV công khai khi Sheet được chia sẻ phù hợp.
4. Chuẩn hóa dữ liệu.
5. Loại bản ghi không hợp lệ.
6. Chuẩn hóa ngày giờ.
7. Loại bỏ bản ghi trùng theo quy tắc xác định.
8. Tạo file `news.json` và `metadata.json`.
9. Ghi log số bản ghi đầu vào, hợp lệ, trùng, bị loại và số bản ghi đầu ra.
10. Chỉ thay thế dữ liệu hiện hành khi kết quả đồng bộ và kiểm tra chất lượng thành công.
11. Khi lỗi, giữ nguyên bản dữ liệu hợp lệ gần nhất.
12. Không xóa các tin cũ chỉ vì lần đồng bộ hiện tại trả về rỗng bất thường.

Mặc định GitHub Actions chạy mỗi 30 phút và hỗ trợ chạy thủ công.

Lưu ý GitHub Actions có thể chạy trễ so với lịch, vì vậy website cần hiển thị chính xác thời gian cập nhật cuối cùng, không cam kết dữ liệu thời gian thực.

Đảm bảo:

- Không đưa credentials lên frontend.
- Không commit API key hoặc service account JSON.
- Sử dụng GitHub Secrets khi cần.
- Giới hạn quyền workflow theo nguyên tắc tối thiểu.
- Dùng concurrency để tránh các lần đồng bộ chạy đè nhau.
- Đặt timeout và cơ chế retry có giới hạn.
- Không sử dụng nội dung hoặc URL ngoài danh sách giao thức an toàn.
- Không render HTML chưa được làm sạch từ nguồn dữ liệu.

## 6. Hiệu năng và trải nghiệm người dùng

Yêu cầu:

- Lazy loading hình ảnh.
- Skeleton loading.
- Tải từng phần danh sách tin.
- Responsive images.
- Cache dữ liệu hợp lý.
- Hỗ trợ khi mạng chậm.
- Có trạng thái dữ liệu cũ hoặc lỗi kết nối.
- Không hiển thị danh sách trắng khi đồng bộ lỗi.
- Tránh layout shift.
- Không phụ thuộc ảnh từ bên ngoài để hiển thị được tiêu đề tin.

Mục tiêu kiểm thử Lighthouse trên thiết bị mobile mô phỏng:

- Performance ≥ 90.
- Accessibility ≥ 90.
- Best Practices ≥ 90.
- SEO ≥ 90.

Các chỉ tiêu là mục tiêu kỹ thuật, phải đo thực tế và báo cáo nếu chưa đạt.

## 7. Chức năng bổ sung

### 7.1. Lưu bài

- Lưu danh sách yêu thích bằng localStorage.
- Hỗ trợ bỏ lưu.
- Xử lý trường hợp trình duyệt chặn localStorage.
- Không yêu cầu đăng nhập trong phiên bản đầu tiên.

### 7.2. Chia sẻ

- Dùng Web Share API nếu khả dụng.
- Nếu không có, cho phép sao chép URL bài gốc.
- Cung cấp phản hồi rõ sau thao tác.

### 7.3. Thống kê

Hiển thị các chỉ số dựa trên dữ liệu thực tế:

- Tổng số tin hôm nay.
- Tổng số tin trong 24 giờ.
- Số chuyên mục.
- Số nguồn tin.
- Số tin Việt Nam và quốc tế.

Không hiển thị chỉ số ảo hoặc số liệu mẫu như dữ liệu thật.

### 7.4. SEO

- Tạo title và description phù hợp.
- Open Graph metadata.
- Sitemap nếu phù hợp.
- robots.txt.
- Favicon.
- Semantic HTML.

## 8. Công nghệ

Sử dụng:

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- GitHub Actions
- GitHub Pages
- Node.js hoặc Python cho ETL

Tránh các thư viện không cần thiết.

Thiết kế theo hướng có thể mở rộng nhưng không triển khai backend phức tạp khi chưa có nhu cầu.

## 9. Cấu trúc source code

Đề xuất:

- src/components
- src/pages
- src/hooks
- src/services
- src/types
- src/utils
- src/styles
- scripts
- public/data
- tests
- .github/workflows
- README.md
- .env.example

Tách riêng:

- Logic đọc dữ liệu.
- Logic ánh xạ schema.
- Logic xử lý thời gian.
- Logic tìm kiếm và lọc.
- UI components.
- Cấu hình deployment.

## 10. Triển khai GitHub Pages

Yêu cầu:

1. Tạo project hoàn chỉnh.
2. Khởi tạo Git repository.
3. Cấu hình Vite base path tương ứng repository.
4. Cấu hình workflow build và deploy lên GitHub Pages.
5. Sử dụng workflow deployment được GitHub hỗ trợ với quyền tối thiểu cần thiết.
6. Hỗ trợ deployment tự động khi push lên main.
7. Đảm bảo dữ liệu đồng bộ mới được đưa vào bản build website.
8. Không tạo vòng lặp workflow không kiểm soát.
9. Hướng dẫn cấu hình GitHub Pages.
10. Hỗ trợ domain tùy chỉnh trong tương lai.

Nếu có GitHub authentication và quyền repository:

- Tạo repository mới theo tên được xác nhận.
- Push source code.
- Cấu hình GitHub Pages.
- Triển khai và xác minh URL hoạt động.

Nếu chưa có quyền GitHub, chuẩn bị đầy đủ source và hướng dẫn các thao tác cần người dùng thực hiện. Không tuyên bố đã xuất bản khi chưa triển khai thành công.

## 11. Kiểm thử bắt buộc

Viết test cho:

- Ánh xạ cột dữ liệu.
- Sheet rỗng.
- Thiếu cột.
- Dữ liệu null.
- Ngày giờ không hợp lệ.
- Dữ liệu trùng.
- Phân loại Việt Nam/quốc tế.
- Lọc hôm nay và 24 giờ.
- Chuyển đổi múi giờ.
- Tìm kiếm tiếng Việt có dấu và không dấu.
- URL không an toàn.
- Lỗi API.
- Chuyển sang bản dữ liệu cache.
- Hiển thị trên màn hình 320px, 375px, 390px, tablet và desktop.
- Build và deployment.

Kiểm thử các trường hợp đặc biệt như tin được thu thập hôm nay nhưng xuất bản hôm qua, tin thiếu hình ảnh, nguồn bài lỗi và nội dung rất dài.

## 12. Tiêu chí nghiệm thu

Website được coi là hoàn thành khi:

- Dữ liệu hiển thị khớp Google Sheets.
- Không sinh tin tức giả.
- Tin mới nhất hiển thị đúng thứ tự.
- Bộ lọc ngày, chuyên mục và khu vực hoạt động đúng.
- Giao diện điện thoại dễ đọc và không tràn ngang.
- Đồng bộ định kỳ hoạt động.
- Đồng bộ lỗi không làm mất dữ liệu hiện có.
- Có thông báo thời gian cập nhật.
- Các liên kết bài gốc hoạt động đúng.
- Build và tests thành công.
- GitHub Pages truy cập được.
- Có README hướng dẫn vận hành và xử lý lỗi.

## 13. Quy trình thực hiện cho Codex

Thực hiện theo từng giai đoạn:

**Phase 1 – Discovery**

- Kiểm tra Google Sheets.
- Xác định schema.
- Đề xuất mapping.
- Xác nhận các điểm chưa rõ.

**Phase 2 – Architecture**

- Thiết kế cấu trúc project.
- Thiết kế pipeline dữ liệu.
- Xác định bảo mật và quyền truy cập.

**Phase 3 – Development**

- Xây dựng UI.
- Xây dựng ETL.
- Xây dựng lọc và tìm kiếm.
- Xây dựng lưu bài và chia sẻ.

**Phase 4 – Testing**

- Unit tests.
- Integration tests.
- Mobile responsive tests.
- Kiểm thử dữ liệu thực.
- Lighthouse audit.

**Phase 5 – Deployment**

- Cấu hình GitHub Actions.
- Publish GitHub Pages.
- Kiểm tra website thực tế.

**Phase 6 – Handover**

Bàn giao:

1. GitHub repository URL.
2. Website URL.
3. Source code đầy đủ.
4. Tài liệu cấu hình Google Sheets.
5. Tài liệu triển khai.
6. Hướng dẫn vận hành.
7. Báo cáo kết quả kiểm thử.
8. Danh sách hạn chế và cải tiến tiếp theo.

Hãy bắt đầu bằng Phase 1. Sau khi kiểm tra nguồn dữ liệu, trình bày schema thực tế, phương án mapping và kế hoạch triển khai. Tiếp tục xây dựng trong phạm vi đã xác định; chỉ hỏi người dùng khi thiếu quyền hoặc cần quyết định ảnh hưởng đáng kể đến thiết kế hoặc bảo mật.