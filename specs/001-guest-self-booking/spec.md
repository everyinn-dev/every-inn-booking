# Feature Specification: Guest Self-Booking, Payment & Self Check-in Landing Page

- **Feature Branch**: `001-guest-self-booking`
- **Target Repository**: `every-inn-booking` (Landing Page BFF — `saigonliving`) + Core Extensions (`everyinn-booking-core`, `everyinn-cdp-core`, `everyinn-agent-core`)
- **Version**: 2.0.0 (Updated to Core Pricing v2.0, Real-world Operational Metrics & Edge Security)
- **Created**: 2026-04-20
- **Last Updated**: 2026-11-08
- **Status**: Approved for Implementation
- **Methodology**: [GitHub Spec-Kit (`github/spec-kit`)](https://github.com/github/spec-kit)
- **Related Canonical Docs**:
  - `every-inn-booking/specs/001-guest-self-booking/source-of-truth.md` (Highest Precedence)
  - `everyinn-platform-docs/CONVENTIONS.md`
  - `everyinn-platform-docs/EI_LANDING_SELF_BOOKING_SPEC.md`
  - `everyinn-platform-docs/EI_PRICING_AND_SURCHARGE_SPEC.md`
  - `everyinn-platform-docs/rules/cloudflare-free-tier.md`
  - `everyinn-platform-docs/skills/ui-ux/SKILL.md`

> [!IMPORTANT]
> **CANONICAL ALIGNMENT (2026-11-09)**: Xem [source-of-truth.md](file:///Users/lap14666/Documents/private/every%20inn/van%20hanh/booking-page/every-inn-booking/specs/001-guest-self-booking/source-of-truth.md) để đối chiếu trực tiếp với mã nguồn đang chạy (bước giờ nhận phòng 1 giờ chẵn `:00`, API Session Engine `/api/guest/sessions`, `/dat-phong/<token>`, rate limits, và logic trần giảm giá stacking).

---

## 1. Executive Summary & Business Goals

### 1.1. Mục tiêu nghiệp vụ (Business Objectives)
Hiện tại, khách hàng muốn đặt phòng tại **Every Inn** thường phải nhắn tin qua Fanpage/Instagram/Zalo chờ nhân viên trực page kiểm tra lịch trống, báo giá, tạo giữ chỗ, xác nhận chuyển khoản và gửi hướng dẫn check-in thủ công. Quy trình này tốn thời gian phản hồi và dễ mất khách vào khung giờ khuya.

Tính năng **Guest Self-Booking, Payment & Self Check-in Landing Page** cho phép khách hàng tự thực hiện trọn vẹn hành trình **End-to-End 24/7 ngay trên Landing Page (`every-inn-booking`)**:
1. **Tìm phòng trực quan (Agoda / Airbnb Mobile-First UX)** theo 3 hình thức:
   - **Theo giờ (`hourly`)**: Khung giờ nhận phòng từ **`08:00` đến `21:00`**, khởi điểm Combo 3h, mở rộng thêm giờ linh hoạt.
   - **Qua đêm (`overnight`)**: 4 ca chuẩn 12 tiếng (`21h-9h`, `22h-10h`, `23h-11h`, `24h-12h`), hiển thị các nút mua thêm giờ nhận sớm / trả muộn với đơn giá niêm yết **`+60.000đ/giờ`** theo ma trận giới hạn ca và lịch trống thực tế.
   - **Theo ngày (`dayuse`)**: Tối giản chỉ chọn Ngày nhận và Ngày trả phòng, cố định mốc chuẩn **15:00 check-in và 12:00 check-out**.
2. **Tự động hóa hậu cần & Nghiệp vụ lõi (Core Pricing v2.0 & CDP Engine)**:
   - Kiểm tra lịch phòng trống thời gian thực (kèm 60 phút dọn phòng `TURNOVER_MINUTES = 60` và giới hạn sức chứa từng hạng phòng: Haven max 2, Signature max 4).
   - Tự động tính giá chuẩn xác theo công thức Core v2.0:
     $$T_{\text{total}} = \max\Big(0,\; P_{\text{base}} - D_{\text{promo}} - D_{\text{loyalty}}\Big) + S_{\text{holiday}} + S_{\text{extra\_hours}} + S_{\text{extra\_guests}}$$
   - Tự động áp dụng chương trình khuyến mãi công khai tốt nhất (**Public Promotions** `is_public = 1`) hoặc mã giảm giá nội bộ (**Private Promo Code** `is_public = 0`).
   - Tự động nhận diện hội viên **CDP (`everyinn-cdp-core`)** qua SĐT để áp dụng ưu đãi hạng thẻ (`bronze`, `silver`, `gold`) và voucher thưởng từ chương trình tích tem 10 mốc (`EVERYINN_STAMP_10_V1`). Mọi chiết khấu chỉ giảm trên $P_{\text{base}}$, không giảm sang phụ thu.
   - Giữ phòng tạm thời **10 phút (`ttlSeconds = 600`)** chờ khách thanh toán qua mã **VietQR động** (MB Bank `0906314109999` — `HO KINH DOANH EVERY INN`).
   - Gửi thông báo **real-time qua Telegram** cho Quản lý ở **mọi trạng thái đơn**; ở bước thanh toán có nút bấm xác nhận trực tiếp cho Quản lý (con người) trên Telegram (`[✅ Đã nhận đủ]`, `[❌ Chưa nhận]`) — đồng thời sẵn sàng cổng **Webhook Banking API** (SePay / Casso / PayOS).
   - **KHÔNG sử dụng / phụ thuộc vào tính năng AI Chatbot đang thử nghiệm**: Toàn bộ luồng khách là Web UI tự phục vụ và bot Telegram chỉ phục vụ thông báo / tương tác nội bộ cho Quản lý.
   - **Tự động chuẩn bị/tạo trước mã cổng (`<pass_cổng>#`) & mã hộp khóa (`<pass lock box>`)** trong `everyinn-agent-core` và gửi tin nhắn nhắc Quản lý cài pass.
3. **Tra cứu & Nhận hướng dẫn Self Check-in 24/7 trên Landing Page riêng (`/checkin`)**:
   - Sau khi thanh toán được xác nhận, khách nhập **ít nhất 2 khóa xác thực (Multi-Key Lookup)** để mở trang Hướng dẫn Check-in cá nhân hóa với 4 khối nội dung cố định (Text nội quy & pass -> 2 Ảnh checkin/checkout -> Text taxi 71/31 -> Video lối vào).
4. **Hiệu năng & Bảo mật Cloudflare Edge**:
   - Tối ưu cho quy mô vận hành thực tế: ~20 khách nhắn page/ngày, ~120 bookings/tháng, traffic tìm phòng ~50 - 150 lượt/ngày (cao điểm 20 - 40 lượt/giờ).
   - Near-realtime thông qua **Adaptive Short-Polling (3-4s)** tại màn hình chờ thanh toán và **ETag / Domain Version checking** khi tìm phòng.
   - **Rate Limiting theo IP (`CF-Connecting-IP`)** tại Edge Worker để chặn bot cào lịch, flood hold rác và brute-force tra cứu mã phòng.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 — Tìm phòng & Chọn linh hoạt giờ Check-in/Check-out trên Thẻ Phòng (Priority: P1)

Khách truy cập Landing Page trên điện thoại hoặc máy tính, sử dụng thanh tìm kiếm phòng (Search Widget phong cách Airbnb/Agoda) với 3 tab **Theo giờ**, **Qua đêm**, **Theo ngày** để xem ngay danh sách các phòng thực sự còn trống cùng giá đã tính khuyến mãi và các nút cộng thêm giờ nhận sớm / trả muộn hợp lệ trên từng thẻ phòng.

**Why this priority**: Đây là phễu chuyển đổi đầu tiên và quan trọng nhất giúp khách không cần nhắn hỏi fanpage "tối nay còn phòng không?".

**Independent Test**: Có thể kiểm thử độc lập bằng cách gọi API tìm phòng với từng loại hình (`hourly`, `overnight` 4 ca, `dayuse`) và kiểm tra danh sách phòng trả về cùng số lượng nút `+1h/+2h/+3h checkin sớm` và `+1h/+2h/+3h checkout muộn` hiển thị chính xác theo quy tắc ca, đơn giá `60.000đ/giờ` và lịch trống D1.

#### Acceptance Scenarios:

1. **Given** khách ở Landing Page và chọn tab **Qua đêm (`overnight`)**, **When** khách chọn ngày nhận phòng và 1 trong 4 ca cơ bản (`21h-9h`, `22h-10h`, `23h-11h`, `24h-12h`) cùng số khách, **Then** hệ thống hiển thị danh sách các phòng trống trong khung giờ ca đó (đã tính 60 phút dọn phòng trước/sau) và trên mỗi thẻ phòng hiển thị các nút tùy chọn mua thêm giờ (`+60.000đ/giờ`) tuân thủ nghiêm ngặt **Ma trận giới hạn nút theo ca** VÀ **tình trạng trống thực tế của phòng**:
   - **Ca `21h-9h`**: Hiển thị tối đa **3 ô trả muộn** (`+1h checkout muộn (10h)`, `+2h (11h)`, `+3h (12h)`) và **0 ô nhận sớm** (do không thể nhận trước 21h).
   - **Ca `22h-10h`**: Hiển thị tối đa **2 ô trả muộn** (`+1h checkout muộn (11h)`, `+2h (12h)`) và tối đa **1 ô nhận sớm** (`+1h checkin sớm (21h)`).
   - **Ca `23h-11h`**: Hiển thị tối đa **1 ô trả muộn** (`+1h checkout muộn (12h)`) và tối đa **2 ô nhận sớm** (`+1h checkin sớm (22h)`, `+2h (21h)`).
   - **Ca `24h-12h` (00:00–12:00)**: Hiển thị tối đa **3 ô nhận sớm** (`+1h checkin sớm (23h)`, `+2h (22h)`, `+3h (21h)`) và **0 ô trả muộn** (do không thể trả sau 12h trưa).
2. **Given** phòng 202 trống ca `21h-9h` nhưng đã có đơn khác đặt từ `11:30` trưa hôm sau (cần dọn phòng từ `10:30` đến `11:30`), **When** hiển thị thẻ phòng 202 ở ca `21h-9h`, **Then** hệ thống chỉ cho phép bấm chọn **`+1h checkout muộn`** (trả lúc 10:00 + 60p dọn = 11:00 <= 11:30); hai nút `+2h checkout muộn` và `+3h checkout muộn` bị ẩn hoặc vô hiệu hóa rõ ràng vì vướng lịch phòng.
3. **Given** khách bấm bật/tắt một chip `+2h checkin sớm` hoặc `+1h checkout muộn` ngay trên thẻ phòng 102, **When** chip được chọn, **Then** tổng giá tạm tính cộng thêm chính xác `60.000đ/giờ`, khung giờ nhận/trả thực tế cập nhật tức thì mà không cần tải lại trang.
4. **Given** khách chọn tab **Theo ngày (`dayuse`)**, **When** giao diện hiển thị bộ lọc tìm kiếm, **Then** khách **chỉ cần chọn Ngày nhận phòng (`ngày in`) và Ngày trả phòng (`ngày out`)**, kèm dòng thông báo nổi bật: *"Giờ nhận phòng tiêu chuẩn: 15:00 · Giờ trả phòng: 12:00 trưa hôm sau"*, và hệ thống kiểm tra lịch trống chính xác từ `15:00` ngày in đến `12:00` ngày out (+ 60 phút turnover).
5. **Given** khách chọn tab **Theo giờ (`hourly`)**, **When** khách chọn ngày, giờ bắt đầu (từ `08:00` đến `21:00`, bước nhảy 30 phút) và thời lượng (`3 giờ`, `4 giờ`, `5 giờ+`), **Then** hệ thống hiển thị các phòng trống cùng bảng giá tương ứng theo hạng phòng (`Haven` 320k vs `Signature` 360k, giờ thêm 60k/h) và phụ thu khách thêm (nếu chọn phòng Signature từ khách thứ 3 trở lên: 150k/khách).

---

## User Story 2 — Giữ phòng 10 phút, Điền thông tin, Nhận diện CDP & Áp dụng Khuyến mãi (Priority: P1)

Khi khách chọn xong phòng (cùng các tùy chọn thêm giờ nếu có) và bấm **"Đặt phòng ngay"**, hệ thống tạo ngay một lệnh giữ phòng tạm thời (**Hold 10 phút**) và chuyển khách sang trang Điền thông tin & Thanh toán (`/book/[holdId]`).

**Why this priority**: Đảm bảo không xảy ra trùng lịch (double-booking) trong lúc khách đang nhập thông tin và chuyển khoản, đồng thời khóa cứng giá đã báo.

**Independent Test**: Bấm "Đặt phòng ngay" -> Kiểm tra D1 `room_holds` có `expires_at = created_at + 600s`, các `inventory_slots` tương ứng chuyển sang trạng thái `hold`, đồng hồ đếm ngược 10:00 chạy chính xác trên UI, và Telegram của Quản lý nhận được thông báo `⏳ [GIỮ PHÒNG MỚI - 10 PHÚT]`.

#### Acceptance Scenarios:

1. **Given** khách bấm **"Đặt phòng ngay"** trên thẻ phòng, **When** API `POST /api/guest/holds` thực thi thành công, **Then** phòng được khóa lịch trong đúng **10 phút (`ttlSeconds = 600`)**, đồng hồ đếm ngược `10:00` xuất hiện cố định ở thanh trên cùng, và Quản lý nhận thông báo Telegram đầu tiên về lượt giữ phòng mới.
2. **Given** khách đang ở bước điền thông tin, **When** khách nhập SĐT di động Việt Nam hợp lệ:
   - Hệ thống ngầm tra cứu `everyinn-cdp-core` (`POST /internal/v1/customers/loyalty-context`) để nhận diện hạng hội viên (`bronze`, `silver`, `gold`).
   - Hệ thống tự động so khớp ưu đãi công khai tốt nhất (**Public Promotion** `is_public = 1`).
   - Nếu khách nhập mã ưu đãi riêng tư (**Private Promo Code** `is_public = 0`), hệ thống kiểm tra tính hợp lệ và áp dụng mức giảm tối ưu.
   - Nếu khách có voucher tích tem khả dụng từ chu kỳ 10 tem (`nextAccrualPreview.reward`), hệ thống hiển thị tùy chọn áp dụng giảm trừ vào giá cơ bản ($P_{\text{base}}$).
3. **Given** khách nhập xong thông tin và bấm **"Tiếp tục thanh toán"**, **When** API `PATCH /api/guest/holds/[id]` thực thi, **Then** hệ thống lưu thông tin khách, tự động sinh `closingNote` chuẩn audit (`[WEB-SELF-BOOKING]`), chuyển trạng thái Hold sang `awaiting_payment`, sinh mã tham chiếu thanh toán duy nhất `EIPAY...`, và gửi thông báo Telegram cập nhật thông tin khách cho Quản lý.

---

## User Story 3 — Thanh toán VietQR, Quản lý Xác nhận qua Telegram & Sẵn sàng Webhook Banking (Priority: P1)

Khách quét mã VietQR (MB Bank `0906314109999` — `HO KINH DOANH EVERY INN`) với số tiền và nội dung chuyển khoản `EIPAY...` được điền sẵn. Khi khách bấm **"Tôi đã chuyển khoản"** (hoặc khi Webhook ngân hàng bắn về trong tương lai), Quản lý nhận được tin nhắn Telegram kèm nút bấm xác nhận ngay lập tức để hoàn tất đơn.

**Why this priority**: Giải quyết bài toán đối soát thanh toán tức thời với chi phí 0đ hiện tại (qua Telegram Interactive Callback) mà không cần xây dựng hệ thống phức tạp, sẵn sàng cắm thẳng API Banking (SePay/Casso/PayOS) sau này.

**Independent Test**: Từ màn hình VietQR bấm "Tôi đã chuyển khoản" -> Kiểm tra Telegram Quản lý nhận thẻ thanh toán có nút `[✅ Đã nhận đủ]` -> Quản lý bấm nút trên Telegram -> Kiểm tra trạng thái đơn chuyển sang `confirmed` và màn hình web của khách (nhờ near-realtime short-polling 3-4s) tự động chuyển sang trạng thái Thành công + mở khóa hướng dẫn Check-in.

#### Acceptance Scenarios:

1. **Given** Hold đang ở trạng thái `awaiting_payment`, **When** màn hình thanh toán hiển thị, **Then** khách thấy mã QR chuẩn VietQR (`img.vietqr.io`) tự động gắn sẵn đúng số tiền `totalPrice` và nội dung `paymentReference` (`EIPAY...`), nút sao chép nhanh STK/Nội dung, và thời gian giữ phòng còn lại.
2. **Given** khách đã chuyển khoản và bấm nút **"Tôi đã chuyển khoản"**, **When** API `POST /api/guest/holds/[id]/notify-paid` được gọi, **Then**:
   - Giao diện khách chuyển sang màn hình **"Đang chờ hệ thống xác nhận thanh toán (thường từ 30s – 2 phút)"** có cơ chế tự động kiểm tra trạng thái (**Adaptive Short Polling mỗi 3–4 giây**).
   - Hệ thống gửi ngay tin nhắn Telegram nổi bật tới Quản lý kèm đầy đủ thông tin (Phòng, Giờ in/out, Tên, SĐT, Số tiền, Mã `EIPAY...`) và các nút bấm Inline: `[✅ Đã nhận đủ - Xác nhận ngay]`, `[❌ Chưa nhận được tiền]`.
3. **Given** Quản lý bấm `[✅ Đã nhận đủ - Xác nhận ngay]` trên Telegram (hoặc hệ thống nhận request hợp lệ từ `POST /api/webhooks/banking`), **When** lệnh xác nhận được xử lý, **Then**:
   - `everyinn-booking-core` chuyển Hold thành Booking `confirmed` (`payment_status = 'paid'`), ghi sổ tài chính `manual_financial_entries` và đẩy sự kiện tích điểm sang `cdp_sync_outbox`.
   - `everyinn-agent-core` tự động kiểm tra / chuẩn bị mã cổng (`<pass_cổng>#`) & mã hộp khóa (`<pass lock box>`) cho phòng đó và gửi thông báo Telegram nhắc Quản lý: *"🔔 Hôm nay có booking Phòng <X> lúc <Giờ>: Vui lòng kiểm tra/cài pass cổng `<pass_cổng>#` & hộp khóa `<pass_lock_box>`"*.
   - Màn hình của khách (thông qua polling) tự động chuyển sang trang Xác nhận thành công kèm nút dẫn thẳng tới **Trang Hướng dẫn Check-in (`/checkin`)**.

---

## User Story 4 — Tra cứu Đa Khóa (Multi-Key Lookup) & Trang Landing Page Hướng dẫn Check-in Riêng (Priority: P1)

Sau khi thanh toán thành công (hoặc bất kỳ lúc nào trước khi trả phòng), khách truy cập trang `/checkin` trên Landing Page, nhập **ít nhất 2 thông tin xác thực (keys)** để xem toàn bộ hướng dẫn tự check-in cá nhân hóa với số phòng, mã cổng và mã hộp khóa đã được hệ thống điền tự động.

**Why this priority**: Thay thế hoàn toàn việc nhân viên phải copy-paste tin nhắn, gửi từng tấm ảnh/video hướng dẫn qua Messenger/Zalo và đảm bảo bảo mật mã khóa (chỉ khách có ít nhất 2 thông tin trùng khớp mới xem được).

**Independent Test**: Truy cập `/checkin`, nhập `Số điện thoại` + `Mã đặt phòng / Mã thanh toán EIPAY...` (hoặc `SĐT` + `Instagram/Facebook/Zalo` / `Ngày nhận phòng`) -> Hệ thống trả về đúng trang hướng dẫn gồm 4 phần theo đúng thứ tự yêu cầu với `<pass_cổng>#`, `<số phòng>`, `<pass lock box>` được thay thế chính xác.

#### Acceptance Scenarios:

1. **Given** khách mở trang `/checkin`, **When** khách nhập **ít nhất 2 khóa xác thực hợp lệ** (Khóa 1 bắt buộc: `Số điện thoại`; Khóa 2 tùy chọn 1 trong các thông tin: `Mã đặt phòng BK-... / Mã thanh toán EIPAY...`, `Tài khoản MXH Instagram/Facebook/Zalo đã đăng ký`, hoặc `Ngày nhận phòng + Số phòng`), **Then** hệ thống xác thực trùng khớp với đơn `confirmed` và hiển thị trang hướng dẫn check-in cá nhân hóa.
2. **Given** đơn đặt phòng đã `confirmed` và trong khung thời gian cho phép xem mã, **When** trang hướng dẫn check-in hiển thị, **Then** giao diện hiển thị **đúng thứ tự 4 thành phần chuẩn của Every Inn** và tự động thay thế các biến `<pass_cổng>`, `<số phòng>`, `<pass lock box>`:
   - **Phần 1 (Text hướng dẫn & Nội quy kèm khối Copy nhanh Mã Cổng / Phòng / Hộp khóa / Wifi)**.
   - **Phần 2 (2 Hình ảnh trực quan)**: Hình 1 — Hướng dẫn Check-in và Hình 2 — Hướng dẫn Check-out, hỗ trợ Lightbox phóng to.
   - **Phần 3 (Text lưu ý đi Taxi/Ô tô)**: Hướng dẫn đến đầu hẻm `71/31 Nguyễn Công Hoan`.
   - **Phần 4 (Video hướng dẫn lối vào từ đầu hẻm)**: Trình phát video tối ưu cho di động (`playsInline`, `preload="metadata"`).
3. **Given** một người lạ thử đoán mã bằng cách nhập sai SĐT hoặc khóa thứ 2 quá 5 lần trong 15 phút trên cùng IP, **When** gửi yêu cầu tra cứu thứ 6, **Then** hệ thống chặn tạm thời (`429 Too Many Requests` trong 15 phút) và không tiết lộ bất kỳ thông tin nào về đơn phòng.

---

## User Story 5 — Tự động tạo trước Mã Cổng / Mã Phòng & Nhắc Quản lý qua Telegram (Priority: P2)

Ngay khi đơn đặt phòng trên Landing Page được xác nhận thanh toán, hệ thống tự động kiểm tra kho mã khóa (`agent-db`), gán hoặc sinh mã cho booking và gửi thông báo nhắc Quản lý chuẩn bị/cài đặt mã khóa cho khách.

**Why this priority**: Đảm bảo khi khách tra cứu trên web thì luôn có sẵn mã hợp lệ, và Quản lý không bao giờ quên cài pass khóa cửa/cổng cho các đơn khách tự đặt trên web.

**Independent Test**: Khi đơn `confirmed`, kiểm tra `booking_code_overrides` / `room_lockbox_codes` trong `agent-db` đã có bản ghi tương ứng và Quản lý nhận được tin nhắn Telegram nhắc cài pass kèm nút `[🔐 Đã cài pass xong]` hoặc `[✏️ Đổi pass khác]`.

---

## User Story 6 — Quản Trị Lịch Phòng & Giá Bán Kiểu OTA trên Calendar (Priority: P2)

Admin truy cập trang Calendar Lưới Ngày $\times$ Phòng trên `everyinn-admin` để chủ động đóng/mở bán phòng (Stop Sell / Unblock), điều chỉnh giá bán trực tiếp theo ngày cho từng phòng/hạng phòng, và cấu hình cửa sổ nhận đặt trước tự động dời (2 tháng / 3 tháng / 6 tháng / 1 năm).

**Why this priority**: Trao quyền kiểm soát doanh thu và lịch buồng phòng linh hoạt tương tự các sàn OTA (Agoda/Airbnb Extranet) cho chủ khách sạn, tránh tình trạng khách đặt quá xa khi chưa chốt giá hoặc tự động chặn bán phòng khi cần bảo trì/chủ nhà sử dụng.

**Independent Test**: 
1. Trên Calendar, chọn phòng 101 ngày 25/11 bấm "Đóng phòng (Stop Sell)" $\rightarrow$ Khách tìm kiếm trên Landing Page ngày 25/11 thấy phòng 101 báo bận. Bấm "Mở bán lại" $\rightarrow$ Khách tìm thấy phòng 101 trống ngay lập tức.
2. Click ngày 28/11 đổi giá Qua đêm phòng Haven từ 520k thành 650k $\rightarrow$ Khách tìm kiếm ngày 28/11 thấy giá cơ bản là 650k.
3. Đổi cấu hình nhận trước sang 2 tháng (60 ngày) $\rightarrow$ Date picker trên Landing Page tự động disable toàn bộ ngày từ ngày thứ 61 trở đi; API Core trả về lỗi `ADVANCE_BOOKING_EXCEEDED` nếu request vượt quá ngày thứ 60.

#### Acceptance Scenarios:
1. **Given** Admin ở Calendar quản trị, **When** Admin chọn 1 ngày hoặc dải ngày của 1 phòng (hoặc toàn khách sạn) và chọn lý do (`stop_sell`, `maintenance`, `owner_stay`, `deep_cleaning`), **Then** hệ thống tạo `room_block` chiếm slot `occupancy` và phản ánh tức thì trên màn hình khách.
2. **Given** Admin muốn tăng/giảm giá cho ngày cụ thể, **When** Admin click vào ô ngày và nhập giá bán mới (`custom_base_price`), **Then** hệ thống ghi nhận vào `calendar_rate_overrides` và Core Pricing ưu tiên giá này làm $P_{\text{base}}$ của ngày đó.
3. **Given** Admin chọn cấu hình Cửa sổ đặt trước (ví dụ: 3 tháng = 90 ngày), **When** thời gian thực bước sang ngày mới lúc 00:00:00 (giờ VN), **Then** mốc ngày xa nhất được phép đặt $D_{\text{max}} = D_{\text{today}} + 90$ ngày tự động tịnh tiến thêm 1 ngày trên Date Picker của khách.

---

## 3. Edge Cases & Boundary Conditions

1. **Hai khách cùng bấm "Đặt phòng ngay" cho 1 phòng ở cùng khung giờ (Race Condition)**:
   - D1 `inventory_slots` có ràng buộc `PRIMARY KEY (property_id, room_id, lane, slot_start)` và được cập nhật nguyên tử qua `db.batch()`. Người bấm sau (chậm hơn vài mili-giây) sẽ nhận mã lỗi `409 SLOT_CONFLICT` kèm thông báo thân thiện: *"Rất tiếc, phòng này vừa có khách khác đặt giữ chỗ. Vui lòng chọn phòng bên cạnh hoặc khung giờ khác nhé!"*.
2. **Khách giữ phòng quá 10 phút nhưng mới chuyển khoản (Late Transfer after Hold Expiry)**:
   - Sau 10 phút (`expires_at`), các slot được giải phóng cho khách khác. Tuy nhiên, nếu khách bấm "Tôi đã chuyển khoản" trễ sau khi Hold đã hết hạn:
     - Nếu các slot của phòng đó **vẫn còn trống**: Hệ thống cho phép Quản lý bấm `[✅ Đã nhận tiền - Khôi phục & Xác nhận đơn]` trên Telegram để tự động khóa lại slot và tạo Booking `confirmed`.
     - Nếu phòng đó **đã bị khách khác đặt mất**: Hệ thống cảnh báo đỏ ngay trên Telegram Quản lý `⚠️ [CẢNH BÁO TRÙNG LỊCH DO CHUYỂN KHOẢN TRỄ SAU 10 PHÚT]` để Quản lý chủ động đổi sang phòng trống tương đương hoặc hoàn tiền cho khách.
3. **Ca Qua đêm `24h-12h` và quy tắc Night Audit (00:00 – 04:00 sáng)**:
   - Nếu khách truy cập web lúc 00:30 sáng ngày 21/04 và muốn nhận phòng ngay trong đêm đó (tức rạng sáng 21/04), giao diện tìm kiếm hiển thị rõ nhãn gợi ý thông minh: *"Bạn muốn nhận phòng ngay đêm nay (rạng sáng 21/04) hay đêm 21/04 rạng sáng 22/04?"* để tránh khách chọn nhầm ngày.
4. **Tính liên tục của các ô thêm giờ (`Contiguous Slot Availability`)**:
   - Ví dụ ở ca `21h-9h`: Nếu khung `09:00–10:00` đã bị khóa (hoặc vướng 60p dọn phòng cho khách vào lúc `10:30`), thì **cả 3 nút** `+1h`, `+2h`, `+3h checkout muộn` đều không được phép chọn.
5. **Khách tra cứu Check-in quá sớm cho đơn đặt trước nhiều ngày**:
   - Nếu khách đặt trước cho tuần sau và vào `/checkin` tra cứu ngay: Hệ thống hiển thị đầy đủ thông tin xác nhận đặt phòng + địa chỉ + video lối đi, riêng mã mở cửa hiển thị trạng thái: *"Mã khóa sẽ được kích hoạt tại đây trước giờ nhận phòng của bạn"*.

---

## 4. Requirements *(mandatory)*

### 4.1. Functional Requirements (FR)

#### A. Tìm kiếm phòng & Quy tắc hiển thị theo loại hình (`FR-SEARCH`)
- **FR-001**: Landing Page cung cấp bộ tìm kiếm phòng với 3 chế độ: **Theo giờ (`hourly`)**, **Qua đêm (`overnight`)**, và **Theo ngày (`dayuse`)**, đồng bộ 100% dữ liệu từ `everyinn-booking-core`.
- **FR-002 (Overnight 4 Base Shifts)**: Khi chọn **Qua đêm**, khách chọn 1 trong 4 ca cơ bản 12 tiếng:
  1. Ca 1: `21:00 – 09:00` sáng hôm sau (`21h-9h`)
  2. Ca 2: `22:00 – 10:00` sáng hôm sau (`22h-10h`)
  3. Ca 3: `23:00 – 11:00` sáng hôm sau (`23h-11h`)
  4. Ca 4: `24:00 – 12:00` trưa hôm sau (`24h-12h`, tức `00:00 – 12:00` ngày kế tiếp)
- **FR-003 (Overnight Per-Card Dynamic Add-on Buttons with 60k/hour Rate)**: Khi kết quả phòng trống hiện ra ở chế độ **Qua đêm**, trên mỗi thẻ phòng hiển thị các nút tùy chọn mua thêm giờ với đơn giá niêm yết **`+60.000đ/giờ`** tuân thủ ma trận giới hạn hiển thị:
  - Ca `21h-9h`: Tối đa 3 nút checkout muộn (`+1h`, `+2h`, `+3h`), 0 nút checkin sớm.
  - Ca `22h-10h`: Tối đa 2 nút checkout muộn (`+1h`, `+2h`), tối đa 1 nút checkin sớm (`+1h` từ 21h).
  - Ca `23h-11h`: Tối đa 1 nút checkout muộn (`+1h`), tối đa 2 nút checkin sớm (`+1h` lúc 22h, `+2h` lúc 21h).
  - Ca `24h-12h`: Tối đa 3 nút checkin sớm (`+1h`, `+2h`, `+3h`), 0 nút checkout muộn.
- **FR-004 (Bidirectional 60-Minute Turnover & Contiguous Availability Invariant)**:
  - **Quy tắc bất biến (Core Invariant)**: Mọi ca lưu trú liên tiếp trên cùng 1 phòng luôn luôn phải cách nhau tối thiểu **60 phút dọn phòng** ($\Delta T = T_{\text{in\_next}} - T_{\text{out\_prev}} \ge 60\text{ phút}$).
  - **Kiểm tra chiều ca trước**: Nếu ca trước trả phòng lúc $T_{\text{out\_prev}}$, ca sau chỉ được nhận phòng lúc $T_{\text{in}} \ge T_{\text{out\_prev}} + 60\text{ phút}$. Nút `+k giờ checkin sớm` ($T_{\text{in}} - k\text{h}$) chỉ được kích hoạt nếu toàn bộ các slot trong $[T_{\text{in}} - k\text{h} - 60',\; T_{\text{in}})$ đều trống.
  - **Kiểm tra chiều ca sau**: Nếu ca sau nhận phòng lúc $T_{\text{in\_next}}$, ca hiện tại buộc phải trả phòng lúc $T_{\text{out}} \le T_{\text{in\_next}} - 60\text{ phút}$. Nút `+m giờ checkout muộn` ($T_{\text{out}} + m\text{h}$) chỉ được kích hoạt nếu toàn bộ các slot trong $[T_{\text{out}},\; T_{\text{out}} + m\text{h} + 60')$ đều trống.
  - **Tính liên tục (Contiguous)**: Nếu một nút ở bậc $k$ bị vướng lịch (hoặc vướng 60 phút dọn phòng của ca lân cận), tất cả các nút bậc cao hơn ($k+1, k+2$) đều tự động bị vô hiệu hóa.
- **FR-005 (Day Use Simplified Flow)**: Khi chọn **Theo ngày (`dayuse`)**, khách chỉ chọn Ngày nhận và Ngày trả phòng. Cố định mốc `15:00` check-in và `12:00` check-out.
- **FR-006 (Hourly Flow)**: Khi chọn **Theo giờ (`hourly`)**, khách chọn ngày, giờ nhận phòng trong khung **`08:00` đến `21:00`** (bước 30 phút) và thời lượng tối thiểu **3 giờ**, kiểm tra lịch trống kèm 60 phút dọn phòng.

#### B. Đặt phòng, Giữ chỗ 10 phút, CDP & Khuyến mãi (`FR-BOOKING`)
- **FR-007 (Dedicated Guest Booking API)**: Xây dựng bộ API BFF dành riêng cho khách tại `/api/guest/*` trên `every-inn-booking` gọi Core qua Service Binding với định danh caller riêng `x-ei-caller: landing-bff`.
- **FR-008 (10-Minute Hold TTL)**: Lệnh giữ chỗ khóa slot phòng trong đúng **10 phút (`ttlSeconds = 600`)**.
- **FR-009 (Guest Information Fields)**: Form thu thập `phone` (E.164), `name`, kênh liên hệ phụ (`Zalo` / `Instagram` / `Facebook`), `numGuests` (Haven <= 2, Signature <= 4), `promotionCode` (tùy chọn), `note` (tùy chọn). Tự động sinh `closingNote: [WEB-SELF-BOOKING]`.
- **FR-010 (CDP & Multi-Tier Promotion Engine Integration)**:
  - Tự động áp dụng khuyến mãi công khai tốt nhất (**Public Promotions** `is_public = 1`).
  - Hỗ trợ nhập mã khuyến mãi nội bộ (**Private Promo Code** `is_public = 0`).
  - Tự động nhận diện hạng hội viên CDP (`bronze`, `silver`, `gold`) và voucher thưởng tích tem (`EVERYINN_STAMP_10_V1`).
  - Tính giảm giá **chỉ trên Base Price ($P_{\text{base}}$)**, không giảm sang phụ thu giờ thêm, phụ thu khách hay phụ thu lễ.

#### C. Thanh toán, Thông báo Telegram & Near-Realtime Polling (`FR-PAYMENT`)
- **FR-011 (Real-time Telegram Notifications)**: Mọi thay đổi trạng thái đơn đều gửi thông báo tới Quản lý qua Telegram bot:
  1. `HOLD_CREATED`: Bắt đầu giữ chỗ 10 phút.
  2. `AWAITING_PAYMENT`: Khách hoàn tất form, nhận mã VietQR `EIPAY...`.
  3. `GUEST_REPORTED_PAID`: Khách bấm "Tôi đã chuyển khoản" — gửi tin nhắn có nút Inline `[✅ Đã nhận đủ]` và `[❌ Chưa nhận]`.
  4. `BOOKING_CONFIRMED`: Xác nhận thành công kèm lời nhắc Quản lý cài pass.
  5. `HOLD_EXPIRED` / `HOLD_CANCELLED`: Hết hạn 10 phút hoặc hủy đơn.
- **FR-012 (Banking Webhook Readiness)**: Endpoint `POST /api/webhooks/banking` sẵn sàng nhận webhook từ SePay / Casso / PayOS để tự động xác nhận đơn.
- **FR-013 (Adaptive Short-Polling)**: Màn hình chờ xác nhận thực hiện polling mỗi **3–4 giây** tới `GET /api/guest/holds/[id]` để nhận biết ngay khi Quản lý duyệt trên Telegram.

#### D. Mã phòng, Bảo mật & Check-in (`FR-CHECKIN`)
- **FR-014 (Multi-Key Guest Check-in Lookup)**: Trang `/checkin` yêu cầu ít nhất 2 khóa xác thực (`phone` + `bookingRef/paymentRef/socialHandle/checkinDate`).
- **FR-015 (Dedicated Dynamic Check-in Landing Page)**: Hiển thị đúng 4 khối nội dung theo thứ tự chuẩn của Every Inn (Text nội quy & pass -> 2 Ảnh hướng dẫn -> Text taxi 71/31 -> Video lối vào).
- **FR-016 (IP-Based Rate Limiting & Anti-Abuse)**: Giới hạn tần suất request theo IP (`CF-Connecting-IP`):
  - Tìm phòng: 30 req/phút/IP.
  - Tạo hold: 5 holds/10 phút/IP.
  - Tra cứu checkin: 5 lần thử/15 phút/IP (quá 5 lần trả về `429 Too Many Requests`).

#### E. Quản trị Calendar OTA, Điều chỉnh Giá & Cửa sổ Đặt trước (`FR-CALENDAR`)
- **FR-017 (Calendar Stop-Sell & Room Block Management)**: Admin có thể chọn 1 ngày hoặc dải ngày của 1 phòng (hoặc toàn khách sạn) trên Calendar để đóng phòng (Stop Sell) với các lý do chuẩn (`stop_sell`, `maintenance`, `owner_stay`, `deep_cleaning`), tự động tạo `room_block` chiếm slot `occupancy`, đồng thời có nút 1-click mở bán lại ngay lập tức.
- **FR-018 (Dynamic Daily Rate Overrides)**: Admin có thể click vào bất kỳ ngày nào trên Calendar để nhập giá bán trực tiếp (`custom_base_price`) cho từng gói (`overnight`, `dayroom`, `combo3h`) và từng hạng/phòng, lưu vào `calendar_rate_overrides` và Core Pricing ưu tiên làm $P_{\text{base}}$ gốc của ngày đó.
- **FR-019 (Rolling Advance Booking Window)**: Cho phép Admin cấu hình giới hạn thời gian nhận khách trước (2 tháng / 3 tháng / 6 tháng / 1 năm) trong `booking_configs.max_advance_days`. Cửa sổ này **tự động tịnh tiến (rolling window)** mỗi khi qua 00:00:00 (giờ VN); Date Picker trên Landing Page tự động vô hiệu hóa các ngày ngoài cửa sổ và Core API từ chối các lượt đặt phòng vượt quá mốc này với mã lỗi `422 ADVANCE_BOOKING_EXCEEDED`.

---

### 4.2. Non-Functional Requirements & Infrastructure Rules (`NFR`)

- **NFR-001 (Mobile-First Agoda/Airbnb UX)**: Viewport tối ưu `360px` – `430px`, nút bấm `>= 44x44px`, Sticky CTA bar.
- **NFR-002 (Cloudflare Free-Tier Compliance & Capacity)**:
  - Với lưu lượng thực tế ~120 bookings/tháng (~4 booking/ngày) và ~20 khách nhắn page/ngày, lưu lượng tìm phòng và polling chỉ dao động từ **1.500 – 3.000 requests/ngày**, hoàn toàn nằm sâu trong ngưỡng miễn phí **100.000 requests/ngày** của Cloudflare.
  - CPU time mỗi invocation `< 10ms`.
  - Mọi giao tiếp giữa Landing BFF và các Core Workers thực hiện qua **Cloudflare Service Bindings** nội bộ (latency ~0ms, 0 chi phí băng thông).
- **NFR-003 (Zero Door-Code Leakage)**: Mã khóa cửa và hộp khóa chỉ lưu mã hóa AES-GCM trong `agent-db`, API trả về header `Cache-Control: private, no-store`.

---

## 5. Measurable Success Criteria *(mandatory)*

- **SC-001 (Zero Manual Availability Check)**: 100% khách tự tra cứu lịch phòng trống và các nút thêm giờ (`60.000đ/giờ`) trong `< 500ms`.
- **SC-002 (Overnight Rule Accuracy)**: 100% thẻ phòng hiển thị đúng số nút theo ma trận 4 ca và đơn giá `60.000đ/giờ`.
- **SC-003 (Hold & Double-Booking Prevention)**: 0% trùng lịch; giải phóng slot sau đúng 10 phút nếu không thanh toán.
- **SC-004 (Near-Realtime Confirmation)**: Khách được tự động chuyển sang màn hình thành công trong vòng `< 4 giây` sau khi Quản lý bấm xác nhận trên Telegram.
- **SC-005 (Self Check-in Lookup Reliability)**: 100% khách đã thanh toán xác thực đúng $\ge 2$ khóa tại `/checkin` nhận được đầy đủ 4 phần hướng dẫn check-in.
