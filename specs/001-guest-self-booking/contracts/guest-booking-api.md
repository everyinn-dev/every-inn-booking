# API Contracts: Guest Self-Booking, Payment, Check-in & OTA Calendar

- **Feature**: `001-guest-self-booking` (`feat/landing-self-booking`)
- **Version**: 3.0.0 (Aligned 100% with Session Engine, Landing BFF, Agent Core `LandingApi` & Booking Core v2.0)
- **Last Updated**: 2026-11-10
- **Sources of Truth**:
  - Guest BFF routes: `every-inn-booking/src/app/api/guest/**`
  - Agent Core Session HTTP & Payments: `everyinn-agent-core/src/sessions/http.ts`, `payments.ts`, `telegram.ts`, `checkinAccess.ts`
  - Booking Core Internal API: `everyinn-booking-core/src/routes.ts`, `handlers/availability.ts`, `handlers/calendar.ts`, `handlers/blocks.ts`, `handlers/catalog.ts`
  - Shared Booking Kit: `everyinn-platform-docs/shared/booking-kit/types.ts`
- **Standard BFF Response Envelope**:
  - Success: `{ "ok": true, "data": { ... }, "requestId": "<uuid>" }`
  - Error: `{ "ok": false, "error": { "code": "<UPPER_SNAKE>", "message": "<human Vietnamese>", "details"?: { ... } }, "requestId": "<uuid>" }`
  - Cache header trên toàn bộ route nhạy cảm / biến động: `Cache-Control: private, no-store` (riêng `/storefront` và `GET /sessions/[token]` hỗ trợ `ETag` → `304`).

---

## 1. Public Guest BFF Endpoints (`every-inn-booking`) & Bank Webhook (`everyinn-agent-core`)

Tất cả route `/api/guest/*` kiểm tra:
1. Cờ `WEB_BOOKING_ENABLED === "true"` (nếu `false` → `503 FEATURE_DISABLED`).
2. Same-origin guard cho request ghi (`POST`, `PATCH`, `DELETE`) (`403 FORBIDDEN`).
3. Workers Rate Limiting theo IP (`CF-Connecting-IP`) hoặc token prefix.
4. Gọi `BOOKING_CORE` (chỉ route đánh dấu `LANDING_READ`) hoặc `AGENT_CORE` (entrypoint `LandingApi`, header `x-ei-caller: landing-bff`, `x-ei-client-ip`).

### Bảng tổng hợp Endpoint thực tế

| Nhóm | Method & Path | Rate Limit | Mục đích |
|---|---|---|---|
| **Catalog** | `GET /api/guest/storefront` | `SEARCH_RL` (30/60s/IP) | Trả catalog phòng, bảng giá, 4 ca, bank info, public promos, `bookingWindow` (ETag → `304`) |
| **Search** | `POST /api/guest/availability` | `SEARCH_RL` (30/60s/IP) | Tìm phòng (`hourly` / `overnight` / `dayuse`), trả giá Core + `overnightAddons` + `shiftSummary` |
| **Pulse** | `GET /api/guest/pulse?v=` | — | Long-poll `InventoryPulse` DO (≤ 25s) báo thay đổi lịch phòng trên trang tìm kiếm |
| **Session Create** | `POST /api/guest/sessions` | `HOLD_RL` (3/60s/IP) + D1 (1/phone, 2/IP) | Phone-First Hold (10 phút), trả `token` `/dat-phong/<token>` & `SessionView` |
| **Session Read** | `GET /api/guest/sessions/[token]` | — | Lấy trạng thái phiên (`ETag` → `304`) |
| **Session Update** | `PATCH /api/guest/sessions/[token]` | — | Lưu thông tin khách, mã promo, voucher CDP; sinh `EIPAY...` + VietQR |
| **Session Cancel** | `DELETE /api/guest/sessions/[token]` | — | Khách tự huỷ phiên, trả slot & giải phóng voucher lease |
| **Session Live** | `GET /api/guest/sessions/[token]/live?v=&timeout=` | — | Long-poll `BookingSessionLive` DO (≤ 25s) theo version phiên |
| **Pricing Preview** | `POST /api/guest/sessions/[token]/preview` | `SEARCH_RL` (30/60s/IP) | Xem trước hạng hội viên CDP, ví voucher (masked), kiểm tra `promotionCode` & giá |
| **Claim Paid** | `POST /api/guest/sessions/[token]/paid` | `PAID_RL` (5/60s theo token prefix) | Khách báo đã CK → gia hạn grace (`+30'` ≤ checkin) & ping Telegram |
| **Check-in Guide** | `POST /api/guest/checkin/lookup` | `LOOKUP_RL` (5/60s/IP) + D1 (5 sai/15m/IP) | Tra cứu đa khoá cho mọi đơn `confirmed` → 4 khối hướng dẫn & mã mở cửa (trong cửa sổ) |
| **Bank Webhook** | `POST /webhooks/payments/:provider` *(trên `agent-core`)* | Signature/API-Key check | Nhận webhook từ `sepay`, `casso`, `payos` (`404` khi chưa cấu hình secret) |

