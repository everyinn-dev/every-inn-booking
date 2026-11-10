# Source of Truth — Guest Self-Booking (đối chiếu code, 2026-11-09)

> Khi có bất kỳ điểm khác biệt nào giữa các tài liệu, **tài liệu này cùng mã nguồn đang chạy là chuẩn cao nhất**.
> Được lập từ code (kèm đường dẫn kiểm chứng) và các quyết định đã chốt của Owner. Các mục `[x]` đánh dấu đã xử lý & kiểm chứng bằng test tự động.
> **Cập nhật 2026-11-10**: Toàn bộ bộ tài liệu `spec.md`, `contracts/guest-booking-api.md`, `data-model.md`, `plan.md`, `tasks.md`, `everyinn-platform-docs/EI_LANDING_SELF_BOOKING_SPEC.md` và `everyinn-platform-docs/CONVENTIONS.md` đã được viết lại hoàn toàn theo nguồn sự thật này và mã nguồn thực tế trên nhánh `feat/landing-self-booking`.

---

## Q1. Bước giờ nhận phòng theo giờ — owner chốt: **1 giờ**

- Khung nhận: `08:00`–`21:00` (`min_hourly_checkin`/`max_hourly_checkin`, `everyinn-booking-core/src/repo/master.ts`), thời lượng tối thiểu **3 giờ** (`min_hourly = 3`, UI cho phép chọn `3..12` giờ tại `every-inn-booking/src/lib/server/criteria.ts`).
- [x] **ĐÃ XỬ LÝ (2026-11-09)**:
  - `hourlyStarts()` (`everyinn-platform-docs/shared/booking-kit/stay.ts`) dùng bước nhảy **60 phút (`+ 60 * 60_000`)**.
  - BFF `criteria.ts` kiểm tra định dạng `:00` (`HOURLY_CHECKIN_STEP_INVALID` / `400 VALIDATION_FAILED`).
  - Core `bookingWindowViolation()` (`everyinn-booking-core/src/domain/stayRules.ts`) kiểm tra `Math.round(h) % 60 === 0`, trả về `422 HOURLY_CHECKIN_STEP_INVALID`.
- Có `422 LEAD_TIME_TOO_SHORT` (`min_lead_minutes`, mặc định `30` phút) cho đặt theo giờ sát giờ.

---

## Q2. Cửa sổ đặt trước — **ngày dương lịch**, không phải ngày làm việc

- `addBusinessDays(date, n)` (`everyinn-booking-core/src/domain/time.ts`) thực chất cộng `n × 24h` theo giờ Việt Nam (`Asia/Ho_Chi_Minh`). Tên hàm được giữ nguyên để tương thích import trên các repo; hành vi là **calendar day**.
- `maxAdvanceDate(rules, nowMs) = addBusinessDays(todayVn, max_advance_days)` (`everyinn-booking-core/src/domain/stayRules.ts`). So sánh **bao gồm**: chỉ khi `nightDate > maxDate` mới vượt cửa sổ; tự trượt lúc `00:00` giờ VN vì tính theo `Date.now()` mỗi request.
- `nightDate` của ca `24h-12h` (check-in `00:00` rạng sáng hôm sau) là **đêm D**, không phải `D+1` (`overnightNightDate`). Theo giờ / theo ngày dùng ngày check-in.
- Áp dụng **chặn `422 ADVANCE_BOOKING_EXCEEDED`** cho `landing-bff` và `agent-core`; `admin` chỉ nhận `warnings[]` (D11).
- Cấu hình lưu ở bảng `booking_configs` với key **`booking_rules`** (`max_advance_days`: số nguyên `1..730`, mặc định `90`), cập nhật qua `PUT /internal/v1/configs/booking_rules` (yêu cầu `expectedVersion >= 1` và `{ value: { max_advance_days } }`).
- Ví dụ chuẩn: hôm nay `2026-11-08`, `90` ngày → `maxAllowedDate = 2027-02-06`.
- Error `details`: `{ maxAdvanceDays, maxAllowedDate, requestedDate }`.

---

