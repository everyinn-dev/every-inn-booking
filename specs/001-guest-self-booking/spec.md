# Feature Specification: Guest Self-Booking, Payment & Self Check-in Landing Page

- **Feature Branch**: `feat/landing-self-booking` (`001-guest-self-booking`)
- **Target Repositories**: `every-inn-booking` (Landing Page BFF — `saigonliving`), `everyinn-booking-core`, `everyinn-cdp-core`, `everyinn-agent-core`, `everyinn-admin`
- **Version**: 3.0.0 (Aligned 100% with Session Engine, Phone-First Hold, 1h Hourly Step & Verified Code)
- **Created**: 2026-04-20
- **Last Updated**: 2026-11-10
- **Status**: Implemented & Aligned with Source of Truth
- **Related Canonical Docs**:
  - [source-of-truth.md](./source-of-truth.md) (Code-verified reference & Owner decisions)
  - [contracts/guest-booking-api.md](./contracts/guest-booking-api.md)
  - [data-model.md](./data-model.md)
  - [plan.md](./plan.md)
  - [tasks.md](./tasks.md)
  - `everyinn-platform-docs/CONVENTIONS.md`
  - `everyinn-platform-docs/EI_LANDING_SELF_BOOKING_SPEC.md`

---

## 1. Executive Summary & Business Goals

### 1.1. Mục tiêu nghiệp vụ (Business Objectives)
Trước đây, khách đặt phòng tại **Every Inn** phải nhắn Fanpage/Instagram/Zalo chờ nhân viên kiểm tra lịch, báo giá, tạo giữ phòng, đối soát chuyển khoản và copy-paste hướng dẫn check-in thủ công — dễ chậm phản hồi vào ban đêm.

Tính năng **Guest Self-Booking, Payment & Self Check-in** cho phép khách tự hoàn tất toàn bộ hành trình **End-to-End 24/7 trên `every-inn-booking`** (`/dat-phong`, `/dat-phong/<token>`, `/checkin`), đồng thời hợp nhất cùng hệ thống quản trị (`everyinn-admin`):

1. **Tìm phòng trực quan theo 3 hình thức**:
   - **Theo giờ (`hourly`)**: Giờ nhận từ **`08:00` đến `21:00`** theo **bước nhảy 1 giờ chẵn (`:00`)**, `min_lead_minutes = 30`, thời lượng từ **3 đến 12 giờ** (`min_hourly = 3`).
   - **Qua đêm (`overnight`)**: 4 ca chuẩn 12 tiếng (`21h-9h`, `22h-10h`, `23h-11h`, `24h-12h`) kèm các chip mua thêm giờ (`+1h nhận sớm` / `+1h trả muộn`, đơn giá **`+60.000đ/giờ`**) tuân thủ ma trận ca và bất biến 60 phút dọn phòng 2 chiều.
   - **Theo ngày (`dayuse`)**: Chỉ chọn Ngày nhận và Ngày trả, cố định **`15:00` nhận phòng – `12:00` trả phòng**.
2. **Core Pricing v2.0, CDP Loyalty & Ví Voucher Tem (`customer_vouchers`)**:
   - Dữ liệu phòng (`haven-101/201/301`, `sig-102/202/302`), giá (`rate_rules` + `rate_overrides`), phụ thu lễ/thêm giờ/thêm khách (`150.000đ/khách` Signature khách 3–4), thông tin ngân hàng VietQR (`properties.bank_*`) và khuyến mãi đều lấy đồng bộ từ `everyinn-booking-core`.
   - Khi đặt ở kênh `web` hoặc `admin`, thưởng tích tem (`3 → 50k`, `8 → 100k`, `10 → 150k`) được cấp thành **voucher trong ví `CDP_DB.customer_vouchers`** để áp cho đơn tiếp theo (D7).
   - Công thức xếp chồng (`stackDiscounts`) khống chế tổng giảm giá (tối đa 1 promotion + 1 voucher) nằm hoàn toàn trong phần giá cơ bản `min(basePrice, subtotal)`, **không giảm sang phụ thu**:
     $$\text{promo} = \min\big(\max(0, D_{\text{promo}}),\; \min(P_{\text{base}}, S_{\text{subtotal}})\big)$$
     $$\text{loyalty} = \min\big(\max(0, D_{\text{voucher}}),\; \min(\max(0, \min(P_{\text{base}}, S_{\text{subtotal}}) - \text{promo}),\; S_{\text{subtotal}} - \text{promo})\big)$$
     $$T_{\text{total}} = \max(0,\; S_{\text{subtotal}} - \text{promo} - \text{loyalty})$$
