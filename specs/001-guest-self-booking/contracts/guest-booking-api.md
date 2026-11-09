# API Contracts: Dedicated Guest Self-Booking, Payment & Check-in API

- **Branch**: `001-guest-self-booking`
- **Version**: 2.0.0 (Updated to Core Pricing v2.0, Real-world Operational Metrics & Edge Security)
- **Date**: 2026-04-20
- **Last Updated**: 2026-11-08
- **Standard Envelope (`CONVENTIONS.md` §10)**:
  - Success: `{ "ok": true, "data": { ... }, "requestId": "<uuid>" }`
  - Error: `{ "ok": false, "error": { "code": "<UPPER_SNAKE>", "message": "<human Vietnamese>", "details"?: { ... } }, "requestId": "<uuid>" }`

> [!IMPORTANT]
> **CANONICAL ALIGNMENT (2026-11-09)**: Hệ thống triển khai thực tế sử dụng kiến trúc Session Engine an toàn (`/api/guest/sessions`, `/dat-phong/<token>`, long-poll DO 25s, `ss:<sid>:...`). Xem bảng ánh xạ endpoint và source of truth tại [source-of-truth.md](../source-of-truth.md).

---

## 1. Public Guest BFF Endpoints (`every-inn-booking`)

Tất cả các endpoint dưới đây được đặt tại `/api/guest/*` trên `every-inn-booking` (`saigonliving`), dành riêng cho khách hàng trên Landing Page với cơ chế phân quyền, kiểm soát dữ liệu đầu vào, chống spam (rate-limit theo `CF-Connecting-IP`) và ghi log truy vết riêng biệt (`x-ei-caller: landing-bff`).

---

### 1.1. `POST /api/guest/availability/search`
Tìm danh sách phòng trống theo 3 hình thức (`hourly`, `overnight`, `dayuse`), tự động tính khuyến mãi công khai tốt nhất (**Public Promotions** `is_public = 1`) và trả về danh sách các nút cộng thêm giờ (`overnightAddons`) với đơn giá niêm yết **`60.000đ/giờ`** cho từng phòng khi chọn Qua đêm.

#### Rate Limit
- **Tối đa 30 requests / phút / IP** (Dựa trên `CF-Connecting-IP`). Vượt ngưỡng trả về `429 Too Many Requests`.

#### Request Body
```json
{
  "bookingType": "overnight",
  "date": "2026-11-20",
  "overnightShift": "22-10",
  "checkoutDate": null,
  "hourlyStartTime": null,
  "hourlyDuration": null,
  "numGuests": 2,
  "roomClass": null
}
```
- **Quy tắc chuẩn hóa thời gian tại BFF trước khi gọi `BOOKING_CORE`**:
  - Nếu `bookingType === "overnight"`:
    - `21-9`: `checkinAt = "${date}T21:00:00+07:00"`, `checkoutAt = "${nextDay(date)}T09:00:00+07:00"`
    - `22-10`: `checkinAt = "${date}T22:00:00+07:00"`, `checkoutAt = "${nextDay(date)}T10:00:00+07:00"`
    - `23-11`: `checkinAt = "${date}T23:00:00+07:00"`, `checkoutAt = "${nextDay(date)}T11:00:00+07:00"`
    - `24-12`: `checkinAt = "${nextDay(date)}T00:00:00+07:00"`, `checkoutAt = "${nextDay(date)}T12:00:00+07:00"`
  - Nếu `bookingType === "dayuse"`:
    - Chỉ nhận `date` (ngày in) và `checkoutDate` (ngày out).
    - Tự động gán cứng: `checkinAt = "${date}T15:00:00+07:00"`, `checkoutAt = "${checkoutDate}T12:00:00+07:00"`, `earlyCheckinHours = 0`, `lateCheckoutHours = 0`.
  - Nếu `bookingType === "hourly"`:
    - Khung giờ nhận phòng: `08:00` đến `21:00` (bước 30 phút).
    - `checkinAt = "${date}T${hourlyStartTime}:00+07:00"`, `checkoutAt = addHours(checkinAt, hourlyDuration)` (tối thiểu 3 giờ).

