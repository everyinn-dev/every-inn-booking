# Tasks: Guest Self-Booking, Payment & Self Check-in Landing Page

- **Input**: Design documents from `specs/001-guest-self-booking/` (`spec.md`, `plan.md`, `data-model.md`, `contracts/guest-booking-api.md`)
- **Version**: 2.0.0 (Updated to Core Pricing v2.0, Real-world Operational Metrics & Edge Security)
- **Methodology**: GitHub Spec-Kit (`[ID] [P?] [Story] Description with exact file path`)
  - `[P]`: Có thể thực thi song song (khác file, không phụ thuộc chéo)
  - `[US1]`..`[US6]`: Liên kết trực tiếp với User Story trong `spec.md`

---

## Phase 1: Setup & Cross-Service Contracts (Shared Infrastructure)

**Purpose**: Cập nhật cấu hình Service Bindings, định danh Caller `landing-bff`, module Rate Limiter theo IP và đồng bộ kiểu dữ liệu giữa các repo.

- [ ] **T001** Cập nhật `van hanh/booking-page/everyinn-platform-docs/CONVENTIONS.md` và `contracts/booking-core.d.ts` để bổ sung caller `'landing-bff'`, kiểu `OvernightAddonsDTO` (đơn giá `60.000đ/giờ`), DTOs ưu đãi Public/Private/CDP và contract tra cứu đơn cho khách (`guest-lookup`).
- [ ] **T002** [P] Cập nhật module context caller trong `van hanh/booking-page/everyinn-booking-core/src/lib/context.ts` và `van hanh/booking-page/everyinn-cdp-core/src/lib/context.ts` để chấp nhận header `x-ei-caller: landing-bff`.
- [ ] **T003** [P] Cấu hình Service Bindings (`BOOKING_CORE`, `CDP_CORE`, `AGENT_CORE`) và biến môi trường Telegram/VietQR trong `van hanh/booking-page/every-inn-booking/wrangler.jsonc` và `cloudflare-env.d.ts`.
- [ ] **T004** Tạo bộ Client gọi Core chuẩn hóa (kèm `x-request-id` & `x-ei-caller: landing-bff`) tại `van hanh/booking-page/every-inn-booking/src/lib/server/coreClients.ts`.
- [ ] **T005** [P] Xây dựng Edge Rate Limiter theo IP (`CF-Connecting-IP`) với sliding window in-memory (Search: 30/m, Create Hold: 5/10m, Notify Paid: 5/m, Checkin: 5/15m) tại `van hanh/booking-page/every-inn-booking/src/lib/server/rateLimit.ts`.

---

## Phase 2: Foundational Core Extensions (Blocking Prerequisites)

**Purpose**: Mở rộng `everyinn-booking-core` và `everyinn-agent-core` để phục vụ 4 ca qua đêm (kèm nút thêm giờ `60.000đ/giờ`), thông báo Telegram mọi trạng thái, chuẩn bị mã phòng trước và tra cứu đa khóa.

