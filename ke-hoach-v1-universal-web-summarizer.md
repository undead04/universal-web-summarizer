# Kế hoạch v1 — Universal Web Summarizer
**Phiên bản nền tảng: Tóm tắt 1 URL**

---

## 1. Mục tiêu

Xây dựng actor đầu tiên trên Apify Store: nhận vào 1 URL bất kỳ, trích xuất nội dung chính của trang, dùng LLM tóm tắt lại theo yêu cầu người dùng (độ dài, ngôn ngữ, định dạng).

Đây là bản nền — kiến trúc phải đủ rõ ràng, tách lớp để các version sau (v2 batch, v3 output format...) dễ mở rộng mà không phải viết lại.

---

## 2. Input Schema

```json
{
  "url": "https://example.com/bai-viet",
  "summaryLength": "short",
  "language": "vi",
  "outputFormat": "paragraph"
}
```

| Field | Kiểu | Giá trị hợp lệ | Ghi chú |
|---|---|---|---|
| `url` | string | URL hợp lệ | Bắt buộc |
| `summaryLength` | string | `short` / `medium` / `long` | Mặc định `medium` |
| `language` | string | `vi` / `en` / `auto` | `auto` = tự nhận diện ngôn ngữ gốc bài viết |
| `outputFormat` | string | `paragraph` / `bullet_points` | Mặc định `paragraph` |

---

## 3. Kiến trúc pipeline (4 lớp tách biệt)

Thiết kế theo 4 module độc lập để dễ bảo trì và mở rộng sau này:

```
[1] Fetch  →  [2] Extract  →  [3] Summarize (LLM)  →  [4] Output
```

### [1] Fetch — Lấy nội dung trang
- Thử trước bằng `got-scraping` / `Cheerio` (nhanh, nhẹ, đủ dùng cho site tĩnh).
- Nếu không lấy được nội dung hợp lệ (trang rỗng, cần JS render) → fallback sang `Playwright`.
- Giới hạn timeout (ví dụ 15s) để tránh treo actor khi site phản hồi chậm.

### [2] Extract — Trích nội dung chính
- Dùng thư viện `@mozilla/readability` để lọc bỏ menu, quảng cáo, footer — chỉ giữ phần nội dung chính của bài viết.
- Chuyển kết quả sang plain text hoặc markdown sạch.
- Nếu không trích được nội dung (trang chỉ toàn ảnh/video, hoặc bị chặn) → trả lỗi rõ ràng ở bước này, không đi tiếp bước 3.

### [3] Summarize — Gọi LLM tóm tắt
- Cắt bớt nội dung nếu quá dài (giới hạn theo context window của model) để tránh lỗi hoặc tốn phí không cần thiết.
- Build prompt động theo `summaryLength`, `language`, `outputFormat`.
- Gọi API LLM (OpenAI/Anthropic), có retry (1-2 lần) nếu request lỗi tạm thời.

### [4] Output — Trả kết quả
- Ghi kết quả vào Dataset theo cấu trúc chuẩn (xem mục 4).
- Không cần Key-Value Store ở v1 (sẽ dùng từ v2 để lưu summary tổng quan khi có nhiều URL).

---

## 4. Cấu trúc Output (Dataset)

Thành công:
```json
{
  "url": "https://example.com/bai-viet",
  "status": "success",
  "title": "Tiêu đề bài viết",
  "summary": "Nội dung tóm tắt...",
  "wordCount": 850,
  "processingTimeMs": 3200
}
```

Lỗi:
```json
{
  "url": "https://example.com/bai-viet",
  "status": "error",
  "errorMessage": "Không thể trích xuất nội dung chính từ trang"
}
```

---

## 5. Những điểm cần xử lý kỹ ngay từ v1

| Vấn đề | Giải pháp |
|---|---|
| Trang cần JS render nhưng dùng Cheerio | Fallback tự động sang Playwright |
| Nội dung quá dài, vượt giới hạn LLM | Cắt bớt hoặc tóm tắt theo từng đoạn rồi gộp (map-reduce đơn giản) |
| URL không hợp lệ hoặc không truy cập được | Validate URL trước khi fetch, trả lỗi rõ ràng, không để actor crash |
| Trang có nội dung bằng ngôn ngữ khác `language` yêu cầu | Ghi rõ trong prompt: "dịch và tóm tắt sang ngôn ngữ X" |
| Chi phí gọi LLM không kiểm soát | Log số token đã dùng mỗi lần chạy để theo dõi |

---

## 6. Vì sao thiết kế này dễ nâng cấp lên các version sau

- Kiến trúc 4 lớp (Fetch → Extract → Summarize → Output) cho phép:
  - **v2**: chỉ cần thêm vòng lặp + concurrency control ở ngoài pipeline hiện có, không đổi logic bên trong từng lớp.
  - **v3**: chỉ cần đổi prompt template ở lớp Summarize để thêm output format mới.
  - **v4**: chỉ cần thêm module Fetch khác (PDF, YouTube transcript) song song với module Fetch hiện tại.
- Input schema để field đơn giản trước, nhưng đặt tên field sao cho dễ mở rộng (không đặt tên quá cụ thể gây khó thêm option mới).

---

## 7. Việc cần làm (checklist triển khai v1)

- [ ] Tạo actor mới trên Apify Console, đặt tên và mô tả
- [x] Viết `input_schema.json` theo mục 2
- [x] Cài đặt dependencies: `got-scraping`, `@mozilla/readability`, `jsdom`, `playwright` (optional fallback)
- [x] Viết module Fetch (HTTP nhanh, fallback Playwright)
- [x] Viết module Extract dùng Readability
- [x] Viết module Summarize gọi Gemini API, xử lý prompt theo input
- [x] Viết module Output, push kết quả vào Dataset
- [x] Chuyển source sang TypeScript, strict typecheck và build `dist/`
- [x] Xử lý lỗi ở từng bước, không để actor crash toàn bộ
- [ ] Test với 5-10 loại trang khác nhau (blog, tin tức, trang tĩnh, trang SPA)
- [x] Viết README cho Actor: mô tả, hướng dẫn chạy, ví dụ input/output
- [x] Chọn mô hình pricing: Pay-per-event, tính theo mỗi lần tóm tắt thành công
- [ ] Publish actor ở chế độ public

### Trạng thái kiểm thử local

- [x] Syntax check toàn bộ module
- [x] Smoke test fetch và Readability với `example.com`
- [x] Smoke test Gemini adapter bằng mock response
- [x] Kiểm tra schema và nhánh lỗi của Actor
- [ ] Chạy Gemini API thật bằng `GEMINI_API_KEY`
- [ ] Chạy đủ 5-10 loại trang trước khi publish

### Việc còn lại để deploy

1. Tạo Actor trên Apify Console và kết nối source này.
2. Cấu hình secret `GEMINI_API_KEY`.
3. Chọn pricing `Pay-per-event`, chỉ tính phí khi output có `status: "success"`.
4. Chạy test thật với nhiều loại URL.
5. Publish public sau khi kiểm tra Dataset và chi phí.

---

## 8. Kết quả mong đợi sau v1

- Actor chạy ổn định cho 1 URL, trả kết quả tóm tắt đúng yêu cầu.
- Có README và pricing rõ ràng trên Store.
- Kiến trúc sẵn sàng để mở rộng sang v2 (batch nhiều URL) mà không cần viết lại từ đầu.
