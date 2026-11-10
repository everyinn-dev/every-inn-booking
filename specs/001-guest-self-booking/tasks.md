# Tasks: Guest Self-Booking, Payment & Self Check-in Landing Page

- **Branch**: `feat/landing-self-booking` (Spec-Kit `001-guest-self-booking`)
- **Version**: 3.0.0 (Aligned 100% with [source-of-truth.md](./source-of-truth.md) and actual codebase)
- **Last Updated**: 2026-11-10
- **Input Docs**: [spec.md](./spec.md) · [plan.md](./plan.md) · [data-model.md](./data-model.md) · [contracts/guest-booking-api.md](./contracts/guest-booking-api.md)

---

## Tổng quan Tiến độ (`LSB-0` .. `LSB-10` + QA Fixes)

Tính năng Landing Self-Booking & Session Engine thống nhất đã triển khai hoàn chỉnh mã nguồn qua các task `LSB-0` .. `LSB-6`, merge/deploy UAT (`LSB-8`) và xử lý xong các điểm chuẩn hoá từ QA Audit ngày 2026-11-09 (`HOURLY-1H`, `STACKING-CAP`, `PHONE-FIRST-HOLD`). Các hạng mục còn mở thuộc nhóm cấu hình vận hành / quyết định của Owner trước hoặc sau Go-Live Production.

| Task ID | Hạng mục | Trạng thái | Đường dẫn / Ghi chú kiểm chứng |
|---|---|---|---|
| `LSB-0` | Shared Kit, OpenAPI Contracts & Docs | **DONE** `[x]` | `everyinn-platform-docs/shared/booking-kit/*`, `CONVENTIONS.md`, bộ `specs/001-guest-self-booking/*` & `EI_LANDING_SELF_BOOKING_SPEC.md` (`v3.0.0`, 2026-11-10) |
| `LSB-1` | `everyinn-booking-core` Extensions | **DONE** `[x]` | Migration `0010`, `LANDING_READ`, `storefront.ts`, `stayRules.ts`, `availability.ts`, `SESSION_MANAGED` |
| `LSB-1b` | `everyinn-cdp-core` Voucher Wallet | **DONE** `[x]` | Migration `0004` (`customer_vouchers`), `handlers/vouchers.ts`, `accrual.ts`, `outcomes.ts` |
| `LSB-2` | `everyinn-agent-core` Session Engine & DOs | **DONE** `[x]` | Migration `0021`, `src/sessions/*`, DO `BookingSessionLive` & `InventoryPulse`, `LandingApi`, `AdminApi`, `POST /webhooks/payments/:provider`, `SEED_VERSION = 11` |
| `LSB-3` | `every-inn-booking` BFF (`/api/guest/*`) | **DONE** `[x]` | 9 route files (11 HTTP operations), `guard()` (flag + same-origin + Workers RL), `criteria.ts`, `storefront.ts` |
| `LSB-4` | `every-inn-booking` UI & `/checkin` | **DONE** `[x]` | `/`, `/dat-phong`, `/dat-phong/[token]`, `/checkin`, `HomeBooking`, `SearchBar`, `SearchPage`, `RoomResultCard`, `PhoneHoldModal`, `CheckoutPage`, `CheckinPage` |
| `LSB-5` | `everyinn-admin` Unified Session Wizard | **DONE** `[x]` | `BookingWizard`, `SessionPaymentPanel`, `HoldSessionDrawer`, `GanttHoldBar`, `/api/sessions/*` |
| `LSB-6` | OTA Calendar Extranet | **DONE** `[x]` | Migration `0011`, `calendar.ts`, `/calendar/matrix`, `/rate-overrides`, `/room-blocks/bulk`, `admin/src/app/calendar/page.tsx` |
| `LSB-8` | UAT Release (`dev` & migrations) | **UAT DONE** `[x]` | Dev migrations `0004`, `0010`, `0011`, `0021` + `uat-lsb-smoke.mjs` (16/16). **Prod rollout xem mục Còn mở** |
| `LSB-7` | Media Check-in thật trong `checkin_guide` | **BLOCKED (Owner)** `[ ]` | Cần URL ảnh check-in/out & video đầu hẻm `71/31` điền vào `checkin_guide` |
| `LSB-10` | Chuyển kênh Chat AI sang Session Engine | **DEFERRED** `[ ]` | Ngoài phạm vi MVP Landing |