#### Response `200 OK`
```json
{
  "ok": true,
  "data": {
    "bookingType": "overnight",
    "overnightShift": "22-10",
    "baseCheckinAt": "2026-11-20T22:00:00+07:00",
    "baseCheckoutAt": "2026-11-21T10:00:00+07:00",
    "standardTimeNotice": null,
    "rooms": [
      {
        "roomId": "sig-202",
        "name": "Signature 202",
        "roomClass": "signature",
        "floor": 2,
        "maxGuests": 4,
        "available": true,
        "basePrice": 620000,
        "extraGuestSurcharge": 0,
        "publicPromotion": {
          "promotionId": "prm-black-friday",
          "name": "Ưu đãi Tháng 11 (-15%)",
          "discountAmount": 93000
        },
        "finalBasePrice": 527000,
        "overnightAddons": {
          "shift": "22-10",
          "maxEarlyAllowedByRule": 1,
          "maxLateAllowedByRule": 2,
          "surchargePerHour": 60000,
          "earlyCheckinOptions": [
            {
              "hours": 1,
              "type": "early_checkin",
              "shortLabel": "+1h checkin sớm",
              "label": "Thêm 1h checkin sớm (nhận 21:00)",
              "effectiveTimeIso": "2026-11-20T21:00:00+07:00",
              "surchargeVnd": 60000,
              "available": true
            }
          ],
          "lateCheckoutOptions": [
            {
              "hours": 1,
              "type": "late_checkout",
              "shortLabel": "+1h checkout muộn",
              "label": "Thêm 1h checkout muộn (trả 11:00)",
              "effectiveTimeIso": "2026-11-21T11:00:00+07:00",
              "surchargeVnd": 60000,
              "available": true
            },
            {
              "hours": 2,
              "type": "late_checkout",
              "shortLabel": "+2h checkout muộn",
              "label": "Thêm 2h checkout muộn (trả 12:00)",
              "effectiveTimeIso": "2026-11-21T12:00:00+07:00",
              "surchargeVnd": 120000,
              "available": false,
              "unavailableReason": "TURNOVER_BUFFER_CONFLICT"
            }
          ]
        }
      }
    ]
  },
  "requestId": "6f9619ff-8b86-d011-b42d-00c04fc964ff"
}
```

---

### 1.2. `POST /api/guest/holds`
Khách bấm **"Đặt phòng ngay"** trên thẻ phòng -> Tạo giữ phòng trong **10 phút (`ttlSeconds = 600`)** và bắn thông báo Telegram `HOLD_CREATED` cho Quản lý.

#### Rate Limit
- **Tối đa 5 lượt tạo Hold / 10 phút / IP** (Ngăn chặn hành vi cố tình tạo giữ phòng ảo để khóa lịch đối thủ).

#### Request Body
```json
{
  "roomId": "sig-202",
  "bookingType": "overnight",
  "date": "2026-11-20",
  "overnightShift": "22-10",
  "earlyCheckinHours": 1,
  "lateCheckoutHours": 1,
  "numGuests": 2
}
```

#### Response `201 Created`
```json
{
  "ok": true,
  "data": {
    "holdId": "hld_01jh89f2a91bc7d",
    "roomId": "sig-202",
    "bookingType": "overnight",
    "checkinAt": "2026-11-20T21:00:00+07:00",
    "checkoutAt": "2026-11-21T11:00:00+07:00",
    "earlyCheckinHours": 1,
    "lateCheckoutHours": 1,
    "numGuests": 2,
    "status": "active",
    "expiresAt": "2026-11-08T12:45:00+07:00",
    "ttlSeconds": 600,
    "pricingPreview": {
      "basePrice": 620000,
      "earlyLateSurcharge": 120000,
      "extraGuestSurcharge": 0,
      "publicDiscount": 93000,
      "estimatedTotal": 647000
    }
  },
  "requestId": "..."
}
```

---

### 1.3. `POST /api/guest/promotions/preview`
Khi khách đang ở trang `/book/[holdId]` và nhập SĐT (nhận diện hạng hội viên và tích tem CDP) hoặc nhập mã giảm giá riêng tư `promotionCode`, API này tính toán bảng giá chi tiết ngay lập tức.

#### Request Body
```json
{
  "holdId": "hld_01jh89f2a91bc7d",
  "phone": "0906314109",
  "promotionCode": "BANBE100K",
  "numGuests": 2
}
```