## Q3. Route, URL, callback, polling, ID

| Hạng mục | Thực tế đang chạy (chuẩn) |
|---|---|
| Mô hình đơn tạm | **Phiên đặt phòng** (`AGENT_DB.booking_sessions`), URL capability `/dat-phong/<token>`, token 32 byte base64url (`TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/`), DB chỉ lưu SHA-256 `token_hash` (`everyinn-agent-core/src/sessions/repo.ts`) |
| Landing BFF (`/api/guest/*`) | 9 route files / 11 HTTP operations: `GET /api/guest/storefront`, `POST /api/guest/availability`, `GET /api/guest/pulse`, `POST /api/guest/sessions`, `GET \| PATCH \| DELETE /api/guest/sessions/[token]`, `GET /api/guest/sessions/[token]/live`, `POST /api/guest/sessions/[token]/preview`, `POST /api/guest/sessions/[token]/paid`, `POST /api/guest/checkin/lookup` |
| Service Bindings của Landing | `BOOKING_CORE` (chỉ route đọc `LANDING_READ`), `CDP_CORE`, `AGENT_CORE` (entrypoint **`LandingApi`**, actor web `900002 / receptionist / Khách web`) |
| Webhook ngân hàng | `POST /webhooks/payments/:provider` (`sepay \| casso \| payos`) đặt trên **`everyinn-agent-core`** (public worker), trả `404` nếu chưa cấu hình secret (`SEPAY_WEBHOOK_KEY`, `CASSO_WEBHOOK_TOKEN`, `PAYOS_CHECKSUM_KEY`), lọc PII vào `payment_webhook_inbox` |
| Callback Telegram | Thẻ trạng thái chỉnh tại chỗ: `ss:<sid>:ok \| no \| amt \| rv \| rv! \| keep \| short \| topup \| restore`; tiền chưa khớp `sm:<inbox>:<sid>` (`everyinn-agent-core/src/sessions/telegram.ts`). Không bao giờ in plaintext mã cửa lên Telegram (D9) |
| Realtime | **Long-poll 25 giây** qua Durable Objects: `BookingSessionLive` (`/api/guest/sessions/[token]/live?v=&timeout=25000`) và `InventoryPulse` (`/api/guest/pulse?v=`); client `useLongPoll` tự lùi về exponential backoff **4s → 30s** khi lỗi và dừng khi tab ẩn (`shared/booking-kit/live.ts`) |
| ETag | `GET /api/guest/storefront` và `GET /api/guest/sessions/[token]` trả `ETag` / hỗ trợ `If-None-Match` → `304` |
| ID phòng & diện tích | `haven-101`, `haven-201`, `haven-301` (`sig-102`, `sig-202`, `sig-302`). Thẻ phòng hiển thị `Phòng {roomNumber}`. Diện tích Landing hiển thị `16 m²` / `24 m²` (`src/data/rooms.ts`, `devMock.ts`), DB master seed `0002` ghi `22` / `28` |
| Ngân hàng thanh toán | Đọc động từ `BOOKING_DB.properties.bank_*` qua `GET /storefront` & `PATCH /sessions`; BFF/UI không hard-code STK |
| 10 trạng thái phiên (`sessions/machine.ts`) | `holding` → `awaiting_payment` → `payment_claimed` → `confirming` → `confirmed`; các nhánh `underpaid`, `expired`, `cancelled`, `late_payment`, `conflict`. Nhóm `LIVE`: `holding`, `awaiting_payment`, `payment_claimed`, `underpaid` |
| Tạo giữ phòng & Phone-First | `POST /api/guest/sessions` gọi `AGENT_CORE` (`createHold` kèm `channel = 'web'`, `sessionId`); double-click cùng `clientNonce` trả lại phiên cũ (`replayed: true`) |
| Admin Unified Engine (D16) | `everyinn-admin` dùng chung `booking_sessions` qua `AGENT_CORE` (`AdminApi`); mọi thao tác trực tiếp vào hold có `session_id` tại `booking-core` bị chặn `409 SESSION_MANAGED` |

---