---

### 1.1. `GET /api/guest/storefront`

Lấy danh mục Master Data chuẩn hóa để render `SearchBar` và trang chủ.

- **Rate Limit**: `SEARCH_RL` (`30 req / 60s / IP`).
- **Headers**: Hỗ trợ `If-None-Match` → `304 Not Modified`.
- **Response `200 OK` (`data: Storefront`)**:
```json
{
  "ok": true,
  "data": {
    "catalogVersion": 3,
    "bank": {
      "bankId": "MB",
      "account": "0906314109999",
      "holderName": "HO KINH DOANH EVERY INN"
    },
    "rooms": [
      {
        "id": "haven-101",
        "roomNumber": "101",
        "name": "Haven 101",
        "roomClass": "haven",
        "floor": 1,
        "areaSqm": 22,
        "maxGuests": 2
      },
      {
        "id": "sig-202",
        "roomNumber": "202",
        "name": "Signature 202",
        "roomClass": "signature",
        "floor": 2,
        "areaSqm": 28,
        "maxGuests": 4
      }
    ],
    "rates": {
      "haven": { "combo3h": 320000, "overnight": 520000, "dayroom": 620000, "extraHourFee": 60000 },
      "signature": { "combo3h": 360000, "overnight": 620000, "dayroom": 750000, "extraHourFee": 60000 }
    },
    "extraGuest": { "standardGuests": 2, "feePerGuest": 150000, "roomClasses": ["signature"] },
    "hourly": { "minHours": 3, "firstCheckin": "08:00", "lastCheckin": "21:00", "slots": [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] },
    "overnight": {
      "window_start": "21:00",
      "window_end": "12:00",
      "max_addon_hours": 3,
      "shifts": [
        { "code": "21-9", "start": "21:00", "end": "09:00", "label": "21h – 9h" },
        { "code": "22-10", "start": "22:00", "end": "10:00", "label": "22h – 10h" },
        { "code": "23-11", "start": "23:00", "end": "11:00", "label": "23h – 11h" },
        { "code": "24-12", "start": "00:00", "end": "12:00", "label": "24h – 12h" }
      ]
    },
    "dayuse": { "checkin": "15:00", "checkout": "12:00" },
    "bookingWindow": {
      "today": "2026-11-08",
      "maxAdvanceDays": 90,
      "maxDate": "2027-02-06",
      "minLeadMinutes": 30
    },
    "publicPromotions": [
      { "id": "prm-weekday", "name": "Ưu đãi ngày thường −10%", "discountType": "percentage", "discountValue": 10, "description": null }
    ]
  },
  "requestId": "6f9619ff-8b86-d011-b42d-00c04fc964ff"
}
```
*(Ghi chú: `storefront.bank` đọc động từ bảng `BOOKING_DB.properties`. Trên UI thẻ phòng Landing, `roomMedia()` bổ sung hiển thị thông tin phòng thực tế theo `src/data/rooms.ts`.)*

---

### 1.2. `POST /api/guest/availability`

Tìm danh sách phòng theo `kind` (`hourly`, `overnight`, `dayuse`), trả giá Core v2.0 (áp Best Public Promotion), cộng `overnightAddons` và `shiftSummary` khi là `overnight`.

- **Rate Limit**: `SEARCH_RL` (`30 req / 60s / IP`).
- **Request Body (`SearchCriteria` phẳng)**:
```json
{
  "kind": "overnight",
  "date": "2026-11-20",
  "shift": "22-10",
  "start": null,
  "hours": null,
  "out": null,
  "guests": 2,
  "roomClass": null
}
```
- **Quy tắc chuẩn hóa thời gian tại BFF (`criteria.ts` + `booking-kit/stay.ts`)**:
  - `overnight`:
    - `21-9`: `${date}T21:00:00+07:00` → `${date+1}T09:00:00+07:00`
    - `22-10`: `${date}T22:00:00+07:00` → `${date+1}T10:00:00+07:00`
    - `23-11`: `${date}T23:00:00+07:00` → `${date+1}T11:00:00+07:00`
    - `24-12`: `${date+1}T00:00:00+07:00` → `${date+1}T12:00:00+07:00` *(nightDate vẫn là `date` D)*
  - `dayuse`: Cố định `${date}T15:00:00+07:00` → `${out}T12:00:00+07:00` (`out > date`, tối đa `90` ngày / lưu trú).
  - `hourly`: `start` trong khung `08:00..21:00`, **bắt buộc `:00` chẵn** (`/^([01]\d|2[0-3]):00$/`), `hours` số nguyên `3..12`.
