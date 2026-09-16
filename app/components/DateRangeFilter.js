"use client";

import { useEffect, useRef, useState } from "react";

const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIso(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatLabel(from, to) {
  const fmt = (iso) =>
    parseIso(iso)?.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  if (!from && !to) return "Date";
  if (from && to && from === to) return fmt(from);
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `From ${fmt(from)}`;
  return `Until ${fmt(to)}`;
}

function daysInView(view) {
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(toIso(new Date(year, month, day)));
  }
  return cells;
}

function shiftMonth(view, by) {
  return new Date(view.getFullYear(), view.getMonth() + by, 1);
}

function inRange(iso, start, end) {
  if (!start || !end) return false;
  return iso >= start && iso <= end;
}

export default function DateRangeFilter({ from, to, onChange, label = "", variant = "button", maxDate = "" }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(from || "");
  const [end, setEnd] = useState(to || "");
  const [view, setView] = useState(() => parseIso(from) || new Date());

  useEffect(() => {
    setStart(from || "");
    setEnd(to || "");
  }, [from, to]);

  useEffect(() => {
    if (!open) return undefined;

    function onPointer(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function pickDay(iso) {
    if (!start || (start && end)) {
      setStart(iso);
      setEnd("");
      return;
    }
    if (iso < start) {
      setEnd(start);
      setStart(iso);
      return;
    }
    setEnd(iso);
  }

  function applyPreset(kind) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (kind === "today") {
      const iso = toIso(today);
      setStart(iso);
      setEnd(iso);
      setView(today);
      return;
    }
    if (kind === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const iso = toIso(y);
      setStart(iso);
      setEnd(iso);
      setView(y);
      return;
    }
    if (kind === "7") {
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
      setStart(toIso(startDate));
      setEnd(toIso(today));
      setView(today);
      return;
    }
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    setStart(toIso(monthStart));
    setEnd(toIso(today));
    setView(today);
  }

  function apply() {
    onChange({ from: start, to: end || start });
    setOpen(false);
  }

  function clear() {
    setStart("");
    setEnd("");
    onChange({ from: "", to: "" });
    setOpen(false);
  }

  const cells = daysInView(view);
  const title = view.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const selected = Boolean(from || to);

  const isField = variant === "field";

  function openPicker() {
    setOpen(true);
  }

  return (
    <div className={`admin-date-wrap${isField ? " is-field" : ""}`} ref={wrapRef}>
      {label ? <span className="admin-date-label">{label}</span> : null}
      <button
        className={`${isField ? "admin-date-input-like" : "admin-date-btn"}${open || selected ? " is-active" : ""}`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
      >
        <span className="admin-date-input-text">{formatLabel(from, to)}</span>
        <CalendarIcon />
      </button>

      {open ? (
        <>
          <button className="admin-date-backdrop" type="button" onClick={() => setOpen(false)} />
          <div className="admin-date-pop">
          <div className="admin-date-presets">
            <button type="button" onClick={() => applyPreset("today")}>
              Today
            </button>
            <button type="button" onClick={() => applyPreset("yesterday")}>
              Yesterday
            </button>
            <button type="button" onClick={() => applyPreset("7")}>
              Last 7 days
            </button>
            <button type="button" onClick={() => applyPreset("month")}>
              This month
            </button>
          </div>

          <div className="admin-cal-head">
            <button type="button" onClick={() => setView(shiftMonth(view, -1))} aria-label="Previous month">
              ‹
            </button>
            <strong>{title}</strong>
            <button type="button" onClick={() => setView(shiftMonth(view, 1))} aria-label="Next month">
              ›
            </button>
          </div>

          <div className="admin-cal-week">
            {WEEK.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="admin-cal-grid">
            {cells.map((iso, index) => {
              if (!iso) return <span key={`e-${index}`} />;
              const isStart = iso === start;
              const isEnd = iso === (end || start);
              const ranged = inRange(iso, start, end || start);
              const isFuture = maxDate && iso > maxDate;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`admin-cal-day${isStart || isEnd ? " is-picked" : ""}${ranged ? " is-range" : ""}${isFuture ? " is-disabled" : ""}`}
                  disabled={isFuture}
                  onClick={() => !isFuture && pickDay(iso)}
                >
                  {Number(iso.slice(-2))}
                </button>
              );
            })}
          </div>

          <p className="admin-cal-hint">
            {start && end ? `${formatLabel(start, end)}` : start ? "Pick an end date" : "Pick a start date"}
          </p>

          <div className="admin-date-actions">
            <button className="admin-reset-btn" type="button" onClick={clear}>
              Clear
            </button>
            <button className="admin-btn" type="button" disabled={!start} onClick={apply}>
              Apply
            </button>
          </div>
        </div>
        </>
      ) : null}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3a1 1 0 0 1 1 1v1h8V4a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a1 1 0 0 1 1-1Zm12 8H5v8h14v-8Z"
      />
    </svg>
  );
}