---

## Phase 1: Setup & Cross-Service Infrastructure (`LSB-0`, `LSB-1`)

- [x] **T001** Khởi tạo và đồng bộ `shared/booking-kit/{format,live,stay,types}.ts` sang `every-inn-booking/src/shared/booking-kit/` và `everyinn-admin/src/shared/booking-kit/` bằng `everyinn-platform-docs/scripts/sync-booking-kit.mjs`.
- [x] **T002** Cập nhật `everyinn-booking-core/src/lib/context.ts` và `everyinn-cdp-core/src/lib/context.ts` hỗ trợ caller `landing-bff`; khóa quyền `LANDING_READ` trong `everyinn-booking-core/src/routes.ts` chỉ cho phép đọc.
- [x] **T003** Cấu hình `every-inn-booking/wrangler.jsonc` & `env.d.ts`: Service Bindings (`CDP_CORE`, `BOOKING_CORE`, `AGENT_CORE` với entrypoint `LandingApi`), 4 Workers Rate Limiting bindings (`SEARCH_RL` 30/60s, `HOLD_RL` 3/60s, `PAID_RL` 5/60s, `LOOKUP_RL` 5/60s), và biến `WEB_BOOKING_ENABLED` (`"false"` ở Prod, `"true"` ở Dev).
- [x] **T004** Xây dựng lớp BFF plumbing (`guard()`, `bookingCore`, `agent()`, envelope `{ ok, data | error, requestId }`, `Cache-Control: private, no-store`) tại `every-inn-booking/src/lib/server/bff.ts` và cached storefront reader tại `every-inn-booking/src/lib/server/storefront.ts`.

---

## Phase 2: Foundational Core & Session Engine (`LSB-1`, `LSB-1b`, `LSB-2`)

- [x] **T005** Tạo migration D1 `everyinn-booking-core/migrations/0010_booking_sessions_channel.sql` bổ sung `channel`, `session_id` trên `room_holds` & `bookings`; `voucher_code`, `voucher_value` trên `bookings`; `caller` trên `booking_audit_events`; `external_ref` trên `manual_financial_entries`; row cấu hình `overnight_shifts`.
- [x] **T006** Xây dựng stay rules, 4 ca qua đêm, `computeOvernightAddons` (`60.000đ/giờ`, 2 làn `occupancy`/`turnover`), kiểm tra cửa sổ đặt trước ngày dương lịch `maxAdvanceDate` (`422 ADVANCE_BOOKING_EXCEEDED` cho web, `warnings[]` cho admin) và bước giờ `:00` (`422 HOURLY_CHECKIN_STEP_INVALID`) tại `everyinn-booking-core/src/domain/stayRules.ts` & `src/handlers/availability.ts`.
- [x] **T007** Xây dựng read models `GET /internal/v1/storefront`, `GET /internal/v1/inventory/version` và xác thực đa khóa `POST /internal/v1/bookings/guest-lookup` (hỗ trợ mọi đơn mọi kênh) tại `everyinn-booking-core/src/handlers/storefront.ts`.
- [x] **T008** Tạo migration D1 `everyinn-cdp-core/migrations/0004_customer_vouchers.sql` và handlers ví voucher (`reserve`, `release`, đổi thưởng milestone sang voucher ví, hoàn khi `cancelled`, giữ `redeemed` khi `no_show`) tại `everyinn-cdp-core/src/handlers/vouchers.ts`, `accrual.ts`, `outcomes.ts`.
- [x] **T009** Tạo migration D1 `everyinn-agent-core/migrations/0021_booking_sessions.sql` (`booking_sessions`, `session_events`, `session_payments`, `payment_intents`, `payment_webhook_inbox`, `rate_counters`).
- [x] **T010** Triển khai Session Engine & Durable Objects tại `everyinn-agent-core/src/sessions/`:
  - State machine 10 trạng thái (`machine.ts`) & Command orchestrator (`service.ts`).
  - Durable Objects `BookingSessionLive` (long-poll 25s + alarm hết hạn) & `InventoryPulse` (`live.ts`).
  - HTTP entrypoints `LandingApi` (`/internal/v1/web/*`) & `AdminApi` (`/internal/v1/sessions*`) (`http.ts`, `index.ts`).
  - Thẻ Telegram cập nhật tại chỗ `ss:<sid>:*` và `sm:<inbox>:<sid>`, không in plaintext mã cửa (`notify.ts`, `telegram.ts`).
  - Payment adapter port `POST /webhooks/payments/:provider` (`sepay` | `casso` | `payos`) (`payments.ts`).
  - Cron reconciler mỗi phút (`reconcile.ts`) & Master Data `SEED_VERSION = 11` (`booking_channels`, `checkin_guide`, `payment_policy`) (`defaults.ts`, `policy.ts`).