- **Response `200 OK` (`data: SearchResult & { criteria, shift }`)**:
```json
{
  "ok": true,
  "data": {
    "bookingsVersion": 42,
    "checkinAt": "2026-11-20T15:00:00.000Z",
    "checkoutAt": "2026-11-21T03:00:00.000Z",
    "bookingWindow": { "maxAdvanceDays": 90, "maxDate": "2027-02-06" },
    "criteria": { "kind": "overnight", "date": "2026-11-20", "shift": "22-10", "guests": 2 },
    "shift": "22-10",
    "shiftSummary": [
      { "code": "21-9", "label": "21h – 9h", "checkinAt": "2026-11-20T14:00:00.000Z", "checkoutAt": "2026-11-21T02:00:00.000Z", "availableRooms": 4, "past": false },
      { "code": "22-10", "label": "22h – 10h", "checkinAt": "2026-11-20T15:00:00.000Z", "checkoutAt": "2026-11-21T03:00:00.000Z", "availableRooms": 5, "past": false }
    ],
    "rooms": [
      {
        "room": { "id": "sig-202", "roomNumber": "202", "name": "Signature 202", "roomClass": "signature", "maxGuests": 4, "areaSqm": 28, "floor": 2 },
        "available": false,
        "reasons": [{ "code": "JUST_BOOKED", "message": "Vừa được đặt" }],
        "price": null,
        "overnightAddons": null
      },
      {
        "room": { "id": "sig-102", "roomNumber": "102", "name": "Signature 102", "roomClass": "signature", "maxGuests": 4, "areaSqm": 28, "floor": 1 },
        "available": true,
        "reasons": [],
        "price": {
          "basePrice": 620000,
          "subtotal": 620000,
          "extraGuestFee": 0,
          "extraFee": 0,
          "holidaySurcharge": 0,
          "promotion": { "name": "Ưu đãi ngày thường −10%", "discount": 62000 },
          "total": 558000,
          "lines": [{ "code": "BASE", "label": "Qua đêm", "amount": 620000 }]
        },
        "overnightAddons": {
          "shift": "22-10",
          "maxEarlyAllowedByRule": 1,
          "maxLateAllowedByRule": 2,
          "surchargePerHour": 60000,
          "earlyCheckinOptions": [
            {
              "hours": 1,
              "type": "early_checkin",
              "shortLabel": "+1h nhận sớm",
              "label": "Thêm 1h nhận phòng sớm (nhận 21:00)",
              "effectiveTimeIso": "2026-11-20T14:00:00.000Z",
              "surchargeVnd": 60000,
              "available": true
            }
          ],
          "lateCheckoutOptions": [
            {
              "hours": 1,
              "type": "late_checkout",
              "shortLabel": "+1h trả muộn",
              "label": "Thêm 1h trả phòng muộn (trả 11:00)",
              "effectiveTimeIso": "2026-11-21T04:00:00.000Z",
              "surchargeVnd": 60000,
              "available": true
            },
            {
              "hours": 2,
              "type": "late_checkout",
              "shortLabel": "+2h trả muộn",
              "label": "Thêm 2h trả phòng muộn (trả 12:00)",
              "effectiveTimeIso": "2026-11-21T05:00:00.000Z",
              "surchargeVnd": 120000,
              "available": false,
              "unavailableReason": "TURNOVER_BUFFER_CONFLICT"
            }
          ]
        }
      }
    ]
  },
  "requestId": "..."
}
```

---

### 1.3. `GET /api/guest/pulse?v=<bookingsVersion>`

Long-poll qua Durable Object `InventoryPulse` (tối đa `25s`, không tính vào `SEARCH_RL`). Khi có giữ phòng/huỷ/chốt/đóng phòng làm tăng `bookingsVersion`, phản hồi ngay để trang tìm kiếm refresh.

- **Response `200 OK`**:
```json
{
  "ok": true,
  "data": { "version": 43, "changed": true },
  "requestId": "..."
}
```

---

### 1.4. `POST /api/guest/sessions` (Phone-First Hold)

