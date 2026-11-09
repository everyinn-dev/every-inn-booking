# Source of Truth — Guest Self-Booking (đối chiếu code, 2026-11-09)

> Khi `spec.md`, `contracts/guest-booking-api.md` và `EI_LANDING_SELF_BOOKING_SPEC.md` mâu thuẫn với nhau, **file này thắng**.
> Nó được lập từ code (đường dẫn kèm theo) và quyết định của owner. Các mục đánh dấu ⚠️ là chỗ code chưa khớp quyết định hoặc nghi lỗi, cần xử lý.
> Phạm vi rà: `everyinn-booking-core`, `everyinn-agent-core` (sessions), `everyinn-cdp-core`, `every-inn-booking` (BFF + booking-kit). Chưa chạy test để xác nhận hành vi.

## Q1. Bước giờ nhận phòng theo giờ — owner chốt: **1 giờ**

- Khung nhận: `08:00`–`21:00` (`min_hourly_checkin`/`max_hourly_checkin`, `repo/master.ts`), tối thiểu 3 giờ (`min_hourly = 3`).
- [x] **ĐÃ XỬ LÝ (2026-11-09)**: UI `hourlyStarts()` đã chuyển bước nhảy sang 60 phút (`+ 60 * 60_000`). Core `bookingWindowViolation` (`stayRules.ts`) đã thêm kiểm tra `Math.round(h) % 60 === 0`, trả về 422 `HOURLY_CHECKIN_STEP_INVALID`. BFF regex đã giới hạn `:00`. Test tự động đã bao phủ cả UI, BFF và Core.
- Có `LEAD_TIME_TOO_SHORT` (`min_lead_minutes`, mặc định 30′) cho đặt theo giờ.

## Q2. Cửa sổ đặt trước — **ngày dương lịch**, không phải ngày làm việc

- `addBusinessDays(date, n)` (`domain/time.ts:53`) thực chất cộng `n × 24h` theo giờ VN. Tên hàm gây hiểu nhầm, hành vi là **calendar day**.
- `maxAdvanceDate = today(VN) + max_advance_days` (`stayRules.ts:257`). So sánh **bao gồm**: `nightDate > maxDate` mới lỗi. Tự trượt lúc 00:00 giờ VN vì tính theo `Date.now()` mỗi request.
- `nightDate` của ca `24h-12h` (check-in 00:00 hôm sau) là **đêm D**, không phải D+1 (`overnightNightDate`). Theo giờ / theo ngày dùng ngày check-in.
- Áp cho `landing-bff` và `agent-core` (422 `ADVANCE_BOOKING_EXCEEDED`); admin chỉ cảnh báo (D11).
- Cấu hình: `booking_rules.max_advance_days`, số nguyên 1–730, mặc định 90 (`handlers/catalog.ts:143`). Lưu ở `PUT /configs/booking_rules`, **không phải** `booking_configs.advance_booking_window` như spec.
- Ví dụ đúng: hôm nay `2026-11-08`, 90 ngày → `maxAllowedDate = 2027-02-06`. Ví dụ lỗi trong contract (`đến hết ngày 2026-11-20`) là sai.
- Error `details`: `{ maxAdvanceDays, maxAllowedDate, requestedDate }` (đã khớp contract).

## Q3. Route, URL, callback, polling, ID

