# 03. Biểu Giá, Gói Thuê & Quy Tắc Tính Chi Tiết (Meta Knowledge Base)

Toàn bộ biểu giá và thuật toán tính giá dưới đây được trích xuất trực tiếp từ Knowledge Base và 10 câu hỏi thường gặp (FAQs) của Meta Business Agent.

> [!IMPORTANT]
> **Nguồn giá chính thức = Booking Core** (`rate_rules`, `surcharge_rules`, `promotions`, tính qua `POST /internal/v1/quotes`). Bảng dưới chỉ để tham khảo tư vấn. AI Lễ Tân **luôn báo giá bằng tool `get_price_quote`**, không tự nhẩm. Đối chiếu với Core & chủ homestay ngày 2026-11-03: **không còn Combo 6h**, **Haven qua đêm 520k (không có giá cuối tuần riêng)**, **phụ thu khách thứ 3–4: 150.000đ/người/đêm, áp dụng mọi phòng Signature**.

---

## 1. Bảng Giá Chuẩn Niêm Yết

| Hạng phòng | Combo 3 Giờ | Gói Qua Đêm (12 tiếng) | Gói Phòng Ngày (21 tiếng) |
| :--- | :---: | :---: | :---: |
| **HAVEN (101, 201, 301)** | **320.000 đ** | **520.000 đ** | **620.000 đ** |
| **SIGNATURE (102, 202, 302)** | **360.000 đ** | **620.000 đ** | **750.000 đ** |
| **Giờ tiếp theo phát sinh** | **`60.000 đ / giờ`** | **`60.000 đ / giờ`** | **`60.000 đ / giờ`** |

*Ghi chú: Giá áp dụng cho tiêu chuẩn 2 người/phòng. Khách thêm (chỉ nhận tại Signature) phụ thu `150.000 đ / người / đêm` (tối đa 4 khách/phòng Signature; Haven tối đa 2 khách).*

---

## 2. Quy Tắc Tính Chi Phí Thuê Theo Giờ (FAQ 8 Meta Agent)

1. **Khởi điểm từ Combo 3h**: Mọi đơn thuê theo giờ có thời lượng tối thiểu là 3 tiếng.
2. **Quy tắc làm tròn giờ (Round-up)**:
   - Bước tính giá là **1 tiếng**.
   - Nếu thời gian khách đặt là 3 tiếng 30 phút $\rightarrow$ làm tròn thành 4 tiếng (tính giá Combo 3h + 1 giờ thêm = `+60k`). Tương tự cho 4 tiếng và 5 tiếng.
   - Các khung giờ lẻ (ví dụ khách cần đặt từ `10h30` đến `13h30`) $\rightarrow$ sẽ tính giá từ `10:00` đến `14:00` (4 tiếng). Cần thông báo cho khách và nhắn khách có thể chọn lại khung giờ chẵn phù hợp nếu muốn.
3. **Mốc từ 6 tiếng trở lên** *(Combo 6h đã ngưng bán từ 10/2026)*:
   - Tính **Combo 3h + số giờ thêm** (`60k/h`), ví dụ 6 tiếng = Combo 3h + 3 giờ thêm. Nếu khách ở dài, gợi ý so sánh với gói Phòng Ngày / Qua Đêm.
4. **Khoảng đệm Check-in sớm / Check-out muộn miễn phí**:
   - **Check-out**: Home rất sẵn lòng đợi khách chuẩn bị thêm **tối đa 15 phút sau giờ check-out mà không tính phụ phí**. Từ sau 15 phút trở đi sẽ áp dụng phụ phí 1 giờ (`60.000 đ`).
   - **Check-in**: Home sẵn lòng đón khách đến check-in sớm khoảng **10 – 15 phút trước giờ nhận phòng** trong điều kiện phòng đã được dọn trống sớm.

---

## 3. Quy Tắc Check-in Theo Giờ Sau 22H (Rule 8 Meta Agent)

> [!CAUTION]
> **Quy định bất biến cho khách hỏi thuê giờ đêm khuya:**  
> Khi khách hàng hỏi check-in theo giờ cho **khung giờ từ 22:00 trở đi**:  
> - **KHÔNG ĐƯỢC đề xuất các gói combo theo giờ**.  
> - **Trả lời trực tiếp** rằng: *Từ 22:00 sẽ được tính là gói Qua Đêm, được dời đủ 12 tiếng cho bạn qua đêm và kết thúc không quá 12:00 trưa hôm sau*.  
> - Các ca dời qua đêm linh hoạt: `21h – 9h`, `22h – 10h`, `23h – 11h`, hoặc trễ nhất là `00h – 12h` trưa hôm sau.

---

## 4. Bảng Giá Thuê Dài Hạn Theo Tháng (> 20 Ngày) (FAQ 5 Meta Agent)

Áp dụng cho khách hàng có nhu cầu công tác dài ngày hoặc Co-living từ **20 ngày trở lên**:

| Hạng phòng | Đơn giá / đêm | Tổng chi phí / tháng (30 ngày) | Quyền lợi trọn gói đã bao gồm |
| :--- | :---: | :---: | :--- |
| **Haven 301** (Lầu 3) | **360.000 đ / đêm** | ~10.800.000 đ | • Điện, nước sinh hoạt miễn phí<br>• Dọn phòng & thay drap 2 lần/tuần<br>• Giặt sấy đồ chung miễn phí<br>• Wifi riêng từng tầng, an ninh 24/7<br>• Phí quản lý, rác, VAT<br>• **1 chỗ để xe máy miễn phí** |
| **Haven 101, 201** | **390.000 đ / đêm** | ~11.700.000 đ |
| **Signature (102, 202, 302)** | **490.000 đ / đêm** | ~14.700.000 đ |

---

## 5. Các Chương Trình Ưu Đãi Hiện Hành (FAQ 2 Meta Agent)

1. **Ưu đãi ngày trong tuần**:
   - Giảm giá **10%** cho tất cả booking tại hạng Haven (không áp dụng Thứ 7).
   - Giảm giá **15%** cho tất cả booking tại hạng Signature (không áp dụng Thứ 7).
   - Hoặc giảm **20%** theo các đợt chiến dịch ngày thường (Chủ Nhật đến Thứ Năm).
2. **Deal Cuối tuần Đặt 2 Đêm**:
   - Đặt từ 2 đêm (2 phòng ngày) vào **Thứ 6 – Thứ 7: Giảm ngay `100.000 đ`** trên tổng hóa đơn.