- [ ] **T006** [US1] Xây dựng module tính toán các nút mua thêm giờ qua đêm (`computeOvernightAddons`) tuân thủ ma trận 4 ca (`21h-9h`, `22h-10h`, `23h-11h`, `24h-12h`), đơn giá cố định `60.000đ/giờ` và kiểm tra tính liên tục của slot + 60p dọn phòng tại `van hanh/booking-page/everyinn-booking-core/src/domain/overnightAddons.ts`.
- [ ] **T007** [US1] Mở rộng handler `POST /internal/v1/availability/search` trong `van hanh/booking-page/everyinn-booking-core/src/handlers/availability.ts` để truy vấn cửa sổ mở rộng `[20:00, 13:00 hôm sau]` trong 1 lần đọc D1 và đính kèm `overnightAddons` vào từng phòng trả về.
- [ ] **T008** [P] [US2] Mở rộng handler tính toán và kiểm tra khuyến mãi `POST /internal/v1/promotions/validate` tại `van hanh/booking-page/everyinn-booking-core/src/handlers/availability.ts` hỗ trợ áp dụng cả Public promotions (`is_public = 1`), Private promo codes (`is_public = 0`) và voucher thưởng tích tem CDP.
- [ ] **T009** [P] [US4] Tạo endpoint nội bộ xác thực tra cứu đơn đa khóa `POST /internal/v1/bookings/guest-lookup` (so khớp SĐT + Mã đơn/Mã EIPAY/MXH/Ngày nhận phòng) tại `van hanh/booking-page/everyinn-booking-core/src/handlers/guestBookingLookup.ts`.
- [ ] **T010** [US3] [US5] Tạo migration D1 `van hanh/booking-page/everyinn-agent-core/migrations/0002_landing_self_booking.sql` bổ sung bảng `landing_payment_verifications`.
- [ ] **T011** [US3] [US5] Xây dựng handler thông báo Telegram mọi trạng thái đơn & chuẩn bị mã cổng/hộp khóa (`<pass_cổng>#`, `<pass lock box>`) kèm lời nhắc Quản lý (Human Manager) cài pass tại `van hanh/booking-page/everyinn-agent-core/src/handlers/landingNotifications.ts` và `guestCheckinAccess.ts`.
- [ ] **T012** [US3] Mở rộng bộ xử lý Telegram Callback trong `van hanh/booking-page/everyinn-agent-core/src/flows/confirm.ts` để khi Quản lý bấm `[✅ Đã nhận đủ]` (`lpcf:<holdId>`), hệ thống tự động gọi `BOOKING_CORE` chốt đơn, gán mã phòng và gửi tin nhắn nhắc cài pass.
- [ ] **T013** [US1] [US4] Viết bộ Unit Test kiểm thử toàn diện quy tắc 4 ca qua đêm (đơn giá `60.000đ/giờ`), công thức Core Pricing v2.0 (giảm giá chỉ tính trên `basePrice`) và tra cứu đa khóa tại `van hanh/booking-page/everyinn-booking-core/test/overnightAddons.test.ts`.

---

## Phase 3: User Story 1 — Tìm phòng Agoda/Airbnb & Chọn nút Thêm giờ trên Thẻ phòng (Priority: P1) 🎯 MVP

**Goal**: Khách tìm phòng trên Landing Page với 3 chế độ (Giờ `08:00 - 21:00` / Qua đêm 4 ca / Theo ngày 15h-12h) và bấm chọn trực tiếp các nút `+1h/+2h/+3h checkin sớm` hoặc `checkout muộn` hợp lệ ngay trên từng thẻ phòng với đơn giá `+60.000đ/giờ`.

**Independent Test**: Mở trang chủ `/`, chuyển đổi giữa 3 tab, kiểm tra kết quả 6 phòng trả về và bấm chọn các chip thêm giờ trên thẻ phòng (giá cộng đúng 60k/h).

- [ ] **T014** [P] [US1] Xây dựng helper cấu hình 4 ca qua đêm, đơn giá thêm giờ `60.000đ/giờ`, quy tắc ngày in/out 15h–12h và tính giá tạm tính trên client tại `van hanh/booking-page/every-inn-booking/src/lib/booking/overnightRules.ts`.
- [ ] **T015** [US1] Tạo BFF route `POST /api/guest/availability/search` (tích hợp `rateLimit.ts` 30 req/phút/IP) tại `van hanh/booking-page/every-inn-booking/src/app/api/guest/availability/search/route.ts`.
- [ ] **T016** [US1] Thiết kế component `AgodaSearchBar.tsx` (Mobile-First, 3 tab: Theo giờ 8h-21h / Qua đêm 4 ca pill selector / Theo ngày chỉ chọn ngày in-out kèm thông báo 15h-12h) tại `van hanh/booking-page/every-inn-booking/src/components/booking/AgodaSearchBar.tsx`.
- [ ] **T017** [US1] Thiết kế component `InteractiveRoomCard.tsx` (Carousel ảnh phòng, Badge hạng phòng & Khuyến mãi công khai Admin, khu vực nút bấm `+1h/2h/3h checkin sớm` và `+1h/2h/3h checkout muộn` với đơn giá `+60.000đ/giờ`) tại `van hanh/booking-page/every-inn-booking/src/components/booking/InteractiveRoomCard.tsx`.
- [ ] **T018** [US1] Thiết kế `AvailableRoomGrid.tsx` và tích hợp thay thế khu vực đặt phòng tĩnh trên trang chủ `van hanh/booking-page/every-inn-booking/src/app/page.tsx`.

---