3. **Engine Phiên Đặt Phòng Thống Nhất & Phone-First Hold (`everyinn-agent-core`)**:
   - Khi khách chọn phòng, modal **`PhoneHoldModal`** yêu cầu nhập SĐT Việt Nam hợp lệ (được lưu vào `localStorage.ei_guest_phone`) trước khi gọi `POST /api/guest/sessions`. Mỗi SĐT chỉ giữ tối đa **1 phiên sống** (`409 ANOTHER_SESSION_LIVE` + nút **1 chạm `"Đổi sang phòng này"`** với `forceSwitch: true`).
   - Khách được cấp link bảo mật `/dat-phong/<token>` (token 32 byte base64url, DB chỉ lưu hash SHA-256) với thời hạn giữ phòng **10 phút** (admin **15 phút**).
   - Khi bấm `"Tôi đã chuyển khoản"`, hold được gia hạn `claimGraceMinutes = 30` phút (tối đa không quá giờ check-in), gửi thẻ trạng thái tương tác lên Telegram (`ss:<sid>:...`, cập nhật tại chỗ, không in plaintext mã cửa) và mở sẵn webhook ngân hàng (`POST /webhooks/payments/:provider` trên `agent-core`, mặc định shadow mode `autoConfirmExactMatch = false`).
   - Trạng thái đơn cập nhật tức thời qua **Durable Objects Long-Poll 25s** (`BookingSessionLive` & `InventoryPulse`), lùi về short-poll `4s → 30s` khi lỗi và tự dừng khi tab ẩn.
4. **Tra cứu & Self Check-in `/checkin` (đa kênh, xác thực 2 khoá)**:
   - Khách xác nhận ở bất kỳ kênh nào (`web`, `admin`, `chat`) tra cứu tại `/checkin` với **SĐT + 1 khoá thứ hai** (`Mã đơn / EIPAY` hoặc `Tài khoản MXH` hoặc `Ngày nhận + Số phòng`).
   - Hiển thị đúng 4 khối hướng dẫn cố định; riêng **mã cổng và mã hộp khóa** chỉ mở khóa trong cửa sổ `[checkinAt - codesVisibleHoursBefore, checkoutAt + 2h]` khi đơn `confirmed` (`codesVisibleHoursBefore` cấu hình trong master data `checkin_guide`, mặc định hiện tại trong code là `6` tiếng).
5. **Quản trị Calendar OTA (`everyinn-admin`)**:
   - Đóng/mở bán hàng loạt (`POST /internal/v1/room-blocks/bulk`, `/room-blocks/:id/release`), chỉnh giá cơ bản theo ngày/hạng/phòng (`rate_overrides`), và cấu hình cửa sổ nhận đặt trước (`booking_rules.max_advance_days`, mặc định `90` ngày dương lịch, tự tịnh tiến lúc `00:00` VN).
6. **Không phụ thuộc AI Chatbot**:
   - Luồng tự đặt phòng là Web UI tự phục vụ; Telegram chỉ phục vụ thông báo & nút duyệt của Quản lý/Nhân viên. Cờ `WEB_BOOKING_ENABLED` (Landing `vars`) bật/tắt công khai ngay không cần rollback DB.

---

## 2. User Scenarios & Testing

### User Story 1 — Tìm phòng & Chọn linh hoạt giờ Check-in/Check-out trên Thẻ Phòng (Priority: P1)

Khách truy cập Trang chủ (`/`) hoặc `/dat-phong` trên điện thoại hoặc máy tính, sử dụng `SearchBar` 3 tab (**Theo giờ**, **Qua đêm**, **Theo ngày**) để xem danh sách các phòng với giá Core đã áp Best Public Promotion và các nút thêm giờ hợp lệ ngay trên thẻ phòng qua đêm.

**Independent Test**: Gọi `POST /api/guest/availability` cho từng loại hình (`hourly` chỉ nhận `:00` từ `08:00`–`21:00`, `overnight` 4 ca kèm `includeAddons: true`, `dayuse` `15:00`→`12:00`) và kiểm tra danh sách 6 phòng (`haven-101/201/301`, `sig-102/202/302`), nút `+1h nhận sớm`/`+1h trả muộn` (`60.000đ/giờ`), và mask phòng bận `"Vừa được đặt"`.