---

## Phase 3–6: Guest BFF, UI Đặt phòng & `/checkin` (`LSB-3`, `LSB-4`)

- [x] **T011** Xây dựng 9 BFF routes (11 HTTP operations) dưới `/api/guest/*` tại `every-inn-booking/src/app/api/guest/`:
  - `storefront/route.ts` (`GET`, ETag `304`)
  - `availability/route.ts` (`POST`, server re-derivation qua `criteria.ts`)
  - `pulse/route.ts` (`GET`, long-poll 25s qua `InventoryPulse`)
  - `sessions/route.ts` (`POST`, Phone-First Hold, hỗ trợ `forceSwitch`, `clientNonce`)
  - `sessions/[token]/route.ts` (`GET` ETag / `PATCH` / `DELETE`)
  - `sessions/[token]/live/route.ts` (`GET`, long-poll 25s qua `BookingSessionLive`)
  - `sessions/[token]/preview/route.ts` (`POST`, tính giá + CDP tier + voucher ví)
  - `sessions/[token]/paid/route.ts` (`POST`, báo đã CK + gia hạn `+30p`)
  - `checkin/lookup/route.ts` (`POST`, đa khóa + 2 lớp rate limit + `no-store`)
- [x] **T012** Xây dựng UI Landing & Search Widget tại `every-inn-booking/src/components/booking/`:
  - `HomeBooking.tsx` nhúng trên `/` (`src/app/page.tsx`)
  - `SearchBar.tsx` (3 tab Theo giờ `:00` / Qua đêm 4 ca có `shiftSummary` / Theo ngày `15:00 -> 12:00`, chặn ngày vượt `bookingWindow.maxDate`)
  - `RoomResultCard.tsx` (chip `+1h/+2h/+3h nhận sớm` & `trả muộn` `+60k/h`, badge KM công khai, phòng bận mờ `"Vừa được đặt"`)
  - `SearchPage.tsx` trên `/dat-phong` (`src/app/dat-phong/page.tsx`, long-poll `useLongPoll`, bar dính dưới màn hình)
  - `Disabled.tsx` hiển thị khi `WEB_BOOKING_ENABLED = "false"`.
- [x] **T013** Xây dựng luồng Phone-First Hold & Checkout trên `/dat-phong/[token]` (`src/app/dat-phong/[token]/page.tsx`):
  - `PhoneHoldModal.tsx` (nhập SĐT trước khi tạo hold, cảnh báo `409 ANOTHER_SESSION_LIVE` + 1-click `"Đổi sang phòng ..."`)
  - `CheckoutPage.tsx` (3 bước, đồng hồ đếm ngược đồng bộ `serverNow`, form thông tin + CDP tier + chọn voucher ví + mã KM, VietQR động từ `properties.bank_*`, popup giữ lại khi bấm Huỷ/Back, màn hình Chờ / Thành công / Thiếu tiền / Hết hạn).