Tạo phiên giữ phòng **10 phút** (`holding`). BFF suy xuất lại `checkinAt`/`checkoutAt` từ `criteria` trên server để tránh sửa giá/giờ ở client.

- **Rate Limit & Guards**:
  - `HOLD_RL`: `3 req / 60s / IP`.
  - D1 `agent-db`: tối đa `2` phiên đang sống / `ip_hash` (`429 TOO_MANY_HOLDS`) và tối đa **`1` phiên đang sống / `phone_hash`** (`409 ANOTHER_SESSION_LIVE` trừ khi `forceSwitch: true`).
- **Request Body**:
```json
{
  "kind": "overnight",
  "date": "2026-11-20",
  "shift": "22-10",
  "guests": 2,
  "roomId": "sig-102",
  "early": 1,
  "late": 1,
  "phone": "0906314109",
  "forceSwitch": false,
  "clientNonce": "c7a9d3f2-1b8a-4e2f-9d01-8b4e2f90a112"
}
```
- **Response `201 Created` (hoặc `200 OK` nếu `replayed: true` theo `clientNonce`)**:
```json
{
  "ok": true,
  "data": {
    "token": "mX8kP2vL9qR4zT1nW7yC5bF0jH3dG6sA8eU2rV4xZ1w",
    "replayed": false,
    "session": {
      "ref": "ses_9f1a2b3c4d5e6f70",
      "channel": "web",
      "status": "holding",
      "statusLabel": "Đang giữ phòng cho bạn",
      "room": { "id": "sig-102", "label": "Signature 102" },
      "bookingType": "overnight",
      "shift": "22-10",
      "checkinAt": "2026-11-20T14:00:00.000Z",
      "checkoutAt": "2026-11-21T04:00:00.000Z",
      "earlyHours": 1,
      "lateHours": 1,
      "numGuests": 2,
      "expiresAt": "2026-11-08T05:55:00.000Z",
      "serverNow": "2026-11-08T05:45:00.000Z",
      "remainingSeconds": 600,
      "amountDue": 678000,
      "paidAmount": 0,
      "remaining": 678000,
      "pricing": {
        "basePrice": 620000,
        "subtotal": 740000,
        "promotion": { "name": "Ưu đãi ngày thường −10%", "discount": 62000 },
        "voucher": null,
        "total": 678000,
        "payable": 678000,
        "isDeposit": false
      },
      "guest": { "name": null, "phoneMasked": "090****109", "phone": "0906314109", "instagram": null, "facebook": null, "note": null },
      "payment": null,
      "bookingId": null,
      "can": { "editGuest": true, "claimPaid": false, "cancel": true },
      "timeline": [
        { "event": "HOLD_CREATED", "label": "Đã giữ phòng cho bạn", "at": "2026-11-08T05:45:00.000Z" }
      ],
      "version": 1
    }
  },
  "requestId": "..."
}
```
- **Conflict `409 ANOTHER_SESSION_LIVE`** (khi `phone` đang giữ phiên khác và `forceSwitch` là `false`):
```json
{
  "ok": false,
  "error": {
    "code": "ANOTHER_SESSION_LIVE",
    "message": "Số điện thoại này đang giữ phòng Haven 101. Hoàn tất đơn cũ hoặc bấm 'Đổi sang phòng này'.",
    "details": {
      "liveSessions": 1,
      "existingSessionId": "ses_1122334455667788",
      "existingRoomLabel": "Haven 101",
      "expiresAt": "2026-11-08T05:52:00.000Z",
      "remainingSeconds": 420
    }
  },
  "requestId": "..."
}
```

---

### 1.5. `GET / PATCH / DELETE /api/guest/sessions/[token]`

Quản lý phiên theo token capability (40–64 ký tự `[A-Za-z0-9_-]`; sai định dạng hoặc không tồn tại trả `404 SESSION_NOT_FOUND`).

#### A. `GET /api/guest/sessions/[token]`
- Hỗ trợ header `If-None-Match: W/"ses-<last6>-<version>"` → `304 Not Modified`.
- Response `200 OK`: `{ "ok": true, "data": { "session": SessionView }, "requestId": "..." }`.