#### Acceptance Scenarios:
1. **Given** khách chọn tab **Qua đêm (`overnight`)**, **When** chọn ngày và 1 trong 4 ca chuẩn (`21-9`, `22-10`, `23-11`, `24-12`), **Then** hệ thống trả về cả danh sách phòng còn trống và phòng bận (bị làm mờ, hiện nhãn `"Vừa được đặt"` hoặc `"Tối đa 2 khách"` — không lộ đơn của khách khác), cùng `shiftSummary` (`Còn N phòng` / `Hết phòng` / `Đã qua giờ`) và tối đa 3 nút thêm giờ (`+60.000đ/giờ`) theo đúng ma trận từng ca:
   - `21-9`: tối đa 3 nút trả muộn (`10h`, `11h`, `12h`), 0 nút nhận sớm.
   - `22-10`: tối đa 1 nút nhận sớm (`21h`), 2 nút trả muộn (`11h`, `12h`).
   - `23-11`: tối đa 2 nút nhận sớm (`22h`, `21h`), 1 nút trả muộn (`12h`).
   - `24-12` (`00:00–12:00` rạng sáng hôm sau của `nightDate`): tối đa 3 nút nhận sớm (`23h`, `22h`, `21h`), 0 nút trả muộn.
2. **Given** phòng `sig-202` trống ca `21-9` nhưng ca sau đã đặt từ `11:30` (cần 60 phút dọn phòng từ `10:30` đến `11:30`), **When** hiển thị thẻ phòng, **Then** chỉ nút `+1h trả muộn` (ra `10:00`, dọn xong `11:00`) khả dụng; các nút `+2h`, `+3h` bị khoá liên hoàn (`TURNOVER_BUFFER_CONFLICT`).
3. **Given** khách chọn chip `+1h nhận sớm` / `+2h trả muộn` trên thẻ phòng, **Then** tổng giá hiển thị cộng thêm đúng `60.000đ × số giờ` trước khi giữ phòng (giá chốt do Core/Agent tính lại khi tạo session).
4. **Given** khách chọn tab **Theo giờ (`hourly`)**, **When** chọn ngày, **Then** dropdown giờ nhận chỉ liệt kê các mốc **giờ chẵn `:00`** từ `08:00` đến `21:00` thỏa `>= now + 30 phút` (trên ngày hôm nay), thời lượng `3..12` giờ. Nếu gửi `:30` hoặc không tròn giờ lên BFF/Core, hệ thống từ chối (`400 VALIDATION_FAILED` / `422 HOURLY_CHECKIN_STEP_INVALID`).
5. **Given** khách chọn tab **Theo ngày (`dayuse`)**, **Then** khách chỉ chọn ngày nhận và ngày trả; giờ luôn cố định **`15:00` → `12:00`** với ghi chú rõ trên UI.

---

### User Story 2 — Giữ phòng theo SĐT (Phone-First Hold 10 phút), Điền thông tin, CDP & Ví Voucher (Priority: P1)

Khi khách bấm **"Chọn phòng này"** trên thẻ phòng, hệ thống mở `PhoneHoldModal` để xác thực SĐT Việt Nam và tạo phiên giữ phòng **10 phút**, chuyển sang `/dat-phong/<token>` để hoàn tất thông tin, kiểm tra hội viên CDP / chọn voucher / nhập mã khuyến mãi và nhận VietQR.

**Independent Test**: Nhập SĐT trong `PhoneHoldModal` → gọi `POST /api/guest/sessions` tạo phiên `holding` (`expires_at = +10 phút`) → thử giữ phòng thứ 2 cùng SĐT nhận `409 ANOTHER_SESSION_LIVE` → gọi lại với `forceSwitch: true` thành công và huỷ phiên cũ → vào `/dat-phong/<token>`, chạy `POST /preview` và `PATCH` chuyển sang `awaiting_payment`.

