'use client';

import React, { useRef, useId, useState, useEffect } from 'react';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleContainerClick = () => {
    if (inputRef.current) {
      if ('showPicker' in HTMLInputElement.prototype) {
        try {
          inputRef.current.showPicker();
        } catch {
          inputRef.current.focus();
        }
      } else {
        inputRef.current.focus();
      }
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      onChange(new Date());
      return;
    }
    const [y, m, d] = val.split('-').map(Number);
    onChange(new Date(y, m - 1, d));
  };

  const selectPreset = (d: Date) => {
    onChange(d);
  };

  return (
    <div className={`ab-picker-root ${theme === 'dark' ? 'theme-dark' : 'theme-light'} ${className}`}>
      <div
        className="ab-picker-card"
        onClick={handleContainerClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleContainerClick();
          }
        }}
        aria-label={`Chọn ngày nhận phòng, ngày hiện tại là ${displayFormatted}`}
      >
        <div className="ab-picker-content">
          <span className="ab-picker-micro-label">{label}</span>
          <div className="ab-picker-value-wrap" suppressHydrationWarning>
            <span className="ab-picker-value">{displayFormatted}</span>
            {mounted && (
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

        {/* Hidden accessible native picker */}
        <input
          ref={inputRef}
          type="date"
          id={inputId}
          value={selectedStr}
          min={todayStr}
          className="ab-picker-native-input"
          onChange={handleDateChange}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

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