#### B. `PATCH /api/guest/sessions/[token]`
Lưu thông tin khách, kiểm tra mã ưu đãi / voucher ví CDP, tạo `payment_intents` + VietQR và chuyển `holding → awaiting_payment`.
- **Request Body**:
```json
{
  "guest": {
    "name": "Nguyễn Văn An",
    "phone": "0906314109",
    "zalo": "0906314109",
    "instagram": null,
    "facebook": null,
    "note": "Mình đến nhận phòng lúc 21h15 nhé"
  },
  "promotionCode": "BANBE100K",
  "voucherId": "vch_01jh123",
  "noVoucher": false
}
```
*(Ghi chú: Nếu khách bỏ trống cả `zalo`, `instagram`, `facebook`, server tự đặt `zalo = phone` để đảm bảo luôn có kênh liên lạc.)*
- **Response `200 OK`**: Trả `{ "session": SessionView }` với `status: "awaiting_payment"`, `payment` chứa `bankId`, `account`, `holderName`, `amount`, `reference` (`EIPAY...`), `qrUrl`, và `can.claimPaid = true`.
- **Lỗi đặc thù**: `422 PHONE_REQUIRED`, `422 PROMOTION_NOT_APPLICABLE`, `422 VOUCHER_NOT_AVAILABLE`, `409 ANOTHER_SESSION_LIVE`.

#### C. `DELETE /api/guest/sessions/[token]`
Khách chủ động huỷ giữ phòng khi phiên còn trong `can.cancel` (`holding` hoặc `awaiting_payment`). Thực thi `GUEST_CANCEL` → `cancelled`, giải phóng `inventory_slots` và trả voucher lease trong CDP ngay lập tức.

---

### 1.6. `POST /api/guest/sessions/[token]/preview`

Xem trước hạng hội viên CDP, danh sách voucher trong ví (đã mask mã thành `TEM3-••Q2`) và kết quả kiểm tra `promotionCode` ngay khi khách đang nhập liệu.

- **Rate Limit**: `SEARCH_RL` (`30 req / 60s / IP`).
- **Request Body**:
```json
{
  "phone": "0906314109",
  "promotionCode": "BANBE100K",
  "voucherId": null,
  "noVoucher": false
}
```
- **Response `200 OK` (`data: Preview`)**:
```json
{
  "ok": true,
  "data": {
    "pricing": {
      "basePrice": 620000,
      "surcharges": 120000,
      "lines": [
        { "code": "BASE", "label": "Qua đêm", "amount": 620000 },
        { "code": "EARLY", "label": "1h nhận sớm", "amount": 60000 },
        { "code": "LATE", "label": "1h trả muộn", "amount": 60000 }
      ],
      "subtotal": 740000,
      "promotion": { "name": "Ưu đãi Bạn Bè", "eligible": true, "reason": null, "discount": 100000 },
      "voucher": { "id": "vch_01jh123", "codeMasked": "TEM8-••Q2", "label": "Voucher tem mốc 8", "discount": 100000 },
      "total": 540000
    },
    "member": { "tier": "silver", "found": true },
    "vouchers": [
      { "id": "vch_01jh123", "codeMasked": "TEM8-••Q2", "value": 100000, "label": "Voucher tem mốc 8", "expiresAt": "2027-02-06T00:00:00.000Z" }
    ]
  },
  "requestId": "..."
}
```

---

### 1.7. `GET /api/guest/sessions/[token]/live?v=<version>&timeout=<ms>`

Long-poll tới Durable Object `BookingSessionLive` (tối đa `25000 ms`):
- Nếu `session.version > v`: trả `200 OK { session: SessionView }`.
- Nếu hết timeout vẫn chưa đổi version: trả `304 Not Modified`.
- Client (`useLongPoll` trong `shared/booking-kit/live.ts`) tự nối lại vòng lặp khi tab đang hiển thị và lùi backoff `4s → 30s` nếu lỗi mạng.

---

### 1.8. `POST /api/guest/sessions/[token]/paid`

Khách bấm **"Tôi đã chuyển khoản"** (khi đang `awaiting_payment`, `underpaid`, `payment_claimed` hoặc đã `expired` chuyển trễ).

- **Rate Limit**: `PAID_RL` (`5 req / 60s` theo key `paid:${token.slice(0,16)}`).
- **Request Body**: `{ "note"?: "Vừa chuyển từ Vietcombank" }`.
- **Hành vi**:
  - Đang `awaiting_payment` / `underpaid` → chuyển `payment_claimed`, tự động kéo dài `expires_at` thêm `claimGraceMinutes = 30` phút (không vượt `checkinAt`), ping Telegram card kèm nút duyệt.
  - Đang `expired` → chuyển `late_payment` (`LATE_CLAIM`), gửi cảnh báo Telegram để Quản lý bấm `restore` (kiểm tra lại phòng trống hoặc xử lý trùng lịch).