#### Acceptance Scenarios:
1. **Given** khách bấm **"Chọn phòng này"**, **When** `PhoneHoldModal` mở ra, **Then** SĐT gần nhất trong `localStorage.ei_guest_phone` được gợi ý sẵn (nếu có). Khách bấm **"Giữ phòng 10 phút"**, BFF gọi `AGENT_CORE.LandingApi` (`POST /internal/v1/web/sessions`), khoá slot trong Core và trả `{ token, replayed, session }` kèm redirect tới `/dat-phong/<token>`.
2. **Given** SĐT đã có **1 phiên sống** ở phòng/khung giờ khác, **When** khách giữ phòng mới với cùng SĐT, **Then** API trả `409 ANOTHER_SESSION_LIVE` kèm thông tin phòng đang giữ và thời gian còn lại; UI hiển thị nút **"Đổi sang phòng này"** (`forceSwitch: true`) giải phóng phiên cũ trước khi giữ phòng mới trong cùng luồng.
3. **Given** khách double-click cùng `clientNonce`, **Then** API trả `200` `replayed: true` với cùng `token` và `session` mà không tạo 2 hold trùng.
4. **Given** khách ở trang `/dat-phong/<token>`, **When** SĐT thay đổi hoặc nhập mã ưu đãi / chọn voucher, **Then** `POST /api/guest/sessions/[token]/preview` trả về hạng hội viên (`bronze`, `silver`, `gold`), danh sách `vouchers` đã mask (`TEM3-••Q2`) và giá tạm tính chi tiết `PricingBreakdown` tuân thủ `stackDiscounts`. Nếu SĐT chưa có, voucher không áp (`VOUCHER_NEEDS_PHONE`).
5. **Given** khách nhập Họ tên, SĐT, kênh liên hệ (`zalo` / `instagram` / `facebook` — nếu bỏ trống tất cả, hệ thống mặc định `zalo = phone`), mã giảm giá (nếu có) và bấm **"Xác nhận giữ & Lấy mã QR"**, **When** gọi `PATCH /api/guest/sessions/[token]`, **Then**:
   - Nếu `promotionCode` không hợp lệ/không đủ điều kiện → `422 PROMOTION_NOT_APPLICABLE` (không âm thầm đổi sang public promo).
   - Nếu chọn voucher và slot giữ được → lease voucher trong `CDP_DB.customer_vouchers` (`reserveVoucher`) theo hold.
   - Chuyển phiên sang `awaiting_payment`, tạo `payment_intents` (`vietqr`) với mã `EIPAY...`, lưu snapshot vào `room_holds.checkoutDraft` và cập nhật thẻ Telegram.
6. **Given** khách bấm **"Huỷ giữ phòng"** (khi còn quyền `can.cancel`), **When** gọi `DELETE /api/guest/sessions/[token]`, **Then** phiên chuyển sang `cancelled`, slot phòng và voucher đã lease được giải phóng ngay.

---

### User Story 3 — Thanh toán VietQR, Telegram Card Thống Nhất, Webhook Ngân hàng & Realtime DO (Priority: P1)

Khách quét mã VietQR động (thông tin ngân hàng đọc từ `Booking Core` `properties.bank_*`, số tiền = `remaining`, nội dung `EIPAY...`) và bấm **"Tôi đã chuyển khoản"**. Màn hình theo dõi trạng thái realtime qua Durable Object cho đến khi Quản lý duyệt trên Telegram hoặc Webhook ngân hàng khớp giao dịch.

**Independent Test**: Gọi `POST /api/guest/sessions/[token]/paid` → phiên chuyển `payment_claimed`, gia hạn +30p (tối đa tới check-in), Telegram nhận thẻ trạng thái có các nút `ss:<sid>:ok|short|amt|no` → Quản lý bấm ✅ → `confirmHold` + tích tem & phát voucher CDP + kiểm tra mã cửa → client nhận event qua `/live` DO (< 1s) và chuyển trang Thành công.

#### Acceptance Scenarios:
1. **Given** phiên ở trạng thái `awaiting_payment` hoặc `underpaid`, **When** khách bấm **"Tôi đã chuyển khoản"**, **Then** `POST /api/guest/sessions/[token]/paid` chuyển phiên sang `payment_claimed`, gia hạn hold (`claimGraceMinutes = 30`, kẹp `<= checkinAt`) và gửi thông báo Telegram. (Nếu phiên đã `expired` trước đó, chuyển sang `late_payment` + cảnh báo kiểm tra phòng trống trước khi khôi phục).
2. **Given** client đang mở `/dat-phong/<token>`, **Then** hook `useLongPoll` giữ kết nối `GET /api/guest/sessions/[token]/live?v=<version>&timeout=25000` (qua DO `BookingSessionLive`), cập nhật trạng thái < 1s khi Quản lý hoặc Webhook đổi version; khi mất mạng/lỗi tự fallback backoff `4s → 30s` và tạm dừng khi tab ẩn.
3. **Given** Quản lý bấm **`[✅ Đã nhận đủ]`** (`ss:<sid>:ok`) hoặc nhập số tiền thực nhận (`ss:<sid>:amt` / `keep` / `topup`) hoặc **`[❌ Chưa nhận]`** (`ss:<sid>:no`), **Then**:
   - Đủ tiền: chuyển qua `confirming` → `confirmed`, gọi `BOOKING_CORE.confirmHold`, ghi sổ `manual_financial_entries`, phát sự kiện tích tem/đổi voucher `CDP_CORE`, và nhắc Quản lý kiểm tra/nhập mã cửa (KHÔNG in plaintext mã cửa trên Telegram — D9).
   - Thiếu tiền (`underpaid`): khách thấy số tiền đã nhận + số `remaining` + QR mới chỉ cho phần còn thiếu; Quản lý có thể chọn giữ cọc (`keep` → confirm cọc) hoặc chờ khách CK thêm.
   - Bấm chưa nhận tiền (`no`): lần 1 trả về `awaiting_payment` (hoặc `underpaid` nếu `paid_amount > 0`), lần 2 (`reject_count >= 1`) huỷ phiên `cancelled` và trả phòng ngay.