#### Response `200 OK`
```json
{
  "ok": true,
  "data": {
    "cdpMember": {
      "recognized": true,
      "tier": "silver",
      "greeting": "Chào mừng khách hàng thân thiết hạng Silver quay trở lại Every Inn!",
      "stampRewardAvailable": {
        "milestoneStep": 8,
        "rewardValue": 100000,
        "label": "Thưởng tích tem mốc 8: Giảm 100.000đ"
      }
    },
    "appliedBenefit": {
      "source": "PROMOTION_CODE",
      "code": "BANBE100K",
      "name": "Ưu đãi Bạn Bè",
      "discountAmount": 100000
    },
    "pricing": {
      "basePrice": 620000,
      "promotionDiscount": 100000,
      "loyaltyDiscount": 0,
      "earlyLateSurcharge": 120000,
      "extraGuestSurcharge": 0,
      "holidaySurcharge": 0,
      "subtotal": 740000,
      "totalPrice": 640000
    }
  },
  "requestId": "..."
}
```
*(Ghi chú: $D_{\text{promo}}$ và $D_{\text{loyalty}}$ chỉ giảm trừ trên $P_{\text{base}}$ 620.000đ, không giảm trên phụ thu giờ 120.000đ).*

---

### 1.4. `PATCH /api/guest/holds/[id]`
Lưu thông tin đặt phòng của khách, chuyển Hold sang trạng thái `awaiting_payment`, sinh mã tham chiếu duy nhất `EIPAY...`, tạo URL VietQR MB Bank và báo Telegram cho Quản lý.

#### Request Body
```json
{
  "name": "Nguyễn Văn An",
  "phone": "0906314109",
  "socialChannel": "zalo",
  "socialHandle": "0906314109",
  "numGuests": 2,
  "promotionCode": "BANBE100K",
  "note": "Mình đến nhận phòng lúc 21h15 nhé"
}
```

#### Response `200 OK`
```json
{
  "ok": true,
  "data": {
    "holdId": "hld_01jh89f2a91bc7d",
    "status": "awaiting_payment",
    "expiresAt": "2026-11-08T12:45:00+07:00",
    "paymentReference": "EIPAY261108W9X4",
    "totalPrice": 640000,
    "bankTransfer": {
      "bankName": "MB Bank (Ngân hàng Quân Đội)",
      "bankBin": "970422",
      "accountNumber": "0906314109999",
      "accountHolder": "HO KINH DOANH EVERY INN",
      "amount": 640000,
      "transferContent": "EIPAY261108W9X4",
      "vietQrImageUrl": "https://img.vietqr.io/image/MB-0906314109999-compact2.png?amount=640000&addInfo=EIPAY261108W9X4&accountName=HO%20KINH%20DOANH%20EVERY%20INN"
    }
  },
  "requestId": "..."
}
```

---

### 1.5. `POST /api/guest/holds/[id]/notify-paid`
Khách bấm nút **"Tôi đã chuyển khoản"** sau khi quét mã VietQR. Hệ thống gửi tin nhắn tương tác khẩn cấp tới Telegram của Quản lý.

#### Rate Limit
- Tối đa 5 requests / phút / hold.

#### Request Body
```json
{
  "paymentReference": "EIPAY261108W9X4",
  "transferNote": "Mình vừa chuyển khoản từ Vietcombank"
}
```

#### Telegram Interactive Message Sent to Owner:
> 🚨 **[KHÁCH BÁO ĐÃ CHUYỂN KHOẢN — CẦN XÁC NHẬN]**
> ━━━━━━━━━━━━━━━━━━
> 🏠 **Phòng**: `202` (Signature)
> 🕒 **Loại**: Qua đêm (`22h-10h` | +1h sớm, +1h muộn)
> 📅 **Nhận**: `21:00 20/11/2026` → **Trả**: `11:00 21/11/2026`
> 👤 **Khách**: Nguyễn Văn An (`0906314109` · Zalo: `0906314109`)
> 💰 **Số tiền cần nhận**: **`640.000đ`**
> 🔖 **Nội dung CK**: `EIPAY261108W9X4`
> ━━━━━━━━━━━━━━━━━━
> 👇 *Bấm xác nhận ngay bên dưới để chốt đơn, lưu điểm CDP và chuẩn bị mã mở cửa cho khách:*
> - `[✅ Đã nhận đủ 640.000đ — Xác nhận ngay]` (`callback_data: "lpcf:hld_01jh89f2a91bc7d"`)
> - `[❌ Chưa nhận được tiền]` (`callback_data: "lprj:hld_01jh89f2a91bc7d"`)

---

### 1.6. `GET /api/guest/holds/[id]` (Near-Realtime Adaptive Short Polling)
Endpoint để trang `/book/[holdId]` kiểm tra trạng thái đơn theo thời gian thực (Adaptive Polling mỗi **3 – 4 giây** khi đang chờ Quản lý xác nhận).