#### Thẻ Telegram Interactive do `everyinn-agent-core` gửi & sửa tại chỗ
- Định dạng callback **duy nhất dùng chung cho cả Web và Admin** (`sessions/telegram.ts`):
  - `ss:<sid>:ok` — `[✅ Đã nhận đủ]` → chốt đơn `confirmed`.
  - `ss:<sid>:amt` — `[💰 Nhập số tiền khác]` → force-reply nhập tiền thực nhận (`paid < remaining` → `underpaid`).
  - `ss:<sid>:no` — `[❌ Chưa nhận]` → lần 1 hoàn về `awaiting_payment`/`underpaid`, lần 2 huỷ đơn.
  - `ss:<sid>:rv` / `ss:<sid>:rv!` — `[🗑 Thu hồi giữ phòng]` + xác nhận huỷ.
  - `ss:<sid>:keep` — `[✅ Chốt cọc & Xác nhận]` khi đang `underpaid`.
  - `ss:<sid>:short` — `[⚠️ Báo khách CK thiếu]` gửi trạng thái `underpaid` + QR số tiền còn thiếu.
  - `ss:<sid>:topup` — `[✅ Khách đã CK bù đủ]` xác nhận đủ sau khi thiếu.
  - `ss:<sid>:restore` — `[🔄 Khôi phục & Xác nhận]` cho đơn `late_payment`.
  - `sm:<inboxId>:<sid>` — Khớp giao dịch webhook ngân hàng chưa rõ mã `EIPAY`.
- Thẻ nhắc mã mở cửa **không bao giờ in plaintext mã cổng / hộp khóa lên Telegram** (D9): chỉ hiện trạng thái `✓ Mã cổng đã có` / `✗ Chưa có` kèm force-reply `REQUEST_DOOR_CODE`.

---

### 1.9. `POST /webhooks/payments/:provider` *(nằm trên `everyinn-agent-core`)*

Public webhook endpoint hỗ trợ `provider ∈ { "sepay", "casso", "payos" }` (`everyinn-agent-core/src/sessions/payments.ts`):
- Trả `404` ngay nếu env secret của provider tương ứng chưa được thiết lập (`SEPAY_WEBHOOK_KEY`, `CASSO_WEBHOOK_TOKEN`, `PAYOS_CHECKSUM_KEY`).
- Trích xuất transaction ID & số tiền, tách/lọc PII, dedupe theo `UNIQUE(provider, provider_txn_id)` trong `payment_webhook_inbox`.
- Tách mã tham chiếu bằng regex `/EIPAY\s*(\d{6})\s*([A-Z0-9]{4})/i`.
- Ở chế độ mặc định (`payment_policy.autoConfirmExactMatch = false`, shadow mode), nếu chưa tự khớp hoặc cấu hình còn tắt tự động chốt, hệ thống gửi candidate button `sm:<inboxId>:<sid>` lên Telegram để Quản lý bấm duyệt.

---

### 1.10. `POST /api/guest/checkin/lookup`

Tra cứu đa khóa cho **mọi đơn `confirmed`** (`web`, `admin`, `chat`) — D13.

- **Rate Limit**: `LOOKUP_RL` (`5 req / 60s / IP`) tại BFF + `ckfail:<ipHash>` tối đa **`5` lần sai / `15` phút / IP** trong D1 `rate_counters`.
- **Cache Header**: `Cache-Control: private, no-store`.
- **Request Body**:
```json
{
  "phone": "0906314109",
  "secondKeyType": "booking_ref",
  "secondKeyValue": "EIPAY261108W9X4"
}
```
*(Các giá trị hợp lệ của `secondKeyType`: `"booking_ref"`, `"social"`, `"checkin_date_room"`; với `"checkin_date_room"` truyền thêm `checkinDate: "YYYY-MM-DD"` và `roomNumber: "202"`.)*