4. **Given** cổng ngân hàng (`sepay`, `casso`, `payos`) gọi `POST /webhooks/payments/:provider` trên `everyinn-agent-core`, **When** secret hợp lệ, **Then** payload được lọc PII, dedupe theo `(provider, provider_txn_id)` vào `payment_webhook_inbox`, khớp `EIPAY\s*(\d{6})\s*([A-Z0-9]{4})`; khi `autoConfirmExactMatch = false` (shadow mode mặc định), gửi nút gợi ý `sm:<inbox>:<sid>` lên Telegram để Quản lý duyệt 1 chạm.

---

### User Story 4 — Tra cứu Đa Khóa & Trang Hướng dẫn Check-in (`/checkin`) (Priority: P1)

Mọi đơn đã `confirmed` (đặt qua Web, Admin hoặc Chat) đều có thể tra cứu tại `/checkin` bằng **SĐT + 1 trong 3 khóa thứ hai**, xem 4 phần hướng dẫn chuẩn và nhận mã cổng / mã hộp khóa ngay khi vào cửa sổ mở mã.

**Independent Test**: Gọi `POST /api/guest/checkin/lookup` với `{ phone, secondKeyType: "booking_ref", secondKeyValue }` → trong cửa sổ `[checkinAt - codesVisibleHoursBefore, checkoutAt + 2h]` trả `accessCodes.visible = true` kèm `gateCode`, `lockboxCode`, `wifiName`, `wifiPassword`; ngoài cửa sổ trả `visible: false`, mã ẩn `••••`, hiện `pendingNote`. Sai 5 lần trong 15 phút bị chặn `429`.

#### Acceptance Scenarios:
1. **Given** khách nhập SĐT và 1 khoá thứ hai (`booking_ref` = mã `EI-...` hoặc `EIPAY...`, `social` = handle MXH, hoặc `checkin_date_room` = `checkinDate` + `roomNumber`), **When** gọi `POST /api/guest/checkin/lookup`, **Then** trả về `200` với `Cache-Control: private, no-store`, gồm `booking` (tên khách đã mask), `accessCodes`, và `guideBlocks` đúng 4 bước theo thứ tự chuẩn (Text nội quy & bản đồ → 2 Ảnh check-in/check-out → Text điểm đón taxi `71/31 Nguyễn Công Hoan` → Video lối đi).
2. **Given** đơn `confirmed` còn cách giờ nhận phòng > `codesVisibleHoursBefore` (hiện code mặc định `6` tiếng trong `checkin_guide`), **When** khách tra cứu `/checkin`, **Then** `guideBlocks` hiển thị đầy đủ địa chỉ & video, còn `accessCodes.visible = false`, `gateCode = null`, `lockboxCode = null`, text thay biến thành `••••`, kèm `pendingNote` báo thời điểm `visibleFrom`.
3. **Given** người dùng nhập sai liên tiếp 5 lần từ 1 IP trong 15 phút, **When** gửi lần thứ 6 (hoặc bất kỳ request kế tiếp trong cửa sổ 15 phút), **Then** `ckfail:<ipHash>` chặn ngay `429 RATE_LIMIT_EXCEEDED` (`retryAfterSeconds: 900`) trước khi tra cứu Core.

---

### User Story 5 — Tự động kiểm tra / chuẩn bị Mã Cổng & Nhắc Quản lý Bảo mật (Priority: P2)

Khi phiên web/admin đạt `confirmed`, `everyinn-agent-core` tự động kiểm tra sự tồn tại của mã cổng & hộp khóa (`ensureDoorCodes`) trong `AGENT_DB` và gửi nhắc cài đặt cho Quản lý đúng lúc mà không rò rỉ plaintext lên chat.