## Phase 4: User Story 2 — Giữ phòng 10 phút, Điền thông tin, CDP & Khuyến mãi (Priority: P1)

**Goal**: Khi khách bấm "Đặt phòng ngay", khóa lịch phòng trong đúng 10 phút (`ttlSeconds = 600`), thu thập thông tin khách, tự động nhận diện hạng thẻ CDP & quà tặng tem, áp dụng khuyến mãi tốt nhất theo Core Pricing v2.0.

**Independent Test**: Bấm "Đặt phòng ngay" -> Chuyển sang `/book/[holdId]` -> Đồng hồ đếm ngược 10:00 chạy -> Nhập SĐT & Mã Promo -> Nhận mã VietQR.

- [ ] **T019** [P] [US2] Tạo các BFF route quản lý Hold 10 phút:
  - `POST /api/guest/holds` (tích hợp `rateLimit.ts` 5 holds/10m/IP) tại `van hanh/booking-page/every-inn-booking/src/app/api/guest/holds/route.ts`
  - `GET / PATCH / DELETE /api/guest/holds/[id]` (hỗ trợ ETag `holdVersion`) tại `van hanh/booking-page/every-inn-booking/src/app/api/guest/holds/[id]/route.ts`
  - `POST /api/guest/promotions/preview` tại `van hanh/booking-page/every-inn-booking/src/app/api/guest/promotions/preview/route.ts`
- [ ] **T020** [P] [US2] Xây dựng `HoldCountdownBanner.tsx` (Thanh đếm ngược 10 phút dính trên đỉnh màn hình, tự động cảnh báo khi còn dưới 2 phút) tại `van hanh/booking-page/every-inn-booking/src/components/booking/HoldCountdownBanner.tsx`.
- [ ] **T021** [US2] Xây dựng `GuestCheckoutForm.tsx` (Form SĐT tự động kiểm tra CDP hội viên & thưởng tem, Họ tên, Zalo/Instagram/Facebook, Số khách, Ô mã giảm giá Private/Public, Ghi chú) tại `van hanh/booking-page/every-inn-booking/src/components/booking/GuestCheckoutForm.tsx`.

---

## Phase 5: User Story 3 — Thanh toán VietQR, Xác nhận qua Telegram & Near-Realtime Polling (Priority: P1)

**Goal**: Hiển thị mã VietQR MB Bank chính xác theo đơn, gửi thông báo Telegram có nút bấm xác nhận cho Quản lý khi khách báo đã chuyển khoản, áp dụng Near-Realtime Adaptive Short Polling 3-4s tự động chuyển trang khi Quản lý duyệt.

**Independent Test**: Bấm "Tôi đã chuyển khoản" -> Quản lý bấm `[✅ Đã nhận đủ]` trên Telegram -> Web khách tự động chuyển sang màn hình Thành công trong vòng < 4 giây.

- [ ] **T022** [P] [US3] Tạo BFF route `POST /api/guest/holds/[id]/notify-paid` (rate-limit 5 req/phút/hold) tại `van hanh/booking-page/every-inn-booking/src/app/api/guest/holds/[id]/notify-paid/route.ts`.
- [ ] **T023** [P] [US3] Tạo BFF route `POST /api/webhooks/banking` (hỗ trợ SePay/Casso/PayOS webhook đối soát tự động mã `EIPAY...`) tại `van hanh/booking-page/every-inn-booking/src/app/api/webhooks/banking/route.ts`.
- [ ] **T024** [US3] Xây dựng `VietQRPaymentPanel.tsx` (Hiển thị QR MB Bank `0906314109999`, nút tải QR, copy STK/Nội dung, nút "Tôi đã chuyển khoản" và cơ chế Near-Realtime Adaptive Short Polling 3-4s với ETag) tại `van hanh/booking-page/every-inn-booking/src/components/booking/VietQRPaymentPanel.tsx`.
- [ ] **T025** [US2] [US3] Hoàn thiện trang Checkout tổng hợp `/book/[holdId]` tại `van hanh/booking-page/every-inn-booking/src/app/book/[holdId]/page.tsx`.

---

## Phase 6: User Story 4 & 5 — Tra cứu Đa Khóa & Trang Landing Page Hướng dẫn Check-in (`/checkin`) (Priority: P1)