## Q4. Rate limit, Hold TTL & Cửa sổ mở mã check-in

### Rate limiting 2 lớp

| Endpoint | Lớp 1: Workers Rate Limiting (`wrangler.jsonc`) | Lớp 2: D1 (`AGENT_DB`) | Mã lỗi |
|---|---|---|---|
| `storefront`, `availability`, `sessions/[token]/preview` | `SEARCH_RL` **30 / 60s / IP** (dùng chung 1 bộ đếm) | — | `429 RATE_LIMIT_EXCEEDED` (`retryAfterSeconds: 60`) |
| `POST /api/guest/sessions` (tạo giữ phòng) | `HOLD_RL` **3 / 60s / IP** | Tối đa **`maxLiveHoldsPerIp = 2`** phiên đang sống / IP (`web`); admin `10` (`masterdata/defaults.ts`). **Và tối đa 1 phiên sống / `phone_hash`** | `429 RATE_LIMIT_EXCEEDED` / `429 TOO_MANY_HOLDS` / `409 ANOTHER_SESSION_LIVE` |
| `POST /api/guest/sessions/[token]/paid` | `PAID_RL` **5 / 60s**, key theo `paid:${token.slice(0,16)}` | — | `429 RATE_LIMIT_EXCEEDED` |
| `POST /api/guest/checkin/lookup` | `LOOKUP_RL` **5 / 60s / IP** (mọi lần gọi) | **5 lần thử sai / 15 phút / IP** (`ckfail:<ipHash>` trong `rate_counters`) | `429 RATE_LIMIT_EXCEEDED` (`retryAfterSeconds: 900` ở lớp D1) |

- **Luồng giữ phòng bằng SĐT (Phone-First Hold & 1-Click Switch, 2026-11-09)**:
  - Khách bấm `"Chọn phòng này"` mở sheet `PhoneHoldModal.tsx` nhập SĐT Việt Nam (lưu `localStorage.ei_guest_phone`) trước khi tạo session.
  - Hệ thống kiểm tra `phone_hash`: mỗi SĐT tối đa **1 phiên sống**. Nếu SĐT đang giữ phòng khác, API trả `409 ANOTHER_SESSION_LIVE` kèm `{ liveSessions, existingSessionId, existingRoomLabel, expiresAt, remainingSeconds }`; UI hiện nút **`Đổi sang phòng này`** (`forceSwitch: true`) để huỷ phiên cũ và giữ phòng mới ngay.
- **Tra cứu `/checkin` (`checkin/lookup`)**:
  - Chỉ lần sai mới tăng `ckfail:<ipHash>` (`hitCounter`); nếu đã chạm ngưỡng 5 sai/15p thì chặn ngay trước khi truy vấn Core (`peekCounter`).
  - Sai thông tin → `404 GUEST_LOOKUP_NO_MATCH` kèm `details.attemptsLeft`; thiếu khoá 2 → `400 SECOND_KEY_REQUIRED`; lỗi Core → `503 LOOKUP_UNAVAILABLE`.
  - Hỗ trợ mọi đơn `confirmed` trên tất cả kênh (`web`, `admin`, `chat`) — D13.
- **Cửa sổ hiển thị mã cửa (`checkinAccess.ts`)**:
  - Mã cổng & mã hộp khóa (`gateCode`, `lockboxCode`) **chỉ hiển thị (`visible: true`)** khi đơn `confirmed` VÀ `now ∈ [checkinAt - codesVisibleHoursBefore * 1h, checkoutAt + 2h]`.
  - `codesVisibleHoursBefore` được đọc từ master data `checkin_guide`: trong `CHECKIN_GUIDE_SEEDS` (`everyinn-agent-core/src/masterdata/defaults.ts`) và fallback (`everyinn-agent-core/src/sessions/policy.ts`) hiện đang đặt mặc định **`6` tiếng** (cũng có thể chỉnh qua Admin master data). Ngoài cửa sổ, API trả `visible: false`, giá trị ẩn `••••` trong `step1MainText`, `gateCode: null`, `lockboxCode: null` và điền `pendingNote`.