**Independent Test**: Khi đơn `confirmed`, nếu phòng chưa có pass riêng trong `booking_code_overrides`/`gate_codes`, Telegram hiện thẻ nhắc force-reply `REQUEST_DOOR_CODE` và chỉ ghi `"✓ Mã cổng đã có"` / `"✗"` thay vì chuỗi mã thô. Cron `reconcileSessions` nhắc lại lúc `checkinAt - codesVisibleHoursBefore`.

---

### User Story 6 — Quản trị Lịch phòng OTA Calendar, Giá Động & Cửa sổ Đặt trước (Priority: P2)

Admin sử dụng `/calendar` trên `everyinn-admin` (và quy trình Gantt/Wizard dùng chung Session Engine `AdminApi`) để quản lý giá theo ngày (`rate_overrides`), đóng/mở bán hàng loạt (`room_blocks/bulk`), và cấu hình cửa sổ đặt trước luân phiên (`booking_rules.max_advance_days`).

**Independent Test**:
1. Chỉnh giá `overnight` cho `haven` ngày D trên `/calendar` (`PUT /internal/v1/rate-overrides`) → `POST /api/guest/availability` trên Landing trả ngay `basePrice` mới (promotion/voucher vẫn tính theo công thức `stackDiscounts`). Bấm "Về giá niêm yết" (`POST /clear`) khôi phục giá gốc nhưng vẫn giữ audit row `is_active = 0`.
2. Đóng bán hàng loạt (`POST /internal/v1/room-blocks/bulk` với `skipConflicts: true`) khóa phòng trống `12:00 → 12:00` và bỏ qua phòng đang có khách.
3. Đổi `booking_rules.max_advance_days = 60` (`PUT /internal/v1/configs/booking_rules`) → `GET /api/guest/storefront` cập nhật `bookingWindow.maxDate`, Landing DatePicker disable ngày > `today + 60d`, BFF/Core trả `422 ADVANCE_BOOKING_EXCEEDED` với `landing-bff`/`agent-core`, còn Admin nhận `warnings[]` (D11).

---

## 3. Edge Cases & Boundary Conditions

1. **Đua giữ cùng phòng (Race Condition)**: BFF & `booking_sessions` đi tuần tự qua DO `BookingSessionLive` (mutex theo session) và `everyinn-booking-core` chèn `inventory_slots` trong 1 `db.batch()`. Người chậm hơn nhận `409 AVAILABILITY_CHANGED`.
2. **Chuyển khoản trễ sau khi hết hạn 10 phút (`late_payment`)**: Khách vẫn bấm được `"Tôi đã chuyển khoản"` khi phiên đang `expired` → chuyển `late_payment`, Quản lý dùng nút `restore` trên Telegram: nếu slot còn trống Core tạo hold mới & confirm đơn; nếu đã mất slot chuyển `conflict` + cảnh báo để xử lý đổi phòng/hoàn tiền.
3. **Ca Qua đêm `24h-12h` lúc rạng sáng (`00:00 – 04:59` VN)**: `defaultNightDate()` mặc định gợi ý đêm hôm qua (`today - 1`) cho khách muốn vào ngay trong đêm; nếu khách chủ động chọn đêm `today`, check-in là `00:00` ngày `today + 1`. Với giới hạn `max_advance_days`, `overnightNightDate` luôn neo vào **đêm D** (ngày thương mại), kể cả ca `24h-12h`.
4. **Tính liên tục & 60 phút dọn phòng 2 chiều**: `inventory_slots` ghi cả làn `occupancy` và `turnover` (`+60'`). Nếu nút thêm giờ bậc `k` đụng lịch hoặc đụng buffer dọn phòng của ca liền trước/sau, bậc `k` và mọi bậc lớn hơn đều disabled (`TURNOVER_BUFFER_CONFLICT`).
5. **Xung đột Admin thao tác Hold của Session (`409 SESSION_MANAGED`)**: Hold có `session_id` chỉ do `everyinn-agent-core` điều khiển; Admin gọi trực tiếp `PATCH/extend/release/confirm` lên `booking-core` sẽ bị từ chối `409 SESSION_MANAGED` và phải đi qua `AdminApi /sessions/*`.

---

## 4. Requirements

### 4.1. Functional Requirements (FR)