#### Headers
- Hỗ trợ `ETag: W/"<hold-version>"`: Nếu trạng thái chưa đổi, trả về ngay `304 Not Modified` (< 1ms CPU).

#### Response `200 OK` (Khi Quản lý đã bấm xác nhận trên Telegram)
```json
{
  "ok": true,
  "data": {
    "holdId": "hld_01jh89f2a91bc7d",
    "status": "confirmed",
    "bookingId": "EI-20261120-K7Q2",
    "roomId": "202",
    "checkinAt": "2026-11-20T21:00:00+07:00",
    "checkoutAt": "2026-11-21T11:00:00+07:00",
    "paymentReference": "EIPAY261108W9X4",
    "checkinLookupRedirectUrl": "/checkin?ref=EIPAY261108W9X4&phone=0906314109"
  },
  "requestId": "..."
}
```

---

### 1.7. `POST /api/webhooks/banking` (Sẵn sàng SePay / Casso / PayOS)
Nhận biến động số dư tài khoản MB Bank `0906314109999` để tự động đối soát và kích hoạt đơn.

#### Request Headers & Body
- Header: `Authorization: Apikey <BANKING_WEBHOOK_SECRET>`
```json
{
  "id": "TXN-998877",
  "gateway": "MBBank",
  "transactionDate": "2026-11-08 12:43:15",
  "accountNumber": "0906314109999",
  "transferType": "in",
  "transferAmount": 640000,
  "content": "NGUYEN VAN AN chuyen tien EIPAY261108W9X4"
}
```

---

### 1.8. `POST /api/guest/checkin/lookup`
Xác thực **tối thiểu 2 khóa (Multi-Key Verification)** để trả về nội dung trang Hướng dẫn Check-in cá nhân hóa (`/checkin`).

#### Rate Limit
- **Tối đa 5 lần thử sai / 15 phút / IP** (Bảo vệ tuyệt đối mã khóa cửa trước các cuộc tấn công brute-force).

#### Request Body
```json
{
  "phone": "0906314109",
  "secondKeyType": "booking_or_payment_ref",
  "secondKeyValue": "EIPAY261108W9X4"
}
```

#### Response `200 OK`
```json
{
  "ok": true,
  "data": {
    "booking": {
      "id": "EI-20261120-K7Q2",
      "roomId": "202",
      "roomName": "Signature 202",
      "bookingType": "overnight",
      "checkinAt": "2026-11-20T21:00:00+07:00",
      "checkoutAt": "2026-11-21T11:00:00+07:00",
      "numGuests": 2,
      "guestNameMasked": "Nguyễn V** An"
    },
    "accessCodes": {
      "ready": true,
      "gateCode": "1234",
      "gateCodeFormatted": "1234#",
      "lockboxCode": "5678",
      "wifiSsid": "DGH",
      "wifiPassword": "0906314109"
    },
    "guideBlocks": {
      "step1MainText": "Every Inn - 69/24L1 Nguyễn Công Hoan, Phường Cầu Kiệu. Google Maps Every Inn: https://maps.app.goo.gl/CV7RM9akRpGEx8Ds8?g_st=ic - Khi đến đúng nhà như ảnh, bạn nhập PASS: 1234#- Phòng 202 - PASS hộp khoá lấy thẻ: 5678 Mở 2 cửa nhà bằng cách bấm EXIT cạnh cổng - Vui lòng giữ kĩ thẻ phòng khi ra ngoài, trường hợp làm mất sẽ chịu phí 200.000/thẻ.Đề phòng mất cắp LUÔN KHÓA CỔNG KHI RA VÀO.Quy Định PCCC và tránh những sự việc đáng tiếc mong các bạn vui lòng KHÔNG sử dụng vật dụng liên quan đến lửa, bắt lửa ( không hút thuốc, đốt nến...) và CẨN THẬN khi sử dụng điện.Tiết kiệm điện, bảo vệ hành tinh xanh: luôn TẮT ĐIỆN khi ra khỏi phòngWifi: DGH - Pass: 0906314109KHI CHECK-OUT bạn vui lòng để thẻ khoá vào hộp khoá, tắt điện như ban đầu nha- Nếu bạn có nhu cầu thêm giờ vui lòng nhắn ad ít nhất 60 phút trước giờ out để ad check lịch ạ. NỘI QUY Ở HIGHLIGHT BẠN XEM GIÚP AD NHA ^^Cảm ơn bạn nhiều.",
      "step1GoogleMapsUrl": "https://maps.app.goo.gl/CV7RM9akRpGEx8Ds8?g_st=ic",
      "step2Images": {
        "checkinImageUrl": "/checkin-guide/checkin-guide.jpg",
        "checkinImageAlt": "Hướng dẫn nhận phòng Every Inn",
        "checkoutImageUrl": "/checkin-guide/checkout-guide.jpg",
        "checkoutImageAlt": "Hướng dẫn trả phòng Every Inn"
      },
      "step3TaxiText": "Nếu bạn đi taxi hãy book xe đến 71/31 Nguyễn Công Hoan là đầu hẻm, và mình đi bộ vào khoảng 30m như clip hướng dẫn là đến ạ",
      "step3TaxiDropoffAddress": "71/31 Nguyễn Công Hoan, Phường Cầu Kiệu, Phú Nhuận, TP.HCM",
      "step4Video": {
        "videoUrl": "/checkin-guide/taxi-alley-guide.mp4",
        "posterUrl": "/checkin-guide/checkin-guide.jpg",
        "caption": "Video hướng dẫn đi ô tô/xe máy đến đầu hẻm 71/31 và đi bộ 30m vào nhà"
      }
    }
  },
  "requestId": "..."
}
```

