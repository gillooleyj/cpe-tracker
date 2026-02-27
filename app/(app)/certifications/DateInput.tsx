"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";

type Props = {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  hasError?: boolean;
};

function parse(v: string) {
  if (!v) return { m: "", d: "", y: "" };
  const [year, month, day] = v.split("-");
  return {
    m: month ? String(parseInt(month, 10)) : "",
    d: day ? String(parseInt(day, 10)) : "",
    y: year || "",
  };
}

export default function DateInput({ value, onChange, hasError }: Props) {
  const init = parse(value);
  const [month, setMonth] = useState(init.m);
  const [day, setDay] = useState(init.d);
  const [year, setYear] = useState(init.y);

  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  // Prevents the useEffect from overwriting internal state after our own onChange
  const skipSync = useRef(false);

  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    const { m, d, y } = parse(value);
    setMonth(m);
    setDay(d);
    setYear(y);
  }, [value]);

  function emit(m: string, d: string, y: string) {
    skipSync.current = true;
    if (m && d && y.length === 4) {
      onChange(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    } else {
      onChange("");
    }
  }

  function handleMonthChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    let val = digits;
    if (digits.length === 2) {
      const n = parseInt(digits, 10);
      if (n < 1) val = "01";
      else if (n > 12) val = "12";
    }
    setMonth(val);
    emit(val, day, year);

    // Advance when 2 digits entered, or first digit > 1 (months 2–9 are unambiguously complete)
    if (val.length === 2 || (val.length === 1 && parseInt(val, 10) > 1)) {
      dayRef.current?.focus();
      requestAnimationFrame(() =>
        dayRef.current?.setSelectionRange(0, dayRef.current!.value.length)
      );
    }
  }

  function handleDayChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    let val = digits;
    if (digits.length === 2) {
      const n = parseInt(digits, 10);
      if (n < 1) val = "01";
      else if (n > 31) val = "31";
    }
    setDay(val);
    emit(month, val, year);

    // Advance when 2 digits entered, or first digit > 3 (days 4–9 are unambiguously complete)
    if (val.length === 2 || (val.length === 1 && parseInt(val, 10) > 3)) {
      yearRef.current?.focus();
      requestAnimationFrame(() =>
        yearRef.current?.setSelectionRange(0, yearRef.current!.value.length)
      );
    }
  }

  function handleYearChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    setYear(digits);
    emit(month, day, digits);
  }

  function handleDayKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (
      e.key === "Backspace" &&
      e.currentTarget.selectionStart === 0 &&
      e.currentTarget.selectionEnd === 0
    ) {
      e.preventDefault();
      monthRef.current?.focus();
      requestAnimationFrame(() => {
        if (monthRef.current) {
          const len = monthRef.current.value.length;
          monthRef.current.setSelectionRange(len, len);
        }
      });
    }
  }

  function handleYearKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (
      e.key === "Backspace" &&
      e.currentTarget.selectionStart === 0 &&
      e.currentTarget.selectionEnd === 0
    ) {
      e.preventDefault();
      dayRef.current?.focus();
      requestAnimationFrame(() => {
        if (dayRef.current) {
          const len = dayRef.current.value.length;
          dayRef.current.setSelectionRange(len, len);
        }
      });
    }
  }

  const seg =
    "bg-transparent outline-none text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-center min-w-0";

  return (
    <div className={`flex items-center w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:border-transparent cursor-text ${hasError ? "border-red-400 dark:border-red-500 focus-within:ring-red-400 dark:focus-within:ring-red-500" : "border-gray-300 dark:border-gray-600 focus-within:ring-blue-900 dark:focus-within:ring-blue-500"}`}>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        value={month}
        onChange={(e) => handleMonthChange(e.target.value)}
        placeholder="MM"
        maxLength={2}
        autoComplete="off"
        name="date-month-field"
        data-form-type="other"
        data-lpignore="true"
        className={seg}
        style={{ width: "2.5ch" }}
      />
      <span className="text-gray-300 dark:text-gray-500 select-none mx-0.5">/</span>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        value={day}
        onChange={(e) => handleDayChange(e.target.value)}
        onKeyDown={handleDayKeyDown}
        placeholder="DD"
        maxLength={2}
        autoComplete="off"
        name="date-day-field"
        data-form-type="other"
        data-lpignore="true"
        className={seg}
        style={{ width: "2.5ch" }}
      />
      <span className="text-gray-300 dark:text-gray-500 select-none mx-0.5">/</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        value={year}
        onChange={(e) => handleYearChange(e.target.value)}
        onKeyDown={handleYearKeyDown}
        placeholder="YYYY"
        maxLength={4}
        autoComplete="off"
        name="date-year-field"
        data-form-type="other"
        data-lpignore="true"
        className={seg}
        style={{ width: "4.5ch" }}
      />
    </div>
  );
}