- **Response `200 OK` (khi đang trong cửa sổ `[checkinAt - codesVisibleHoursBefore, checkoutAt + 2h]`)**:
```json
{
  "ok": true,
  "data": {
    "booking": {
      "id": "EI-20261120-K7Q2",
      "roomId": "sig-202",
      "roomNumber": "202",
      "roomName": "Signature 202",
      "bookingType": "overnight",
      "checkinAt": "2026-11-20T14:00:00.000Z",
      "checkoutAt": "2026-11-21T04:00:00.000Z",
      "numGuests": 2,
      "guestNameMasked": "Nguyễn V** An",
      "status": "confirmed",
      "remainingAmount": 0
    },
    "accessCodes": {
      "ready": true,
      "visible": true,
      "visibleFrom": "2026-11-20T08:00:00.000Z",
      "gateCode": "2580#",
      "lockboxCode": "4321",
      "wifiName": "DGH",
      "wifiPassword": "0906314109",
      "pendingNote": null
    },
    "guideBlocks": {
      "step1MainText": "Every Inn - 69/24L1 Nguyễn Công Hoan...",
      "step1GoogleMapsUrl": "https://maps.app.goo.gl/CV7RM9akRpGEx8Ds8?g_st=ic",
      "step2Images": {
        "checkinImageUrl": null,
        "checkinImageAlt": "Hướng dẫn nhận phòng",
        "checkoutImageUrl": null,
        "checkoutImageAlt": "Hướng dẫn trả phòng"
      },
      "step3TaxiText": "Nếu bạn đi taxi hãy book xe đến 71/31 Nguyễn Công Hoan là đầu hẻm, và mình đi bộ vào khoảng 30m như clip hướng dẫn là đến ạ.",
      "step3TaxiDropoffAddress": "71/31 Nguyễn Công Hoan, Phường Cầu Kiệu, TP.HCM",
      "step4Video": {
        "videoUrl": null,
        "posterUrl": null,
        "caption": "Đường từ đầu hẻm 71/31 vào tới cửa Every Inn"
      }
    }
  },
  "requestId": "..."
}
```
*(Ghi chú: Ngoài cửa sổ `[checkinAt - codesVisibleHoursBefore, checkoutAt + 2h]`, `accessCodes.visible = false`, `gateCode: null`, `lockboxCode: null`, `step1MainText` thay mã thành `••••`, và `pendingNote` ghi chú thời điểm mở mã `visibleFrom`. Mặc định `codesVisibleHoursBefore` trong `defaults.ts`/`policy.ts` là `6` giờ; URL media đang để `null` chờ `LSB-7`.)*

---

### 1.11. Catalog Các Mã Lỗi Chuẩn Hóa

| HTTP | Code | Ngữ cảnh phát sinh |
|---|---|---|
| `400` | `VALIDATION_FAILED` | Sai schema, thiếu `roomId`/`clientNonce`, giờ `:30` hoặc sai định dạng ở BFF |
| `400` | `SECOND_KEY_REQUIRED` | Gọi `/checkin/lookup` thiếu giá trị khoá 2 tương ứng `secondKeyType` |
| `403` | `FORBIDDEN` | Foreign `Origin` trên request ghi |
| `404` | `SESSION_NOT_FOUND` | Token không đúng định dạng `TOKEN_PATTERN` hoặc phiên không tồn tại |
| `404` | `GUEST_LOOKUP_NO_MATCH` | Không khớp đơn `confirmed` trên Core (`details.attemptsLeft` đếm ngược trong 15 phút) |
| `409` | `ANOTHER_SESSION_LIVE` | SĐT đang giữ 1 phiên sống khác (`details: { liveSessions, existingSessionId, existingRoomLabel, expiresAt, remainingSeconds }`) |
| `409` | `AVAILABILITY_CHANGED` | Phòng vừa có khách khác giữ/đặt hoặc vừa đóng block khi tạo hold |
| `409` | `SESSION_MANAGED` | Gọi trực tiếp `/internal/v1/holds/*` lên hold thuộc về `booking_sessions` |
| `422` | `HOURLY_CHECKIN_STEP_INVALID` | Đặt theo giờ gửi phút check-in không phải `:00` chẵn |
| `422` | `LEAD_TIME_TOO_SHORT` | Đặt theo giờ hôm nay sớm hơn `min_lead_minutes` (mặc định 30 phút) |
| `422` | `ADVANCE_BOOKING_EXCEEDED` | Web/chat vượt `max_advance_days` (`details: { maxAdvanceDays: 90, maxAllowedDate: "2027-02-06", requestedDate }`) |
| `422` | `INVALID_PHONE` | SĐT không phải số di động VN hợp lệ |
| `422` | `PHONE_REQUIRED` | `PATCH /sessions/[token]` thiếu SĐT |
| `422` | `PROMOTION_NOT_APPLICABLE` | `promotionCode` không tồn tại hoặc không đủ điều kiện khi `PATCH` |
| `422` | `VOUCHER_NOT_AVAILABLE` | Voucher đã dùng, hết hạn hoặc đang được lease cho hold khác |
| `429` | `RATE_LIMIT_EXCEEDED` | Vượt `SEARCH_RL` / `HOLD_RL` / `PAID_RL` / `LOOKUP_RL` (`retryAfterSeconds: 60`) hoặc sai lookup 5 lần/15p (`retryAfterSeconds: 900`) |
| `429` | `TOO_MANY_HOLDS` | Vượt `maxLiveHoldsPerIp = 2` phiên sống trên cùng `ip_hash` |
| `503` | `FEATURE_DISABLED` | `WEB_BOOKING_ENABLED !== "true"` |
| `503` | `LOOKUP_UNAVAILABLE` | Lỗi kết nối Core khi tra cứu check-in (không trừ `attemptsLeft`) |