**Goal**: Khách nhập ít nhất 2 khóa xác thực để mở trang Hướng dẫn Check-in cá nhân hóa với 4 khối nội dung theo đúng thứ tự yêu cầu (Text đã thay biến `<pass_cổng>#`, `<số phòng>`, `<pass lock box>` -> 2 Ảnh -> Text Taxi 71/31 -> Video hướng dẫn).

**Independent Test**: Mở `/checkin`, nhập SĐT + Mã `EIPAY...` -> Kiểm tra 4 khối nội dung hiển thị đúng thứ tự và đúng mã khóa của phòng.

- [ ] **T026** [P] [US4] Chuẩn bị và tối ưu hóa bộ media hướng dẫn Check-in/Check-out (2 hình ảnh hướng dẫn và video hướng dẫn đi ô tô vào đầu hẻm 71/31) đặt tại `van hanh/booking-page/every-inn-booking/public/checkin-guide/`.
- [ ] **T027** [P] [US4] Xây dựng module template văn bản Check-in 4 bước và hàm thay thế biến an toàn (`renderCheckinGuideContent`) tại `van hanh/booking-page/every-inn-booking/src/lib/booking/checkinTemplate.ts`.
- [ ] **T028** [US4] Tạo BFF route `POST /api/guest/checkin/lookup` (kiểm tra rate-limit 5 lần/15 phút/IP, xác thực >= 2 keys, lấy mã giải mã từ `AGENT_CORE`, trả về header `Cache-Control: private, no-store`) tại `van hanh/booking-page/every-inn-booking/src/app/api/guest/checkin/lookup/route.ts`.
- [ ] **T029** [US4] Xây dựng `CheckinLookupForm.tsx` (Giao diện nhập SĐT + chọn khóa xác thực thứ 2 trực quan trên di động) tại `van hanh/booking-page/every-inn-booking/src/components/checkin/CheckinLookupForm.tsx`.
- [ ] **T030** [US4] Xây dựng `CheckinGuideView.tsx` (Hiển thị Thẻ Copy Nhanh Mã Cổng/Phòng/Hộp khóa + 4 Khối Nội Dung đúng thứ tự: Text chuẩn -> 2 Hình ảnh có Lightbox -> Text Taxi 71/31 -> Video Player) tại `van hanh/booking-page/every-inn-booking/src/components/checkin/CheckinGuideView.tsx`.
- [ ] **T031** [US4] Tạo trang `/checkin` tại `van hanh/booking-page/every-inn-booking/src/app/checkin/page.tsx` và gắn nút dẫn `"🔑 Tra cứu Mã phòng & Hướng dẫn Check-in"` lên Header/Footer của Landing Page.

---

## Phase 7: User Story 6 — Quản Trị Lịch Phòng Kiểu OTA, Stop-Sell, Dynamic Rate Overrides & Rolling Advance Window (Priority: P2 / Admin)

**Goal**: Cung cấp giao diện ma trận Calendar kiểu OTA cho Admin chủ động Đóng/Mở bán (Stop-Sell), Điều chỉnh giá trực tiếp theo ngày/ca (`calendar_rate_overrides`), và Cửa sổ nhận đặt trước luân phiên (`max_advance_days`: 2 tháng, 3 tháng, 6 tháng, 1 năm) tự động dời mỗi ngày.

**Independent Test**: Vào màn hình Admin `/calendar` -> Bấm Đóng bán phòng 202 ngày 20/11 -> Khách lên Landing Page tìm phòng ngày 20/11 thấy phòng 202 bị ẩn hoặc báo hết -> Admin đổi giá ngày 21/11 thành 580.000đ -> Khách tìm thấy giá 580.000đ và khuyến mãi áp dụng trên 580.000đ -> Thử đặt ngày quá 90 ngày tới bị chặn cả trên Web DatePicker lẫn Core API.