---

### 1.9. Các Mã Lỗi Chuẩn Hóa Của Khách (Guest API Error Catalog)

Mọi phản hồi lỗi đều tuân thủ cấu trúc phong bì `CONVENTIONS.md` §10:

#### 1. Lỗi Chọn Ngày Vượt Quá Cửa Sổ Cho Phép (`422 Unprocessable Entity`)
Xảy ra khi khách cố tình tìm phòng hoặc tạo hold với ngày xa hơn `max_advance_days`:
```json
{
  "ok": false,
  "error": {
    "code": "ADVANCE_BOOKING_EXCEEDED",
    "message": "Hệ thống hiện chỉ mở nhận đặt phòng trước tối đa 90 ngày (đến hết ngày 2026-11-20). Vui lòng chọn ngày trong khoảng cho phép.",
    "details": {
      "maxAdvanceDays": 90,
      "maxAllowedDate": "2026-11-20",
      "requestedDate": "2026-12-01"
    }
  },
  "requestId": "req_01jh89f..."
}
```

#### 2. Lỗi Vượt Ngưỡng Giới Hạn Tần Suất (`429 Too Many Requests`)
Xảy ra khi một địa chỉ IP vượt quá hạn mức gọi API (vd: tìm kiếm > 30 req/phút):
```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Bạn đang thao tác quá nhanh. Vui lòng chờ 30 giây trước khi thử lại.",
    "details": {
      "retryAfterSeconds": 30
    }
  },
  "requestId": "req_01jh89f..."
}
```

#### 3. Lỗi Phòng Đã Bị Giữ Hoặc Đóng Bán (`409 Conflict`)
Xảy ra khi phòng vừa được khách khác đặt, bị vướng buffer 60 phút dọn phòng hoặc Admin vừa bật Stop-Sell:
```json
{
  "ok": false,
  "error": {
    "code": "ROOM_UNAVAILABLE",
    "message": "Phòng bạn chọn vừa có khách khác giữ chỗ hoặc đang trong thời gian bảo trì/dọn dẹp. Vui lòng chọn phòng khác.",
    "details": {
      "roomId": "sig-202",
      "reason": "STOP_SELL_OR_SLOT_OCCUPIED"
    }
  },
  "requestId": "req_01jh89f..."
}
```

---

## 2. Internal Admin OTA Calendar & Pricing Endpoints (`everyinn-booking-core`)

Các API này phục vụ giao diện Quản trị Extranet (`everyinn-admin`) và Telegram Bot qua Service Binding (`x-ei-caller: admin-bff` hoặc `x-ei-caller: agent-core`):

---

### 2.1. `GET /internal/v1/calendar/matrix`
Lấy ma trận trạng thái phòng, giá bán và các cờ Stop-Sell theo từng ngày trong một khoảng thời gian.

#### Query Parameters
- `propertyId`: `everyinn-phunhuan` (bắt buộc)
- `startDate`: `YYYY-MM-DD` (mặc định: hôm nay)
- `endDate`: `YYYY-MM-DD` (mặc định: hôm nay + 30 ngày)