- [x] **T014** Xây dựng trang `/checkin` (`src/app/checkin/page.tsx`, `src/components/checkin/CheckinPage.tsx`) xác thực >= 2 khóa, 4 khối nội dung đúng thứ tự, copy 1 chạm, lightbox phóng ảnh, và ẩn mã (`••••` + `pendingNote`) ngoài cửa sổ `[checkinAt - codesVisibleHoursBefore, checkoutAt + 2h]`.

---

## Phase 7: Unified Admin Session Wizard & OTA Calendar Extranet (`LSB-5`, `LSB-6`)

- [x] **T015** Nâng cấp `everyinn-admin` dùng chung Session Engine (`LSB-5`):
  - Routes `/api/sessions/*` gọi `AGENT_CORE` `AdminApi`, `BookingWizard.tsx` + `SessionPaymentPanel.tsx` (VietQR, link `/dat-phong/<token>`, nhận tiền mặt/thẻ/CK, cọc/thiếu/bù, timeline audit), `GanttHoldBar.tsx` + `HoldSessionDrawer.tsx`, Booking Core trả `409 SESSION_MANAGED` cho hold do session quản lý.
- [x] **T016** Xây dựng OTA Calendar Extranet (`LSB-6`):
  - Migration `everyinn-booking-core/migrations/0011_calendar_rates.sql` (`rate_overrides`, `room_blocks.block_type`).
  - Hooks ghi đè giá trong `pricing.ts` (`rate_overrides` phòng → hạng → `rate_rules`) và handlers `calendar.ts` (`GET /calendar/matrix`, `GET|PUT /rate-overrides`, `POST /rate-overrides/clear`, `POST /room-blocks/bulk`).
  - Giao diện Admin `/calendar` (`everyinn-admin/src/app/calendar/page.tsx`) với `RateOverrideDrawer.tsx`, `StopSellModal.tsx`, `BookingWindowCard.tsx` (`PUT /configs/booking_rules`).

---

## Phase 8: QA Audit Fixes, Spec Sync & Verification (2026-11-09 → 2026-11-10)

- [x] **T017** **Fix `STACKING-CAP` (Q5)**: Sửa `loyaltyCap` trong `everyinn-booking-core/src/domain/pricing.ts` (`min(remainingBase, priceBeforeLoyalty)`) để promotion + voucher không trừ lấn vào phụ thu; thêm regression test trong `test/domain.spec.ts`.
- [x] **T018** **Fix `HOURLY-1H` (Q1)**: Chốt bước giờ nhận phòng theo giờ = **1 giờ chẵn (`:00`)** ở `shared/booking-kit/stay.ts` (`hourlyStarts`), `every-inn-booking/src/lib/server/criteria.ts`, `everyinn-booking-core/src/domain/stayRules.ts` (`HOURLY_CHECKIN_STEP_INVALID`) và đồng bộ `booking-kit`.
- [x] **T019** **Fix `PHONE-FIRST-HOLD` (Q4)**: Triển khai `PhoneHoldModal.tsx`, kiểm tra `phone_hash` tối đa 1 phiên sống/SĐT, `409 ANOTHER_SESSION_LIVE` + `forceSwitch: true` tại `everyinn-agent-core` và BFF, kèm unit tests (`guestBooking.test.mjs`, `perfectCases.test.mjs`, `sessions.spec.ts`).
- [x] **T020** **Làm rõ `addBusinessDays` (Q2)**: Bổ sung docstring xác nhận hàm tính **ngày dương lịch VN (`Asia/Ho_Chi_Minh`)** tại `everyinn-booking-core/src/domain/time.ts`.
- [x] **T021** **Kiểm thử tự động trên toàn hệ thống**:
  - `every-inn-booking`: `test/guestBooking.test.mjs`, `test/perfectCases.test.mjs`, `test/contract.test.mjs`.
  - `everyinn-booking-core`: `test/lsb.spec.ts`, `test/calendar.spec.ts`, `test/domain.spec.ts`, `test/bookings.spec.ts`, `test/callers.spec.ts`.
  - `everyinn-cdp-core`: `test/vouchers.spec.ts`.
  - `everyinn-agent-core`: `test/sessions.spec.ts`, `test/contract.spec.ts`, `test/masterdata.spec.ts`.
  - `everyinn-admin`: `test/calendar.test.mjs`, `test/sessions.test.mjs`, `test/contract.test.mjs`.
  - E2E UAT live: `everyinn-platform-docs/scripts/uat-lsb-smoke.mjs` (16/16 bước xanh trên dev).