#### A. Tìm kiếm & Quy tắc lưu trú (`FR-SEARCH`)
- **FR-001**: `SearchBar` + `POST /api/guest/availability` hỗ trợ 3 chế độ (`hourly`, `overnight`, `dayuse`), đọc catalog qua `GET /api/guest/storefront` (`ETag`).
- **FR-002**: 4 ca qua đêm chuẩn 12 tiếng cấu hình tại `booking_configs.overnight_shifts` (`21-9`, `22-10`, `23-11`, `24-12`).
- **FR-003**: Ma trận nút thêm giờ `overnightAddons` (`+60.000đ/giờ`, tối đa 3 nút/phòng mỗi chiều tổng hợp theo biên `[21:00, 12:00]`) với nhãn `+Nh nhận sớm` / `+Nh trả muộn`.
- **FR-004**: Bất biến 60 phút dọn phòng 2 chiều (`TURNOVER_MINUTES = 60`) và kiểm tra liên tục trên 1 batch slot query.
- **FR-005**: `dayuse` cố định `15:00` check-in / `12:00` check-out.
- **FR-006**: `hourly` chỉ cho phép nhận từ `08:00` đến `21:00` theo **bước 1 giờ chẵn (`:00`)**, thời lượng tối thiểu `3` giờ (`3..12`), và kiểm tra `min_lead_minutes` (mặc định `30` phút).

#### B. Session Engine, Phone-First Hold, CDP & Stacking (`FR-BOOKING`)
- **FR-007**: Landing BFF tại `/api/guest/*` giao tiếp `BOOKING_CORE` (chỉ `LANDING_READ`) và `AGENT_CORE` (`LandingApi`, caller `landing-bff`, actor web `900002`).
- **FR-008**: Tạo hold mặc định `10` phút cho web (`15` phút cho admin), hỗ trợ `clientNonce` idempotency và **Phone-First Hold** (tối đa **1 phiên sống / `phone_hash`**, `409 ANOTHER_SESSION_LIVE` kèm `forceSwitch: true`).
- **FR-009**: URL phiên `/dat-phong/<token>` (capability token 32 byte, `TOKEN_PATTERN`), BFF không index (`robots: noindex`, `referrer: no-referrer`).
- **FR-010**: `PATCH /api/guest/sessions/[token]` thu thập `name`, `phone`, `zalo/instagram/facebook` (tự gán `zalo = phone` nếu bỏ trống MXH), `note`, `promotionCode`, `voucherId`/`noVoucher`; hỗ trợ `DELETE /api/guest/sessions/[token]` để khách huỷ ngay.
- **FR-011**: CDP Loyalty + Ví Voucher `customer_vouchers`: mỗi đơn tối đa 1 promotion; sai mã trả `422 PROMOTION_NOT_APPLICABLE` (không fallback về public promo); áp dụng `stackDiscounts` sao cho promo + voucher không vượt `min(basePrice, subtotal)`. Lease voucher theo hold (`reserveVoucher`), release khi huỷ/hết hạn, redeem khi accrual, restore khi booking bị cancel (giữ `redeemed` nếu `no_show`).

#### C. Thanh toán, Realtime DO, Telegram & Webhook (`FR-PAYMENT`)
- **FR-012**: VietQR động dùng thông tin ngân hàng từ `Booking Core` `properties.bank_*` và mã tham chiếu `EIPAY<YYMMDD><4CHAR>`. Hỗ trợ đầy đủ cả thanh toán thiếu (`underpaid`) & top-up phần còn lại.
- **FR-013**: Thẻ Telegram thống nhất chỉnh tại chỗ (`ss:<sid>:ok|no|amt|rv|rv!|keep|short|topup|restore`, `sm:<inbox>:<sid>`). Từ chối lần 1 quay về `awaiting_payment`/`underpaid`; lần 2 huỷ đơn & giải phóng phòng. Tuyệt đối không in plaintext mã cửa trên Telegram (D9).
- **FR-014**: `POST /webhooks/payments/:provider` (`sepay`, `casso`, `payos`) trên `everyinn-agent-core` (trả `404` khi chưa có secret), lưu `payment_webhook_inbox` đã lọc PII & dedupe `provider_txn_id`, mặc định shadow mode (`autoConfirmExactMatch = false`).
- **FR-015**: Long-poll 25s qua DO `BookingSessionLive` (`/sessions/[token]/live`) và DO `InventoryPulse` (`/pulse`), fallback adaptive short-poll `4s → 30s`, dừng khi tab ẩn.