#### Response `200 OK`
```json
{
  "ok": true,
  "data": {
    "propertyId": "everyinn-phunhuan",
    "startDate": "2026-11-08",
    "endDate": "2026-11-22",
    "maxAdvanceDays": 90,
    "maxAdvanceDateAllowed": "2027-02-06",
    "rooms": [
      {
        "roomId": "sig-202",
        "roomName": "Signature 202",
        "roomClass": "signature",
        "dates": {
          "2026-11-20": {
            "date": "2026-11-20",
            "isWithinAdvanceWindow": true,
            "isStopSell": false,
            "occupancyStatus": "vacant",
            "baseRates": {
              "hourly_combo3h": 360000,
              "overnight_standard": 620000,
              "daily_standard": 750000
            },
            "activeOverrides": [
              {
                "id": "ovr_01jh789abc",
                "ratePlanCode": "overnight_standard",
                "customBasePrice": 580000,
                "note": "Giảm giá kích cầu đêm Thứ 6"
              }
            ]
          }
        }
      }
    ]
  },
  "requestId": "..."
}
```

---

### 2.2. `POST /internal/v1/calendar/rate-overrides`
Tạo hoặc cập nhật giá bán cơ bản tùy chỉnh cho 1 ngày hoặc một khoảng ngày (Dynamic Rate Override). Giá này sẽ ghi đè $P_{\text{base}}$ trong Core Pricing v2.0.

#### Request Body
```json
{
  "propertyId": "everyinn-phunhuan",
  "roomClass": "signature",
  "roomId": null,
  "ratePlanCode": "overnight_standard",
  "startDate": "2026-11-20",
  "endDate": "2026-11-21",
  "customBasePrice": 580000,
  "note": "Ưu đãi Flash Sale cuối tuần"
}
```

#### Response `200 OK`
```json
{
  "ok": true,
  "data": {
    "createdCount": 2,
    "overrideIds": ["ovr_01jh789abc", "ovr_01jh789abd"],
    "ratePlanCode": "overnight_standard",
    "customBasePrice": 580000
  },
  "requestId": "..."
}
```

---

### 2.3. `DELETE /internal/v1/calendar/rate-overrides/:id`
Xóa hoặc vô hiệu hóa (`is_active = 0`) một bản ghi override, khôi phục giá niêm yết gốc.

#### Response `200 OK`
```json
{
  "ok": true,
  "data": {
    "id": "ovr_01jh789abc",
    "restoredRatePlanCode": "overnight_standard",
    "defaultBasePrice": 620000
  },
  "requestId": "..."
}
```

---

### 2.4. `POST /internal/v1/room-blocks/stop-sell`
Chủ động Đóng bán (Stop-Sell) hoặc chặn phòng bảo trì/chủ ở trong 1 ngày, nhiều ngày hoặc khung giờ cụ thể.

#### Request Body
```json
{
  "propertyId": "everyinn-phunhuan",
  "roomIds": ["sig-202"],
  "blockType": "stop_sell",
  "startDate": "2026-11-25",
  "endDate": "2026-11-26",
  "reason": "Chủ nhà giữ phòng tiếp bạn thân"
}
```

#### Response `200 OK`
```json
{
  "ok": true,
  "data": {
    "blockId": "blk_01jh999xyz",
    "roomIds": ["sig-202"],
    "blockType": "stop_sell",
    "status": "active"
  },
  "requestId": "..."
}
```

---

### 2.5. `DELETE /internal/v1/room-blocks/:id`
Mở bán lại phòng (Re-open room) bằng cách xóa/hủy Room Block tương ứng.

#### Response `200 OK`
```json
{
  "ok": true,
  "data": {
    "blockId": "blk_01jh999xyz",
    "status": "unblocked",
    "message": "Phòng đã được mở bán lại trên toàn hệ thống."
  },
  "requestId": "..."
}
```

---

### 2.6. `GET /internal/v1/booking-configs` & `PATCH /internal/v1/booking-configs`
Tra cứu và cấu hình tham số Cửa Sổ Nhận Đặt Trước Luân Phiên (`max_advance_days`).

#### Request Body (`PATCH`)
```json
{
  "propertyId": "everyinn-phunhuan",
  "maxAdvanceDays": 90
}
```

#### Response `200 OK`
```json
{
  "ok": true,
  "data": {
    "propertyId": "everyinn-phunhuan",
    "maxAdvanceDays": 90,
    "description": "Nhận đặt phòng trước tối đa 3 tháng (90 ngày)",
    "currentMaxAllowedDate": "2027-02-06",
    "turnoverMinutes": 60
  },
  "requestId": "..."
}
```