---

## 2. Internal Admin OTA Calendar, Blocks & Config Endpoints (`everyinn-booking-core`)

Các API phục vụ trang Admin `/calendar` (`everyinn-admin`) gọi qua Service Binding (`x-ei-caller: admin-bff`).

### 2.1. `GET /internal/v1/calendar/matrix?from=YYYY-MM-DD&to=YYYY-MM-DD`
Lấy ma trận Phòng × Ngày (tối đa **62 ngày** / lần). Hỗ trợ `ETag: W/"cal-<bv>-<cv>-<from>-<to>-<today>"` → `304`.
- **Response `200 OK`**: Trả `{ from, to, today, bookingWindow: { maxAdvanceDays, maxDate }, ratePlans: ["combo3h", "overnight", "dayroom"], blockTypes, rooms }`, trong đó mỗi phòng chứa mảng `days[]`: `{ date, bookable, rates: { combo3h|overnight|dayroom: { price, listPrice, override } }, closures, bookings, holds, occupancyPct }`.

### 2.2. `GET /internal/v1/rate-overrides?from=YYYY-MM-DD&to=YYYY-MM-DD`
Liệt kê các `rate_overrides` đang bật (`is_active = 1`) trong khoảng tối đa **366 ngày**.

### 2.3. `PUT /internal/v1/rate-overrides` *(manager only)*
Upsert giá cơ bản theo dải ngày (lưu vào `rate_overrides` với `room_scope = roomId ?? '*'` và bump `catalog` domain version).
- **Request Body**:
```json
{
  "roomClass": "signature",
  "roomId": null,
  "ratePlanCodes": ["overnight"],
  "fromDate": "2026-11-20",
  "toDate": "2026-11-22",
  "weekdays": [5, 6],
  "customBasePrice": 680000,
  "note": "Giá cuối tuần tháng 11"
}
```
*(Lưu ý: `weekdays` sử dụng `0 = CN .. 6 = T7`; không chỉnh ngày quá khứ `fromDate < today` → `422 DATE_IN_PAST`.)*
- **Response `200 OK`**: `{ updated, roomClass, roomId, ratePlanCodes, from, to, days, customBasePrice, note }`.

### 2.4. `POST /internal/v1/rate-overrides/clear` *(manager only)*
Khôi phục về giá niêm yết (`rate_rules`) bằng cách đặt `is_active = 0` cho phạm vi tương ứng trong `rate_overrides` (vẫn giữ dòng dữ liệu để audit). Trả `{ cleared, roomClass, roomId, ratePlanCodes, from, to, days }`.

### 2.5. `POST /internal/v1/room-blocks/bulk` *(manager only + `Idempotency-Key`)*
Đóng bán hàng loạt nhiều phòng (hoặc `["*"]`) trong 1 D1 batch (tối đa **31 ngày** / lần, slot aligned 30 phút).
- **Request Body**:
```json
{
  "roomIds": ["sig-202", "haven-101"],
  "blockType": "stop_sell",
  "blockedFrom": "2026-11-25T05:00:00.000Z",
  "blockedTo": "2026-11-27T05:00:00.000Z",
  "reason": "Bảo trì máy lạnh",
  "note": null,
  "skipConflicts": true
}
```
- **Response `201 Created`**: `{ blocks, skipped: [{ roomId, roomName, message }], batchId, replayed }`. Phòng đang có khách không bao giờ bị đóng đè.

### 2.6. `POST /internal/v1/room-blocks/:blockId/release`
Mở bán lại phòng đã khoá (yêu cầu `{ expectedVersion, reason? }`), trả lại `inventory_slots` và bump `bookings` domain.

### 2.7. `PUT /internal/v1/configs/booking_rules` *(manager only)*
Cập nhật cấu hình cửa sổ đặt trước (`max_advance_days`, `1..730`) và các quy tắc `booking_rules` (bắt buộc optimistic lock `expectedVersion`).
- **Request Body**:
```json
{
  "expectedVersion": 1,
  "value": { "max_advance_days": 90 }
}
```
- **Response `200 OK`**: `{ key: "booking_rules", value: { ... }, version: 2 }`.