- [x] **T022** **Chuẩn hóa Spec Suite & Source of Truth (2026-11-10)**: Cập nhật đồng bộ 100% `source-of-truth.md`, `spec.md`, `contracts/guest-booking-api.md`, `data-model.md`, `plan.md`, `tasks.md`, `everyinn-platform-docs/EI_LANDING_SELF_BOOKING_SPEC.md` và `CONVENTIONS.md`.

---

## Hạng mục Còn mở (Chờ Owner quyết định / Cấu hình Go-Live Production)

- [ ] **T023** **[`LSB-7` — Owner Media Check-in]**: Owner cung cấp URL thật cho ảnh Check-in, ảnh Check-out (`checkinImageUrl`, `checkoutImageUrl`) và video đường đi đầu hẻm `71/31` (`videoUrl`, `posterUrl`) để cập nhật vào master data `checkin_guide`.
- [ ] **T024** **[Cửa sổ hiển thị mã phòng `codesVisibleHoursBefore`]**: Owner xác nhận giữ mức seed hiện tại **`6` tiếng** (`defaults.ts` / `policy.ts`) hay chỉnh xuống **`2` tiếng** trong master data `checkin_guide`.
- [ ] **T025** **[Webhook Ngân hàng Tự động (`autoConfirmExactMatch`)]**: Chọn nhà cung cấp (`SePay` / `Casso` / `PayOS`), nạp secret (`SEPAY_WEBHOOK_KEY` / `CASSO_WEBHOOK_TOKEN` / `PAYOS_CHECKSUM_KEY`) lên `everyinn-agent-core`, chạy Shadow Mode trước khi bật `payment_policy.autoConfirmExactMatch = true`.
- [ ] **T026** **[Loyalty Template Promotions (`D-02`)]**: Tạo 3 promotion mẫu (`50k`/`100k`/`150k`) trên Booking Core Prod gắn `voucherPromotionId` trong CDP rule set.
- [ ] **T027** **[Go-Live Production (`LSB-9`)]**: Theo đúng thứ tự trong [EI_PROD_RELEASE_CHECKLIST.md](file:///Users/lap14666/Documents/private/every%20inn/van%20hanh/booking-page/everyinn-platform-docs/EI_PROD_RELEASE_CHECKLIST.md) — tạo `agent-db-prod` & secrets, chạy migrations prod (`0004`, `0010`, `0011`, `0021`), deploy theo thứ tự `cdp-core` → `booking-core` → `agent-core` → `admin` → `every-inn-booking` (khi Owner duyệt mới bật `WEB_BOOKING_ENABLED = "true"`).
- [ ] **T028** **[Chính sách Voucher & Cleanup Kỹ thuật — Optional]**: (a) Xác nhận quy tắc hoàn voucher khi khách `cancelled` và không hoàn khi `no_show`; (b) Quyết định có đổi tên `addBusinessDays` → `addCalendarDays` ở đợt dọn code sau; (c) **`LSB-10`**: Chuyển kênh Chat AI dùng Session Engine.