- **TTL giữ phòng & gia hạn**:
  - Web **`10` phút** (`holdMinutes = 10`), Admin **`15` phút** (policy kẹp `3..30`).
  - Khi khách bấm `"Tôi đã chuyển khoản"` (`CLAIM_PAID`), hạn hold tự gia hạn thêm `claimGraceMinutes = 30` phút, tối đa không vượt quá `checkinAt` (chặn tổng gia hạn hold ≤ `+12h`).

---

## Q5. Stacking giảm giá & Ví Voucher CDP

### Chọn ưu đãi
1. Mỗi đơn **tối đa 1 promotion** (không cộng public + private).
2. Có `promotionCode` / `promotionId` → kiểm tra đúng mã đó; nếu không đủ điều kiện trên `SAVE_GUEST` trả **`422 PROMOTION_NOT_APPLICABLE`** (tại `preview` trả `eligible: false, discount: 0`). **Không tự rơi về public**.
3. Không có mã → khi `applyPublicPromotions: true`, chọn **public promotion tốt nhất** (`bestPublicPromotion`). Ưu đãi hạng thẻ xét khi có SĐT.
4. Kênh `web` / `admin`: thưởng tích tem không trừ thẳng vào đơn đạt mốc mà phát **voucher vào ví `CDP_DB.customer_vouchers`** (D7). Phiên tự động chọn voucher khả dụng **giá trị cao nhất** trừ khi truyền `voucherId` / `voucherCode` hoặc `noVoucher: true`. Dùng voucher bắt buộc có SĐT (`VOUCHER_NEEDS_PHONE`).

### Công thức (`stackDiscounts`, `everyinn-booking-core/src/domain/pricing.ts`)
```text
capBase       = min(basePrice, subtotal)
promo         = min(max(0, promoDiscount), capBase)
remainingBase = max(0, capBase - promo)
loyalty       = min(max(0, voucher), min(remainingBase, max(0, subtotal - promo)))
total         = max(0, subtotal - promo - loyalty)
```
- [x] **ĐÃ XỬ LÝ (2026-11-09)**: `loyaltyCap` được chặn chặt bởi `remainingBase`, đảm bảo promotion + voucher không bao giờ trừ lấn vào phụ thu (giờ thêm, khách thêm, ngày lễ). Đã có regression test trong `everyinn-booking-core/test/domain.spec.ts`.

### Vòng đời voucher (`everyinn-cdp-core/src/handlers/vouchers.ts`, `everyinn-booking-core/src/handlers/holds.ts`)

| Sự kiện | Hành vi |
|---|---|
| Khách `PATCH` phiên áp dụng voucher | **Lease** theo hold (`POST /internal/v1/vouchers/reserve`), hạn lease = hạn hold + tối đa `12h` |
| Đổi sang voucher khác / chọn `noVoucher` | `releaseVoucher({ holdId })` giải phóng voucher cũ, lease cái mới |
| Khách huỷ / `forceSwitch` / staff cancel (`releaseHold`) | `releaseVoucher({ holdId })` (best effort) trả về `issued` |
| Hold hết hạn tự nhiên | Lease tự hết hiệu lực khi `reserved_until <= now` |
| Xác nhận đơn (`accrual`) | `redeemVoucherStmt` chuyển sang `redeemed` |
| Đơn `cancelled` sau khi đã chốt | `restoreVoucherStmt` trả voucher về `issued` nếu `expires_at > now` |
| Đơn `no_show` | Voucher **giữ trạng thái `redeemed`**, không hoàn |
| Hạn sử dụng voucher | Mặc định `90` ngày (`voucherValidDays`, `VOUCHER_DEFAULT_VALID_DAYS`) |

Mốc thưởng tem: `3` → `50.000đ`, `8` → `100.000đ`, `10` → `150.000đ` (cấu hình trong CDP rules + template promotion Admin).

---

## Trạng thái xử lý & Chuẩn hoá