| Hạng mục | Spec cũ | **Thực tế (chuẩn)** |
|---|---|---|
| Đơn của khách | `holdId` + `/book/[holdId]` | **Phiên** (`booking_sessions`), URL `/dat-phong/<token>`, token 32 byte base64url, DB chỉ lưu hash (`sessions/repo.ts:61`) |
| Landing BFF | `/api/guest/availability/search`, `/holds`, `/holds/[id]`, `/holds/[id]/notify-paid`, `/promotions/preview` | `GET /api/guest/storefront`, `POST /api/guest/availability`, `POST /api/guest/sessions` (tạo giữ phòng), `GET|PATCH|DELETE /api/guest/sessions/[token]` (xem / lưu thông tin / huỷ), `GET …/[token]/live`, `POST …/[token]/preview`, `POST …/[token]/paid`, `GET /api/guest/pulse`, `POST /api/guest/checkin/lookup` |
| Webhook ngân hàng | `POST /api/webhooks/banking` trên landing | `POST /webhooks/payments/:provider` trên **agent-core** (`sepay`/`casso`/`payos`), 404 nếu chưa đặt secret, lưu `payment_webhook_inbox` (dedupe theo txn id) |
| Callback Telegram | `lpcf:`/`lprj:` | `ss:<sid>:ok\|no\|amt\|rv\|rv!\|keep\|short\|topup\|restore`; tiền chưa khớp `sm:<inbox>:<sid>` (`sessions/telegram.ts`) |
| Realtime | short-poll 3–4 giây | **Long-poll 25 giây** qua DO (`/live?v=<version>&timeout=25000`); client fallback short-poll **4s, tăng gấp đôi tới 30s**, dừng khi tab ẩn (`booking-kit/live.ts`); trang tìm phòng dùng `/pulse` |
| ETag | `GET holds/[id]` | `GET sessions/[token]` trả `ETag` theo version phiên |
| ID phòng | `hav-101`, `"202"` | `haven-101/201/301`, `sig-102/202/302`. Hiển thị bằng `roomNumber` |
| Trạng thái | `active`, `awaiting_payment`, `confirmed` (hold) | Phiên: `holding → awaiting_payment → payment_claimed → confirming → confirmed`; nhánh `underpaid`, `expired`, `cancelled`, `late_payment`, `conflict` (`sessions/machine.ts`) |
| Tạo giữ phòng | Spec: đủ thông tin ở `POST /holds` | `POST /api/guest/sessions` gọi core `createHold` có `channel='web'` + `sessionId`; double-click trả lại cùng phiên (`replayed`) |

Test phải bám cột “Thực tế”. Các endpoint ở cột spec cũ **không tồn tại** trên landing.

## Q4. Rate limit — nhiều lớp, không giống spec

| Endpoint | Lớp 1: Workers Rate Limiting (theo IP, 60s) | Lớp 2: D1 | Mã lỗi |
|---|---|---|---|
| `availability`, `storefront`, `sessions/[token]/preview` | `SEARCH_RL` **30/60s** (dùng chung 1 bộ đếm) | — | 429 `RATE_LIMIT_EXCEEDED`, `retryAfterSeconds: 60` |
| `POST sessions` (giữ phòng) | `HOLD_RL` **3/60s** | Tối đa **`maxLiveHoldsPerIp` = 2** phiên đang sống / IP (web); admin 10 (`masterdata/defaults.ts`) | 429 `RATE_LIMIT_EXCEEDED` / 429 `TOO_MANY_HOLDS` |
| `POST sessions/[token]/paid` | `PAID_RL` **5/60s**, key theo **token** (16 ký tự đầu) | — | 429 |
| `POST checkin/lookup` | `LOOKUP_RL` **5/60s / IP** (mọi lần thử) | **5 lần thử sai / 15 phút / IP** (`ckfail:<hash IP>`, `hitCounter`/`peekCounter`) | 429 `RATE_LIMIT_EXCEEDED` (`retryAfterSeconds: 900` ở lớp D1) |

