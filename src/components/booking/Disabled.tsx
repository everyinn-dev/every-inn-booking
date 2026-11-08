/** Shown while WEB_BOOKING_ENABLED=false (production until the owner approves — R6). */
export default function BookingDisabled() {
  return (
    <main className="bk-page">
      <div className="bk-wrap" style={{ maxWidth: 520 }}>
        <div className="bk-card bk-empty">
          <p className="bk-strong">Đặt phòng online sắp mở</p>
          <p className="bk-sub">Trong lúc chờ, bạn nhắn Home qua Instagram để được giữ phòng nhanh nhất nhé.</p>
          <a className="bk-btn bk-btn-primary" style={{ marginTop: 12 }} href="https://www.instagram.com/everyinn.home/" target="_blank" rel="noopener noreferrer">
            Nhắn Instagram
          </a>
        </div>
      </div>
    </main>
  );
}