1. [x] **Sửa `loyaltyCap` trong `stackDiscounts` (Q5)**: Đã fix trong `everyinn-booking-core/src/domain/pricing.ts` và thêm test regression.
2. [x] **Chốt bước giờ nhận phòng theo giờ = 1 giờ `:00` (Q1)**: Đã cập nhật `shared/booking-kit/stay.ts`, BFF `criteria.ts`, Core `stayRules.ts` (`HOURLY_CHECKIN_STEP_INVALID`) và đồng bộ `booking-kit`.
3. [x] **Phone-First Hold & 1-Click Switch (Q4)**: Đã triển khai `PhoneHoldModal.tsx`, `phone_hash` check, `409 ANOTHER_SESSION_LIVE` + `forceSwitch: true` ở Landing, Agent Core và tests.
4. [x] **Giải thích `addBusinessDays` (Q2)**: Đã bổ sung docstring rõ hành vi calendar days tại `everyinn-booking-core/src/domain/time.ts`.
5. [x] **Chuẩn hoá toàn bộ Spec Suite (2026-11-10)**: Đã rewrite toàn bộ `spec.md`, `contracts/guest-booking-api.md`, `data-model.md`, `plan.md`, `tasks.md`, `EI_LANDING_SELF_BOOKING_SPEC.md` và `CONVENTIONS.md` khớp 100% với code thực tế.

---

## TODO List: Cần Owner quyết / cấu hình trước hoặc sau Go-Live

1. [x] **Rewrite Contract API & bộ Spec theo Session Engine**: **ĐÃ HOÀN TẤT (2026-11-10)** — Toàn bộ 6 tài liệu trong `specs/001-guest-self-booking/` + `EI_LANDING_SELF_BOOKING_SPEC.md` đã đồng bộ 100%.
2. [ ] **Kế hoạch bật Webhook Ngân hàng tự động đối soát (`autoConfirmExactMatch`)**:
   - Hiện tại: `payment_policy.autoConfirmExactMatch = false`, quản lý bấm duyệt trên Telegram card.
   - Cần quyết: Chọn nhà cung cấp (`SePay` / `Casso` / `PayOS`), đặt secret trên `everyinn-agent-core`, và chốt thời gian chạy Shadow Mode (đề xuất 1 tuần) trước khi bật tự động xác nhận.
3. [ ] **Đổi tên hàm `addBusinessDays` → `addCalendarDays`**:
   - Hiện tại: Đã có docstring làm rõ hành vi calendar days, giữ tên cũ để bảo toàn tương thích.
   - Cần quyết: Có refactor đổi tên hàm trên toàn bộ repo trong đợt dọn kỹ thuật tiếp theo hay giữ nguyên?
4. [ ] **Quy định hoàn voucher khi khách huỷ / no-show**:
   - Hiện tại: Đơn `cancelled` tự động trả voucher còn hạn về `issued` (`restoreVoucherStmt`); đơn `no_show` không hoàn voucher.
   - Cần quyết: Xác nhận chính sách này đúng với quy định vận hành khách sạn.
5. [ ] **Cửa sổ hiển thị mã phòng (`codesVisibleHoursBefore`)**:
   - Hiện tại: Mã cửa chỉ hiển thị trong `[checkinAt - codesVisibleHoursBefore, checkoutAt + 2h]` khi đơn `confirmed`; cấu hình seed trong code (`everyinn-agent-core/src/masterdata/defaults.ts` + `src/sessions/policy.ts`) đang là **`6` tiếng** (sửa trực tiếp được ở Admin → Cấu hình / Master data `checkin_guide`).
   - Cần quyết: Owner chốt giữ **6 tiếng** hay đặt thành **2 tiếng** trước giờ check-in cho đồng bộ với tin nhắn nhắc?
6. [ ] **Media Check-in (`LSB-7`) & Loyalty Template Promotions (`D-02`)**:
   - Cung cấp URL thật cho `step2Images` (ảnh check-in / check-out) và `step4Video` (video đầu hẻm `71/31`) trong `checkin_guide`; tạo 3 promotion mẫu (`50k`/`100k`/`150k`) gắn `voucherPromotionId` trên Prod trước khi bật cờ `WEB_BOOKING_ENABLED = "true"`.