- **Spec “5 hold/10 phút/IP” không còn đúng**: thực tế 3/phút và tối đa 2 phiên sống cùng lúc.
- Lookup: chỉ thất bại mới tăng bộ đếm D1; đã chặn thì kiểm tra trước khi tra cứu. Sai → `404 GUEST_LOOKUP_NO_MATCH` kèm `attemptsLeft`; thiếu khoá 2 → `400 SECOND_KEY_REQUIRED`; lỗi core → `503 LOOKUP_UNAVAILABLE`.
- Bộ đếm D1 là cửa sổ trượt theo `windowSec`. Binding Workers là cửa sổ cố định 60s. Chưa kiểm chứng chi tiết reset.
- Khoá IP lấy từ `clientIp(req)` ở BFF, chuyển sang agent-core qua `x-ei-client-ip` và băm trước khi lưu. Cần test giả mạo header (R-03).
- Mã khoá chỉ hiện trong cửa sổ: từ `check-in − codesVisibleHoursBefore` đến `check-out + 2h` và chỉ khi `confirmed`. Ngoài cửa sổ: trả `pendingNote`, giá trị ẩn `••••`. Khác spec (“hiện ngay khi đã xác nhận”).
- TTL giữ phòng: web **10′**, admin **15′** (`holdMinutes`, giới hạn 3–30). Khi khách báo đã CK: gia hạn tới `min(now + 30′, giờ check-in)` (`claimGraceMinutes`). Hold gia hạn tối đa +12h.

## Q5. Stacking giảm giá, voucher

### Chọn ưu đãi
1. Mỗi đơn **tối đa 1 promotion** (không cộng public + private).
2. Có `promotionCode`/`promotionId` → dùng promotion đó; nếu không đủ điều kiện thì không có promo. **Không tự thay bằng public**.
3. Không có mã → khi cờ `applyPublicPromotions` bật, lấy **public promotion tốt nhất** (`bestPublicPromotion`). Tier thẻ chỉ xét khi có SĐT.
4. Kênh `web`/`admin`: thưởng tích tem **không trừ thẳng**; nó thành **voucher trong ví** dùng cho lần sau (D7). Voucher tự chọn cái **giá trị cao nhất** trừ khi có `voucherId`/`voucherCode` hoặc `noVoucher`. Cần SĐT (`VOUCHER_NEEDS_PHONE`).

### Công thức (`stackDiscounts`, `domain/pricing.ts:570`)
```
promo   = min(max(0, promoDiscount), min(basePrice, subtotal))
loyalty = min(max(0, voucher), min(basePrice, subtotal − promo))
total   = max(0, subtotal − promo − loyalty)
```
Mức giảm từ promo tính trên giá cơ bản; phụ thu (giờ thêm, khách thêm, lễ) nằm trong `subtotal`.

- [x] **ĐÃ XỬ LÝ (2026-11-09)**: Đã sửa công thức trong `stackDiscounts` (`domain/pricing.ts`):
  `remainingBase = basePrice !== undefined ? Math.max(0, capBase - promo) : priceBeforeLoyalty;`
  `loyaltyCap = Math.min(remainingBase, priceBeforeLoyalty);`
  Đảm bảo voucher không bao giờ trừ lấn vào phụ thu khi áp cùng promotion lớn. Đã bổ sung regression test trong `test/domain.spec.ts`.

### Vòng đời voucher (`cdp-core/handlers/vouchers.ts`, `booking-core/handlers/holds.ts`)
| Sự kiện | Hành vi |
|---|---|
| Khách PATCH phiên có voucher | **Lease** theo hold (`reserveVoucher`), hạn lease = hạn hold + tối đa 12h |
| Đổi sang voucher khác | `releaseVoucher({holdId})` voucher cũ, lease cái mới |
| Khách huỷ / “Thoát & chọn lại” (`releaseHold`) | `releaseVoucher` (best effort) |
| Hold hết hạn | Lease tự hết theo `reserved_until` (không có bước release chủ động) |
| Xác nhận đơn | `redeemVoucherStmt` khi ghi nhận tích điểm (`accrual`) |
| Đơn **cancelled** sau đó | `restoreVoucherStmt` trả voucher về `issued` (nếu còn hạn) |
| **No-show** | Voucher **giữ trạng thái đã dùng**, không trả lại |
| Hết hạn voucher | Mặc định 90 ngày (`VOUCHER_DEFAULT_VALID_DAYS`, `voucherValidDays`) |

