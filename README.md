# Universal Web Summarizer

Actor **Universal Web Summarizer** là một ứng dụng [Apify Actor](https://apify.com/) nhận vào một URL bất kỳ, tự động trích xuất nội dung chính của trang web, sau đó dùng mô hình ngôn ngữ lớn (LLM) thông qua [OpenRouter](https://openrouter.ai) để tóm tắt nội dung theo yêu cầu của người dùng — bao gồm độ dài, ngôn ngữ và định dạng đầu ra.

Đây là bản **v1** — kiến trúc được thiết kế theo 4 lớp độc lập (Fetch → Extract → Summarize → Output), giúp dễ dàng mở rộng sang các phiên bản sau này (v2: xử lý nhiều URL, v3: định dịnh dạng output phong phú hơn ...).

---

## Tính năng chính

- **Hỗ trợ trang động (SPA)** — Thử lấy nội dung bằng `got-scraping` trước; nếu trang cần JavaScript để hiển thị nội dung, tự động chuyển sang `Playwright` để render HTML.
- **Trích xuất nội dung chính** — Dùng `@mozilla/readability` loại bỏ menu, quảng cáo, footer, giữ lại phần nội dung chính của bài viết.
- **Tóm tắt thông minh bằng LLM** — Gửi prompt động tới OpenRouter dựa trên `summaryLength`, `language` và `outputFormat` do người dùng chỉ định.
- **Xử lý lỗi toàn diện** — Mỗi bước đều được bọc trong try/catch; lỗi được ghi nhận rõ ràng vào Dataset với `status: "error"` thay vì để actor bị crash.
- **Tái thử khi gọi API** — Tự động retry (tối đa 2 lần) nếu OpenRouter trả lỗi 429 (rate limit) hoặc lỗi server 5xx.
- **Theo dõi chi phí** — Kết quả trả về bao gồm thông tin `llm.model` và `llm.usage` để dễ dàng giám sát số token đã tiêu tốn.

---

## Cài đặt môi trường

### Yêu cầu

- Node.js >= 20
- npm

### Các bước cài đặt

```bash
# 1. Clone repository về máy
git clone https://github.com/undead04/universal-web-summarizer.git
cd universal-web-summarizer

# 2. Cài đặt dependencies
npm install

# 3. Cài đặt trình duyệt Chromium cho Playwright (cần thiết cho trang SPA)
npx playwright install chromium
```

---

## Cấu hình

Actor cần một khóa API từ OpenRouter để gọi LLM. Đặt khóa này dưới dạng biến môi trường:

| Biến môi trường | Mô tả | Giá trị mặc định | Bắt buộc |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Khóa API OpenRouter của bạn | — | Có |
| `OPENROUTER_MODEL` | Mô hình LLM trên OpenRouter | `openrouter/free` | Không |
| `OPENROUTER_SITE_URL` | URL trang web của bạn (dùng để OpenRouter xác định nguồn) | `https://apify.com` | Không |
| `OPENROUTER_APP_NAME` | Tên ứng dụng (dùng để OpenRouter xác định nguồn) | `Universal Web Summarizer` | Không |

Trưởng: Bạn có thể đăng ký và lấy `OPENROUTER_API_KEY` miễn phí tại [https://openrouter.ai](https://openrouter.ai).

---

## Chạy cục bộ

### Cách 1: Chạy trong môi trường dev (TypeScript trực tiếp)

```powershell
npm install
$env:OPENROUTER_API_KEY = "sk-or-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
npm run dev
```

### Cách 2: Build và chạy (giống production)

```powershell
$env:OPENROUTER_API_KEY = "sk-or-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
npm start
```

`npm start` sẽ tự động biên dịch TypeScript sang JavaScript trong thư mục `dist/`, sau đó chạy `node dist/main.js`.

### Cách 3: Build riêng (chỉ biên dịch, không chạy)

```powershell
npm run build      # Biên dịch sang thư mục dist/
npm run check      # Kiểm tra TypeScript không cần emit (typecheck)
```

---

## Input

Actor đọc input từ **Apify Actor input**. Khi chạy cục bộ, bạn cần tạo file input manually:

**Bước:** Tạo file `storage/key_value_stores/default/INPUT.json` trong thư mục dự án với nội dung:

```json
{
  "url": "https://example.com/bai-viet",
  "summaryLength": "short",
  "language": "vi",
  "outputFormat": "bullet_points"
}
```

### Bảng mô tả các trường input

| Trường | Kiểu | Giá trị hợp lệ | Mô tả |
|---|---|---|---|
| `url` | string | URL hợp lệ (http/https) | **Bắt buộc.** URL của trang web cần được tóm tắt. |
| `summaryLength` | string | `short` / `medium` / `long` | Độ dài bản tóm tắt. Mặc định: `medium`. |
| `language` | string | `vi` / `en` / `auto` | Ngôn ngữ của bản tóm tắt. `auto` = tự động nhận diện theo ngôn ngữ gốc của bài viết. Mặc định: `auto`. |
| `outputFormat` | string | `paragraph` / `bullet_points` | Định dạng đầu ra. `paragraph` = đoạn văn, `bullet_points` = danh sách gạch đầu dòng. Mặc định: `paragraph`. |

### Mô tả chi tiết từng chế độ

**summaryLength:**
- `short`: Tóm tắt trong 2–4 câu ngắn gọn.
- `medium` (mặc định): Tóm tắt trong 1–2 đoạn ngắn, nêu bật các luận điểm chính và chi tiết quan trọng.
- `long`: Tóm tắt trong 4–7 đoạn, giữ nguyên luận luận, bằng chứng và kết luận.

**language:**
- `vi`: Tóm tắt bằng tiếng Việt.
- `en`: Tóm tắt bằng tiếng Anh.
- `auto` (mặc định): Tóm tắt bằng ngôn ngữ gốc của bài viết.

**outputFormat:**
- `paragraph` (mặc định): Đầu ra dưới dạng đoạn văn thông thường.
- `bullet_points`: Đầu ra dưới dạng danh sách gạch đầu dòng, mỗi ý tưởng một dòng.

---

## Output (Dataset)

Kết quả được ghi vào **Apify Dataset**, với hai dạng tùy theo trạng thái thành công/lỗi:

### Khi thành công (`status: "success"`)

```json
{
  "url": "https://example.com/bai-viet",
  "status": "success",
  "title": "Tiêu đề bài viết",
  "summary": "Nội dung tóm tắt ...",
  "wordCount": 850,
  "processingTimeMs": 3200,
  "llm": {
    "model": "openrouter/free",
    "usage": { "prompt_tokens": 1200, "completion_tokens": 180, "total_tokens": 1380 }
  },
  "fetchSource": "playwright"
}
```

### Khi lỗi (`status: "error"`)

```json
{
  "url": "https://example.com/bai-viet",
  "status": "error",
  "errorMessage": "Could not extract the main article content",
  "processingTimeMs": 1500
}
```

### Giải thích các trường output

| Trường | Mô tả |
|---|---|
| `url` | URL đã được xử lý (có thể null nếu lỗi ở bước validate URL). |
| `status` | `success` hoặc `error`. |
| `title` | Tiêu đề bài viết được trích xuất (chỉ có ở kết quả thành công). |
| `summary` | Nội dung bản tóm tắt từ LLM (chỉ có ở kết quả thành công). |
| `wordCount` | Số từ được trích xuất từ bài viết gốc. |
| `processingTimeMs` | Thời gian xử lý tính bằng mili giây (từ lúc bắt đầu đến khi kết thúc). |
| `llm.model` | Tên mô hình LLM đã sử dụng. |
| `llm.usage` | Thông tin số token tiêu thụ từ OpenRouter (có thể null nếu API không trả về). |
| `fetchSource` | Phương thức lấy HTML: `http` (got-scraping) hoặc `playwright` (fallback). |
| `errorMessage` | Thông điệp lỗi (chỉ có ở kết quả lỗi). |

---

## Kiến trúc pipeline

Dự án tuân theo kiến trúc 4 lớp (pipeline):

```
[Input] → [1. Fetch] → [2. Extract] → [3. Summarize (LLM)] → [4. Output]
```

### 1. Fetch (`src/fetch.ts`)

- Thử lấy nội dung trang bằng `got-scraping` (nhẹ, nhanh, phù hợp với trang HTML tĩnh).
- Nếu lấy được HTML hợp lệ (độ dài > 200 ký tự và chứa thẻ `<body>`), trả về ngay với `source: "http"`.
- Nếu thất bại (timeout, lỗi mạng, trang rỗng), tự động chuyển sang `Playwright` để render JavaScript và lấy HTML đã được render, với `source: "playwright"`.
- Timeout tối đa: 15 giây cho mỗi lần fetch.

### 2. Extract (`src/extract.ts`)

- Dùng thư viện `@mozilla/readability` (cùng thuật toán với Firefox Reader Mode) để phân tích HTML và trích xuất phần nội dung chính của bài viết.
- Loại bỏ toàn bộ thành phần không cần thiết: menu điều hướng, quảng cáo, footer, bình luận...
- Làm sạch khoảng trắng thừa, chuẩn hoá đoạn văn.
- Nếu không trích xuất được nội dung (trang chỉ toàn ảnh/video, hoặc bị chặn), ném ra lỗi để bước Output ghi nhận `status: "error"`.

### 3. Summarize (`src/summarize.ts`)

- Cắt bớt nội dung nếu quá dài (giới hạn 40.000 ký tự) để tránh vượt quá giới hạn ngữ cảnh của mô hình LLM.
- Dựng prompt động dựa trên `summaryLength`, `language` và `outputFormat`.
- Gửi yêu cầu POST tới API chat completion của OpenRouter.
- Xử lý retry tự động: nếu nhận lỗi 429 (rate limit) hoặc 5xx (lỗi server), chờ và thử lại (tối đa 2 lần).
- Trả về `{ summary, usage, model }`.

### 4. Output (`src/output.ts`)

- Ghi kết quả cuối cùng vào Apify Dataset thông qua `Actor.pushData()`.
- Có hai hàm: `pushSuccess()` cho kết quả thành công và `pushError()` cho kết quả thất bại.
- Đảm bảo cấu trúc output luôn ổn định và dễ phân tích.

### Các lớp hỗ trợ

- `src/main.ts` — Điểm vào chính của Actor. Khởi tạo Apify Actor, đọc input, điều phối toàn bộ pipeline và xử lý lỗi toàn cục.
- `src/types.ts` — Định nghĩa kiểu TypeScript cho toàn bộ dự án (ActorInput, Article, LlmResult, SuccessOutput, ...).

---

## Cấu trúc thư mục dự án

```
universal-web-summarizer/
├── src/                    # Mã nguồn TypeScript
│   ├── main.ts             # Điểm vào chính của Actor
│   ├── fetch.ts            # Module lấy nội dung trang web
│   ├── extract.ts          # Module trích xuất nội dung chính
│   ├── summarize.ts        # Module gọi LLM tóm tắt qua OpenRouter
│   ├── output.ts           # Module ghi kết quả ra Dataset
│   └── types.ts            # Định nghĩa kiểu TypeScript
├── dist/                   # Thư mục build (TypeScript → JavaScript)
├── .actor/                 # Cấu hình Apify Actor
│   └── input_schema.json   # Schema input
├── storage/                # Dữ liệu cục bộ (khi chạy offline)
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## Các lệnh npm

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy trực tiếp bằng `tsx` (không cần biên dịch). |
| `npm run build` | Biên dịch TypeScript sang JavaScript trong `dist/`. |
| `npm start` | Build rồi chạy `dist/main.js` (giống môi trường production). |
| `npm run check` | Kiểm tra kiểu TypeScript mà không cần tạo file (`noEmit`). |
| `npm test` | Chạy unit test bằng Node.js test runner. |

---

## Đóng góp (Contributing)

Mọi đóng góp đều được chào đón! Nếu muốn tham gia phát triển:

1. Fork repository này.
2. Tạo nhánh tính năng mới: `git checkout -b feature/ten-tinh-nang`.
3. Thực hiện thay đổi và commit: `git commit -m "Mô tả thay đổi"`.
4. Push nhánh lên remote: `git push origin feature/ten-tinh-nang`.
5. Mở Pull Request.

> Lưu ý: Tuân thủ chuẩn code TypeScript `strict` và đảm bảo `npm run check` không báo lỗi trước khi gửi PR.

---

## Giấy phép (License)

Dự án được cấp phép theo giấy phép MIT — bạn có thể tự do sử dụng, sửa đổi và phân phát lại.