- [ ] **T032** [US6] Tạo migration D1 `van hanh/booking-page/everyinn-booking-core/migrations/0005_calendar_rate_overrides.sql` tạo bảng `calendar_rate_overrides`, bổ sung cột `max_advance_days` vào `booking_configs` và các index phục vụ truy vấn tối ưu.
- [ ] **T033** [P] [US6] Mở rộng domain pricing trong `van hanh/booking-page/everyinn-booking-core/src/domain/pricing.ts` để tra cứu và thay thế $P_{\text{base}}$ bằng `custom_base_price` từ `calendar_rate_overrides` trước khi áp dụng chiết khấu promo/CDP.
- [ ] **T034** [P] [US6] Xây dựng module kiểm tra ngày đặt trước luân phiên `bookingRules.ts` trong `van hanh/booking-page/everyinn-booking-core/src/domain/bookingRules.ts` xác thực $D_{\text{checkin}} \le D_{\text{today}} + \text{max\_advance\_days}$, trả về `422 ADVANCE_BOOKING_EXCEEDED` nếu vi phạm.
- [ ] **T035** [US6] Xây dựng các handler API nội bộ trong `van hanh/booking-page/everyinn-booking-core/`:
  - `src/handlers/calendar.ts`: `GET /internal/v1/calendar/matrix` (tổng hợp trạng thái phòng, giá bán, override, stop-sell trong khoảng ngày)
  - `src/handlers/rateOverrides.ts`: `POST /internal/v1/calendar/rate-overrides` và `DELETE /internal/v1/calendar/rate-overrides/:id`
  - `src/handlers/roomBlocks.ts`: `POST /internal/v1/room-blocks/stop-sell` và `DELETE /internal/v1/room-blocks/:id`
  - `src/handlers/bookingConfigs.ts`: `GET /internal/v1/booking-configs` và `PATCH /internal/v1/booking-configs`
- [ ] **T036** [US6] Cập nhật component `AgodaSearchBar.tsx` trên `van hanh/booking-page/every-inn-booking` để vô hiệu hóa (disabled) các ngày vượt quá `max_advance_days` trên DatePicker.
- [ ] **T037** [P] [US6] Xây dựng trang Ma Trận Lịch Phòng Kiểu OTA tại `van hanh/booking-page/everyinn-admin/src/app/calendar/page.tsx` và component `CalendarMatrixView.tsx` hiển thị lưới phòng x ngày, màu trạng thái, giá bán hiện tại và badge override.
- [ ] **T038** [US6] Xây dựng các component tương tác Admin tại `van hanh/booking-page/everyinn-admin/src/components/calendar/`:
  - `StopSellActionModal.tsx`: Đóng/Mở phòng nhanh cho 1 ngày hoặc dải ngày
  - `DynamicRateOverrideDrawer.tsx`: Chỉnh sửa giá bán trực tiếp theo ngày và ca
  - `RollingAdvanceWindowConfig.tsx`: Cấu hình số tháng/ngày nhận trước (2 tháng, 3 tháng, 6 tháng, 1 năm)
- [ ] **T039** [US6] Viết Unit Test kiểm thử bảng ghi đè giá (`calendar_rate_overrides`), kiểm thử tích hợp giá Core v2.0 khi có override, và kiểm thử logic dời ngày tự động `max_advance_days` tại `van hanh/booking-page/everyinn-booking-core/test/calendarRateOverrides.test.ts`.

---

## Phase 8: Polish, Accessibility & End-to-End Verification

- [ ] **T040** [P] Kiểm tra toàn bộ giao diện trên viewport di động (`375x812` iPhone SE/14, `430x932` Pro Max, Android Chrome): đảm bảo nút chạm `>= 44x44px`, font tiếng Việt có dấu hiển thị hoàn hảo, không bị tràn ngang (`overflow-x: hidden`).
- [ ] **T041** [P] Kiểm tra tuân thủ Cloudflare Free Tier (`rules/cloudflare-free-tier.md`): xác nhận bundle size, CPU time `< 10ms`, tải toàn hệ thống ~2.000 req/ngày (< 3% quota 100k/ngày) và mọi câu lệnh D1 đều dùng index.
- [ ] **T042** Chạy kiểm thử toàn trình (End-to-End Flow): Tìm phòng Qua đêm -> Chọn thêm giờ trên thẻ phòng (+60k/h) -> Giữ chỗ 10 phút -> Nhập SĐT nhận ưu đãi CDP/Promo -> Nhận VietQR -> Bấm đã chuyển khoản -> Near-realtime polling -> Bấm xác nhận trên Telegram -> Nhận tin nhắn nhắc cài pass -> Mở `/checkin` bằng 2 key và kiểm tra 4 phần nội dung hướng dẫn -> Kiểm tra Stop-Sell và Dynamic Rate Override trên Calendar Admin.