Mốc thưởng tem: 3 → 50k, 8 → 100k, 10 → 150k (cấu hình trong CDP rules, không hard-code ở landing).

## Trạng thái xử lý lỗi & Chuẩn hoá (2026-11-09)

1. [x] **Sửa/chốt `loyaltyCap` (Q5)**: Đã sửa trong `everyinn-booking-core/src/domain/pricing.ts`, chặn không cho voucher trừ vào phụ thu. 122/122 test passed.
2. [x] **Hourly 1 giờ (Q1)**: Đã sửa `hourlyStarts` (+60min) trong booking-kit, BFF regex `:00`, Core validation `HOURLY_CHECKIN_STEP_INVALID`. Test guestBooking & lsb.spec passed.
3. [x] **Đối chiếu tài liệu**: Đã cắm banner tham chiếu `source-of-truth.md` ở đầu `spec.md`, `contracts/guest-booking-api.md`, và `EI_LANDING_SELF_BOOKING_SPEC.md`.
4. [x] **Giải thích `addBusinessDays`**: Đã cập nhật docstring giải thích rõ hàm hoạt động theo calendar days (bảo toàn tương thích ngược import).
5. [x] **Test suite toàn diện**: Đã chạy 546/546 test tự động (booking-core, agent-core, cdp-core, booking landing, admin) đều PASS 100%.

## TODO List: Cần bạn quyết (Post-Test Decisions & Backlog)

Dưới đây là các câu hỏi và quyết định kiến trúc / vận hành cần Owner phê duyệt trước hoặc ngay sau khi mở cờ Production:

1. **Rewrite Contract API (`contracts/guest-booking-api.md`)**:
   - Hiện tại: Đã gắn banner cảnh báo dẫn về `source-of-truth.md`.
   - Cần quyết: Có cần dành 1 sprint để rewrite toàn bộ file contract API sang định dạng Session Engine `/api/guest/sessions` thay cho các endpoint `/holds` legacy không? (Khuyến nghị: Rewrite sau khi go-live prod ổn định).
2. **Kế hoạch bật Webhook Ngân hàng tự động đối soát**:
   - Hiện tại: `autoConfirmExactMatch=false`, quản lý bấm duyệt xác nhận thủ công qua Telegram card.
   - Cần quyết: Thời gian chạy Shadow Mode (ghi nhận webhook mà không auto-confirm) dự kiến là bao lâu (ví dụ 1 tuần) trước khi kích hoạt `autoConfirmExactMatch=true`?
3. **Đổi tên hàm `addBusinessDays` → `addCalendarDays`**:
   - Hiện tại: Đã ghi rõ docstring hàm hoạt động theo calendar days, giữ nguyên tên để tránh phá vỡ import trên nhiều service.
   - Cần quyết: Có muốn refactor đổi tên hàm trên toàn bộ các repo trong đợt bảo trì tiếp theo không?
4. **Quy định hoàn voucher khi khách huỷ / đổi lịch**:
   - Hiện tại: Khi đơn bị cancel, `restoreVoucherStmt` tự động hoàn lại voucher còn hạn về `issued`. Nếu no-show thì giữ nguyên trạng thái redeemed (đã sử dụng).
   - Cần quyết: Quy định này đã hoàn toàn khớp chính sách vận hành của khách sạn chưa?
5. **Cửa sổ hiển thị mã phòng (`codesVisibleHoursBefore`)**:
   - Hiện tại: Mã khoá phòng chỉ hiển thị cho khách trước giờ check-in $N$ tiếng (`codesVisibleHoursBefore`, cấu hình master data). Ngoài giờ này, khách tra cứu chỉ thấy `••••`.
   - Cần quyết: Khách sạn chốt $N$ là mấy tiếng trước giờ check-in (mặc định hiện tại là 2 tiếng)?


