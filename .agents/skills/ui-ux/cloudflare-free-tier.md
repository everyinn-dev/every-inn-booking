# Cloudflare Free Tier Infrastructure Constraints & Algorithmic Guardrails

> **Target Platform**: Cloudflare Workers + Cloudflare D1 (SQLite at the Edge)  
> **Source Reference**: [Cloudflare Developer Documentation](https://developers.cloudflare.com/) (Workers Limits, D1 Platform Limits, Storage & Memory Architecture)

Tài liệu này định nghĩa các nguyên tắc bắt buộc khi thiết kế giải thuật, truy vấn cơ sở dữ liệu và triển khai code cho hệ thống **Every Inn Admin Panel**, nhằm đảm bảo **tính ổn định tuyệt đối và không vượt giới hạn gói Free của Cloudflare**.

---

## 📊 1. Bảng Thông Số Giới Hạn Gói Miễn Phí (Cloudflare Free Tier)

| Tài nguyên | Giới hạn Free Tier | Rủi ro nếu không tối ưu |
| :--- | :--- | :--- |
| **Worker CPU Time** | **10 ms** / request | Lỗi `Error 1101: Worker exceeded CPU limit` (sập Worker ngay lập tức) |
| **Worker Memory** | **128 MB** / isolate | Lỗi OOM (Out Of Memory) khi nạp danh sách lớn |
| **Worker Requests** | **100.000** requests / ngày | Toàn bộ hệ thống bị chặn truy cập sau khi hết quota |
| **Worker Subrequests** | **50** outbound fetch / request | Thất bại khi gửi thông báo (Telegram, VietQR, Zalo) |
| **Worker Bundle Size** | **3 MB** (compressed) | Lỗi build / deploy thất bại từ `@opennextjs/cloudflare` |
| **D1 Rows Read** | **5.000.000** rows / ngày | **Nguy cơ cao nhất!** Quét bảng không index đốt 5M dòng chỉ sau vài trăm query |
| **D1 Rows Written** | **100.000** rows / ngày | Không thể tạo/sửa booking nếu ghi bừa bãi |
| **D1 Database Size** | **500 MB** / database | Đầy dung lượng lưu trữ |
| **D1 SQL Query Size** | **100 KB** / statement | Lỗi từ chối câu truy vấn quá dài |
| **D1 Bound Parameters** | **100** tham số / câu lệnh | Lỗi khi dùng `IN (?, ?, ...)` với danh sách dài |
| **D1 Batch Statements** | **100** statements / batch | Thất bại khi thực thi khối giao dịch |

---

## 🗄️ 2. Quy Tắc Cơ Sở Dữ Liệu D1 (D1 Database Guardrails)

### 2.1. Quy tắc "Zero-Unindexed Scans" (Tuyệt đối không quét toàn bảng)
- **Cơ chế tính quota của Cloudflare D1**: D1 tính quota dựa trên **SỐ DÒNG BỊ QUÉT (Rows Read)**, không phải số câu lệnh!
  - *Ví dụ thảm họa*: Bảng `bookings` có 5.000 dòng. Một câu lệnh `SELECT * FROM bookings WHERE member_phone = ?` nếu **không có index** sẽ quét toàn bộ 5.000 dòng. Chỉ cần lễ tân thao tác 1.000 lượt trong ngày: `5.000 x 1.000 = 5.000.000 rows read` $\rightarrow$ **Cạn kiệt 100% quota D1 của cả ngày!**
  - *Khi có Index*: Chỉ quét đúng 1 - 5 dòng khớp $\rightarrow$ Tiết kiệm 99.9% quota.
- **Yêu cầu bắt buộc**:
  - Mọi cột xuất hiện trong `WHERE`, `ORDER BY`, `JOIN` của các bảng tăng trưởng theo thời gian (`bookings`, `members`, `room_blocks`, `staff_sessions`, `event_logs`) **BẮT BUỘC PHẢI CÓ INDEX**.
  - Truy vấn Gantt theo khoảng thời gian (`checkin_at`, `checkout_at`) phải luôn được hỗ trợ bởi composite index.

### 2.2. Quy tắc Selective Projection (Chỉ lấy cột cần thiết)
- **CẤM**: `SELECT * FROM bookings ...` trong các truy vấn nghiệp vụ hàng ngày hoặc API dashboard.
- **ĐÚNG**: `SELECT id, room_id, member_phone, member_name, checkin_at, checkout_at, total_price, status FROM bookings ...`
- **Lợi ích**: Giảm băng thông I/O giữa D1 engine và Worker, giảm CPU giải mã JSON, tiết kiệm bộ nhớ 128MB của isolate.

### 2.3. Quy tắc Nguyên Tử qua `db.batch()` (Atomic Transaction & Write Coalescing)
- D1 là SQLite phân tán, các thao tác ghi (Write) phải đi qua single primary coordinator và bị serialize.
- Khi một nghiệp vụ cần thay đổi nhiều bảng (ví dụ: Tạo booking + Cập nhật tổng chi tiêu / hạng thẻ của Member + Ghi Event Log):
  - **CẤM**: Chạy 3 lệnh `await stmt.run()` riêng lẻ tuần tự.
  - **BẮT BUỘC**: Sử dụng `await db.batch([stmt1, stmt2, stmt3])`.
  - **Lợi ích**:
    1. Đảm bảo tính toàn vẹn (ACID transaction) — nếu 1 câu lỗi, toàn bộ rollback.
    2. Chỉ tốn **1 network round-trip** duy nhất tới D1.
    3. Giảm thiểu tối đa thời gian chiếm giữ Write Lock.

### 2.4. Phân trang bắt buộc (Pagination Constraint)
- Mọi API danh sách (`/api/bookings`, lịch sử khách hàng, audit log) phải có `LIMIT` (mặc định $\le 50$, tối đa 100) và `OFFSET` hoặc Keyset Pagination (`WHERE id < ? ORDER BY id DESC LIMIT 50`).

### 2.5. Giới hạn Bound Parameters
- Khi tìm kiếm theo danh sách ID dạng `WHERE id IN (?, ?, ...)`, số lượng phần tử không được vượt quá **50 tham số**. Nếu danh sách lớn hơn, phải chia nhỏ thành các batch hoặc tổ chức lại logic truy vấn.

---

## ⚡ 3. Quy Tắc Cloudflare Workers & Thuật Toán (Workers CPU & Memory)

### 3.1. Rào Cản 10ms CPU Time (Strict 10ms CPU Budget)
- **Bản chất**: 10ms là thời gian CPU của Worker xử lý tính toán thực tế (User CPU execution time), không tính thời gian chờ mạng (I/O wait). Tuy nhiên, môi trường V8 Isolate sẽ ngắt Worker ngay khi chạm ngưỡng 10ms.
- **Cảnh báo cực hạn về Mật Khẩu (Bcrypt Warning)**:
  - `bcryptjs` viết bằng Pure JavaScript rất tốn CPU.
  - Salt rounds $\ge 12$ trong Worker chắc chắn sẽ gây văng lỗi **Error 1101 (CPU Limit Exceeded)**.
  - **Quy tắc**: Chỉ dùng `bcrypt.genSalt(10)` làm giới hạn trần. Trong tương lai ưu tiên chuyển dần sang Web Crypto API (`crypto.subtle.deriveBits` với PBKDF2).
- **Độ phức tạp giải thuật**:
  - Mọi logic xử lý mảng trên Worker (tính giá, gom nhóm booking, map dữ liệu Gantt) phải đạt độ phức tạp tuyến tính **$O(N)$** hoặc tuyến tính log **$O(N \log N)$**.
  - **CẤM** lồng vòng lặp $O(N^2)$ hoặc $O(N^3)$ trên các mảng dữ liệu lớn.
  - Tránh Regex phức tạp có nguy cơ Backtracking (ReDoS).

### 3.2. Quản Lý Bộ Nhớ 128 MB (Memory Management)
- Không lưu trữ các đối tượng khổng lồ trong bộ nhớ.
- Cấu trúc In-Process Cache (`src/lib/cache.ts`):
  - Chỉ cache **Master Data** (Phòng, Bảng giá, Quy tắc giờ, Hạng CDP).
  - Phải có cơ chế dọn dẹp TTL và không được để `Map` phình to không giới hạn.
  - Không cache dữ liệu giao dịch động (`bookings`) trong bộ nhớ module vì nguy cơ stale state.

### 3.3. Bản Chất Phi Trạng Thái (Stateless & Ephemeral Isolates)
- Cloudflare Workers chạy trên hơn 300 trung tâm dữ liệu toàn cầu. Hai request kế tiếp nhau có thể rơi vào hai Worker isolate hoàn toàn khác nhau.
- **Quy tắc**:
  - Biến toàn cục module (`let cache = ...`) chỉ có tính chất tăng tốc cục bộ, **KHÔNG ĐƯỢC COI LÀ SINGLE SOURCE OF TRUTH**.
  - **CẤM** dùng biến trong bộ nhớ để làm Khóa giữ phòng (Hold Lock) hoặc bộ đếm phòng trống. Mọi trạng thái cạnh tranh (concurrency) phải lưu và kiểm tra trong D1 SQLite.
  - **CẤM** dùng `setTimeout` hoặc `setInterval` chạy ngầm sau khi trả về Response, vì Worker sẽ bị đóng băng (freeze) ngay khi stream response kết thúc.

### 3.4. Bảo Vệ Quota 100.000 Requests/Ngày (Client-Side Polling)
- Giao diện Admin/Dashboard:
  - Tần suất tự động làm mới (polling interval) phải $\ge 30$ giây. Tuyệt đối không đặt polling 1s - 5s.
  - Áp dụng cơ chế **Debounce / Throttle** khi gõ ô tìm kiếm số điện thoại (tối thiểu 300ms - 500ms).
  - Thêm cờ `stale-while-revalidate` và `Cache-Control: private, no-cache` hợp lý.

### 3.5. Outbound Subrequests ($\le 50$)
- Mỗi request xử lý chỉ được gọi tối đa 1-3 outbound fetch ra dịch vụ ngoài (Telegram Bot, VietQR API).
- Phải có cơ chế `try/catch` bọc ngoài và timeout rõ ràng ($\le 5000\text{ms}$) để tránh treo Worker.

---

## 🛠️ 4. Bảng Tra Cứu Xử Lý Nghiệp Vụ Theo Giới Hạn Hạ Tầng

| Nghiệp Vụ Khách Sạn | Giải Thuật / Cách Code Truyền Thống (Dễ lỗi) | Giải Thuật Thích Ứng Cloudflare Free Tier (Đạt chuẩn) |
| :--- | :--- | :--- |
| **Kiểm tra trùng phòng khi đặt** | `SELECT * FROM bookings` rồi lặp `for` kiểm tra giờ trong JS. | Dùng truy vấn SQL có Index: `SELECT id FROM bookings WHERE room_id = ? AND status != 'cancelled' AND checkin_at < ? AND checkout_at > ? LIMIT 1`. |
| **Tra cứu khách hàng cũ theo SĐT** | Tìm kiếm ngay khi gõ từng phím (`onChange`). | Debounce 400ms trên client. Server truy vấn `SELECT phone, full_name, loyalty_tier FROM members WHERE phone = ?` qua Primary Key index. |
| **Tạo Booking + Cập nhật CDP** | Chạy 3 câu lệnh riêng biệt qua 3 lần `await`. | Đóng gói câu lệnh INSERT booking, UPSERT member, INSERT event_log vào **`db.batch([...])`**. |
| **Hiển thị Biểu đồ Gantt 24h** | Quét toàn bộ bảng bookings mọi ngày. | Giới hạn khung giờ `checkin_at <= end_of_day AND checkout_at >= start_of_day` với index trên trường thời gian. |
| **Giữ phòng tạm 5 phút (Hold)** | Dùng `setTimeout(() => cancel(), 300000)` trong Worker. | Lưu `hold_expires_at = datetime('now', '+5 minutes')` vào D1. Query lọc `WHERE hold_expires_at > datetime('now')`. Dọn dẹp lười (Lazy sweep) khi có query mới. |
| **Tính giá theo công thức** | Gọi đệ quy hoặc gọi API ngoài nhiều lần. | Tính toán thuần túy bằng hàm thuần túy (Pure Function) trong `src/lib/pricing.ts` với Master Data đã nạp từ bộ nhớ cache. |

---

## 📋 5. Checklist Trước Khi Commit Code (Developer & Agent Checklist)

- [ ] 1. Mọi câu lệnh SQL mới có sử dụng `WHERE` hoặc `ORDER BY` đã có `INDEX` tương ứng chưa?
- [ ] 2. Câu lệnh `SELECT` đã chỉ định rõ danh sách cột, không dùng `SELECT *` bừa bãi?
- [ ] 3. Các thao tác ghi đồng thời nhiều bảng đã được bọc trong `db.batch()` chưa?
- [ ] 4. Không có vòng lặp lồng $O(N^2)$ hay xử lý dữ liệu nặng gây quá 10ms CPU time?
- [ ] 5. Mật khẩu không dùng salt rounds $> 10$?
- [ ] 6. Master data ít thay đổi đã được đọc qua `src/lib/cache.ts` chưa?
- [ ] 7. Các thao tác fetch ra ngoài (Telegram, VietQR) có giới hạn thời gian chờ (timeout) không?
- [ ] 8. Giao diện frontend không tạo vòng lặp request / polling dồn dập dưới 30s?
