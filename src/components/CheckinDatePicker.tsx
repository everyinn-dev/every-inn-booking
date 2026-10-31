'use client';

import React, { useRef, useId, useSyncExternalStore } from 'react';
import { CalendarIcon } from './Icons';

interface CheckinDatePickerProps {
  id?: string;
  selectedDate: Date;
  onChange: (newDate: Date) => void;
  theme?: 'dark' | 'light';
  label?: string;
  showShortcuts?: boolean;
  className?: string;
}

const VI_DAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const formatYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const isSameDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const emptySubscribe = () => () => {};

export default function CheckinDatePicker({
  id: customId,
  selectedDate,
  onChange,
  theme = 'light',
  label = 'Nhận phòng',
  showShortcuts = true,
  className = '',
}: CheckinDatePickerProps) {
  const autoId = useId();
  const inputId = customId || `checkin-date-${autoId}`;
  const inputRef = useRef<HTMLInputElement>(null);

  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const now = new Date();
  const todayStr = formatYMD(now);
  const selectedStr = formatYMD(selectedDate);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  // Tính Thứ 7 gần nhất
  const saturday = new Date(now);
  const dayOfWeek = now.getDay();
  const daysUntilSat = (6 - dayOfWeek + 7) % 7;
  saturday.setDate(now.getDate() + (daysUntilSat === 0 ? 7 : daysUntilSat));

  const isToday = isSameDate(selectedDate, now);
  const isTomorrow = isSameDate(selectedDate, tomorrow);
  const isSaturday = isSameDate(selectedDate, saturday);

  const dayName = VI_DAYS[selectedDate.getDay()];
  const dd = String(selectedDate.getDate()).padStart(2, '0');
  const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const yyyy = selectedDate.getFullYear();
  const displayFormatted = `${dayName}, ${dd}/${mm}/${yyyy}`;

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onChange(new Date());
      return;
    }
    const [y, m, d] = val.split('-').map(Number);
    onChange(new Date(y, m - 1, d));
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Trên desktop browsers (Chrome, Edge, Firefox, macOS Safari), gọi showPicker() khi click trực tiếp
    if (typeof e.currentTarget.showPicker === 'function') {
      try {
        e.currentTarget.showPicker();
      } catch {
        // Fallback tự nhiên nếu browser chặn hoặc không hỗ trợ
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && typeof e.currentTarget.showPicker === 'function') {
      try {
        e.currentTarget.showPicker();
      } catch {
        // ignore
      }
    }
  };

  const selectPreset = (d: Date) => {
    onChange(d);
  };

  return (
    <div className={`ab-picker-root ${theme === 'dark' ? 'theme-dark' : 'theme-light'} ${className}`}>
      <label
        htmlFor={inputId}
        className="ab-picker-card"
        title="Nhấn để chọn ngày nhận phòng"
      >
        <div className="ab-picker-content">
          <span className="ab-picker-micro-label">{label}</span>
          <div className="ab-picker-value-wrap" suppressHydrationWarning>
            <span className="ab-picker-value">{displayFormatted}</span>
            {isClient && (
              <>
                {isToday && <span className="ab-picker-pill is-today">Hôm nay</span>}
                {isTomorrow && <span className="ab-picker-pill is-tomorrow">Ngày mai</span>}
              </>
            )}
          </div>
        </div>

        <div className="ab-picker-icon-box" aria-hidden="true">
          <CalendarIcon size={18} />
        </div>

        {/* Native picker overlay - handles real physical tap directly on iOS Safari & Android, plus desktop */}
        <input
          ref={inputRef}
          type="date"
          id={inputId}
          value={selectedStr}
          min={todayStr}
          className="ab-picker-native-input"
          onChange={handleDateChange}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          aria-label={`Chọn ngày nhận phòng, ngày hiện tại là ${displayFormatted}`}
        />
      </label>

      {showShortcuts && (
        <div className="ab-picker-shortcuts" role="toolbar" aria-label="Phím tắt chọn ngày nhanh">
          <button
            type="button"
            className={`ab-shortcut-btn ${isToday ? 'is-active' : ''}`}
            onClick={() => selectPreset(new Date())}
          >
            Hôm nay
          </button>
          <button
            type="button"
            className={`ab-shortcut-btn ${isTomorrow ? 'is-active' : ''}`}
            onClick={() => selectPreset(tomorrow)}
          >
            Ngày mai
          </button>
          <button
            type="button"
            className={`ab-shortcut-btn ${isSaturday ? 'is-active' : ''}`}
            onClick={() => selectPreset(saturday)}
          >
            Thứ 7 này
          </button>
        </div>
      )}
    </div>
  );
}
