# 08. Hồ Sơ Kỹ Thuật & Cấu Hình Tự Động Hóa Meta Business Suite

Tài liệu này lưu trữ nguyên vẹn các thiết lập hệ thống, luồng tự động hóa và nguồn dữ liệu ngoại vi đã cấu hình thực tế trong **Meta Business Suite** của Every Inn:

---

## 1. Trạng Thái Vận Hành Của Meta Business Agent

- **Nền tảng**: Meta Business Agent (Tác nhân Trí tuệ Nhân tạo chính thức của Meta).
- **Trạng thái**: **ĐANG BẬT** (`AI đang bật` & `Tính năng tái tương tác: BẬT`).
- **Kênh áp dụng**: **Messenger** và **Instagram Direct**.
- **Đối tượng phản hồi**: "Mọi người" (AI tự động phản hồi đoạn chat mới và đoạn chat hiện có nhưng đã không hoạt động trong ít nhất 2 ngày).
- **Lịch hoạt động**: "Luôn phản hồi" (24/7).
- **Theo dõi hoạt động**: BẬT tự động ghi nhận hoạt động (activity tracking) khi có tin nhắn liên quan đến đơn đặt phòng và khách hàng tiềm năng.

---

## 2. Nguồn Dữ Liệu Ngoại Vi Đã Kết Nối (External Data Sources)

### 2.1. Google Drive (Đồng bộ Bảng Lịch Phòng)
- **Tài khoản**: Đã kết nối với Google Account của Admin Every Inn.
- **File liên kết**: **`CHECK LỊCH PHÒNG TRỐNG`** (Google Sheets).
- **Tần suất đồng bộ**: Tự động đồng bộ mỗi **12 giờ**.
- **Chức năng**: Cung cấp dữ liệu phòng trống cho Agent đối soát.

### 2.2. Lịch Hẹn Meta (Meta Calendar)
- **Tính năng**: "Để AI đặt lịch hẹn".
- **Loại cuộc hẹn**: **`Đặt phòng lưu trú`** (Thời lượng: 30 phút).
- **Dữ liệu AI thu thập tự động từ khách**:
  1. Tên khách hàng (Full Name)
  2. Địa chỉ Email
  3. Số lượng người ở
  4. Hạng phòng mong muốn (Haven / Signature)
  5. Hình thức lưu trú (Theo giờ / Qua đêm / Theo ngày / Thuê tháng)

---

## 3. Cấu Hình Tự Động Hóa Hộp Thư (Inbox Automations)

### 3.1. Tin Nhắn Vắng Mặt (Away Message)
- **Trạng thái**: **ĐANG BẬT**.
- **Khung giờ tự động gửi**: Hàng ngày từ **`01:30` đến `07:15` sáng** (Giờ Việt Nam - GMT+7).
- **Nội dung nguyên bản**:
```text
Cảm ơn bạn đã ghé thăm Every Inn Saigon- Homestay and Livingspace. Đội ngũ Admin hiện đang nghỉ ngơi để chuẩn bị cho ngày mới! Nếu có vấn đề gấp khi lưu trú, hãy gọi hotline trong tin nhắn đặt phòng.

Xem trước thông tin phòng: https://beacons.ai/everyinn.homestaysg/, và đừng quên để lại tên phòng và thông tin check-in/out + số người ở. Chúng mình sẽ nhắn lại cho bạn ngay vào ca sáng nhé. Chúc bạn một ngày an lành! 😘
```

### 3.2. Tự Động Gửi Vị Trí Thông Minh (Smart Reply Location)
- **Trạng thái**: **ĐANG BẬT**.
- **Điều kiện kích hoạt**: Gửi tự động khi khách hỏi về vị trí và đoạn chat đã không hoạt động tối thiểu 30 phút.
- **Nội dung nguyên bản**:
```text
Dạ chào [Tên khách], Every Inn nằm trên 1 con hẻm thoáng tại khu Phan Xích Long, quận Phú Nhuận cũ. Mọi người thường chọn vị trí này vì sự tiện lợi Trung tâm: đi Tân Định - Q1 chỉ cách 5 phút, đi sân bay chỉ khoảng 20p,… 

📌 Every Inn - 69/24L1 Nguyễn Công Hoan, Phường Cầu Kiệu. 
📍 Google Maps Every Inn: https://maps.app.goo.gl/CV7RM9akRpGEx8Ds8?g_st=ic 

Anh chị check thêm GGmaps vị trí này và cho home xin thêm thời gian dự định checkin-checkout để tư vấn thêm nhen🌿
```

### 3.3. Tin Trả Lời Nhanh (Instant Reply) & Từ Khóa Cố Định
- Không cấu hình trong mục Automation truyền thống dạng template tĩnh, vì toàn bộ phần chào hỏi và tư vấn kịch bản được ủy quyền hoàn toàn cho **Meta Business Agent** điều phối 24/7 theo 11 Custom Instructions.