#### D. Tra cứu Check-in, Bảo mật & Rate Limit (`FR-CHECKIN`)
- **FR-016**: `/checkin` tra cứu mọi đơn `confirmed` (`web`, `admin`, `chat`) bằng SĐT + 1 trong 3 khoá 2 (`booking_ref`, `social`, `checkin_date_room`), trả 4 khối hướng dẫn chuẩn + `Cache-Control: private, no-store`.
- **FR-017**: Mã cửa & hộp khóa chỉ hiển thị trong `[checkinAt - codesVisibleHoursBefore, checkoutAt + 2h]` (`codesVisibleHoursBefore` đọc từ master data `checkin_guide`, mặc định code hiện tại `6`h); ngoài khung trả `visible: false`, mã thay bằng `••••` + `pendingNote`.
- **FR-018**: Rate limiting 2 lớp:
  - Workers RL: `SEARCH_RL` `30/60s` (`storefront`, `availability`, `preview`), `HOLD_RL` `3/60s` (`POST /sessions`), `PAID_RL` `5/60s` theo token prefix (`POST /paid`), `LOOKUP_RL` `5/60s` (`POST /checkin/lookup`).
  - D1: `maxLiveHoldsPerIp = 2` (web) / `10` (admin), `1` live session/`phone_hash`, `ckfail:<ipHash>` tối đa `5` lần sai / `15` phút / IP (`429`).

#### E. Quản trị Calendar OTA & Unified Admin Flow (`FR-CALENDAR`)
- **FR-019**: Calendar `/calendar` hỗ trợ:
  - `GET /internal/v1/calendar/matrix` (≤ 62 ngày, `ETag`), `GET|PUT /internal/v1/rate-overrides` & `POST /internal/v1/rate-overrides/clear` (`room_scope`, `rate_plan_code IN ('combo3h','overnight','dayroom')`).
  - `POST /internal/v1/room-blocks/bulk` (tối đa 31 ngày, `skipConflicts`, các loại `stop_sell | maintenance | owner_stay | deep_cleaning`) & `POST /internal/v1/room-blocks/:id/release`.
  - `PUT /internal/v1/configs/booking_rules` với `max_advance_days` (`1..730`, mặc định `90` ngày dương lịch, tịnh tiến lúc `00:00` VN); chặn `422` với web/chat và cảnh báo `warnings[]` với admin.
  - Admin wizard + Gantt drawer dùng chung `booking_sessions` (`AdminApi`) và bảo vệ bằng `409 SESSION_MANAGED`.

### 4.2. Non-Functional Requirements (`NFR`)
- **NFR-001 (Mobile-First UX)**: Viewport tối ưu `360px`–`430px`, tap targets ≥ 44px, tương thích tiếng Việt đầy đủ, `no-referrer` + `noindex` cho URL token.
- **NFR-002 (Cloudflare Limits)**: Mọi truy vấn D1 đều có index bao phủ (`idx_sessions_*`, `idx_rate_overrides_active_date`, `idx_vouchers_*`), multi-table writes gói trong `db.batch()`, dùng `BookingSessionLive` / `InventoryPulse` và `ETag` để giữ tải Request & CPU ở mức tối thiểu.
- **NFR-003 (Zero Leakage)**: Secret & `DOOR_CODE_KEY` chỉ nằm ở `everyinn-agent-core`; `token`, `phone`, `ip` chỉ lưu dạng hash (`token_hash`, `phone_hash`, `ip_hash` có pepper); mã cửa mã hoá AES-GCM.

---

## 5. Measurable Success Criteria

- **SC-001**: 100% khung tìm kiếm (`hourly` bước 1h `:00`, `overnight` 4 ca + nút thêm giờ 60k/h, `dayuse` `15:00->12:00`) phản ánh tức thì dữ liệu `everyinn-booking-core`.
- **SC-002**: 0% double-booking nhờ DO mutex + D1 CAS + atomic `inventory_slots`.
- **SC-003**: Trạng thái thanh toán cập nhật tới trình duyệt khách trong `< 1 giây` qua DO long-poll khi Quản lý bấm xác nhận hoặc Webhook khớp.
- **SC-004**: Giới hạn chính xác 1 phiên sống/SĐT (kèm 1-click switch), 2 phiên sống/IP, 3 hold/phút/IP, và khoá tra cứu `/checkin` sau 5 lần sai/15 phút/IP.
- **SC-005**: 100% đơn `confirmed` trên mọi kênh nhận được 4 khối hướng dẫn `/checkin`, và mã khoá chỉ lộ đúng trong cửa sổ `codesVisibleHoursBefore`.
