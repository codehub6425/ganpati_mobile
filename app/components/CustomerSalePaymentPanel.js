"use client";

import { useMemo, useState } from "react";
import { formatAdminDateFromIso } from "@/lib/format";
import { resolveDueDateFromPreset } from "@/lib/customer-dues-shared.js";

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return String(Math.round(x));
}

const MODES = [
  { id: "full", label: "Full pay", short: "Full" },
  { id: "partial", label: "Partial", short: "Partial" },
  { id: "later", label: "Pay later", short: "Later" },
  { id: "advance", label: "Advance", short: "Advance" },
];

const PRESETS = [
  { id: "in_7_days", label: "7 days" },
  { id: "in_15_days", label: "15 days" },
  { id: "next_month_7th", label: "7th next mo." },
  { id: "custom", label: "Pick date" },
];

export default function CustomerSalePaymentPanel({
  billTotal,
  bookDateIso,
  value,
  onChange,
  compact = false,
  onNeedCustomer,
}) {
  const mode = value?.payment_mode || "full";
  const [expanded, setExpanded] = useState(mode !== "full");

  const received = useMemo(() => {
    if (mode === "full") return billTotal;
    if (mode === "later") return 0;
    const n = Number(String(value?.amount_received ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [mode, billTotal, value?.amount_received]);

  const balance = Math.max(0, Math.round((billTotal - received) * 100) / 100);
  const showDueSchedule = balance > 0.009 && mode !== "advance";

  const duePreview = useMemo(() => {
    if (!showDueSchedule || !bookDateIso) return "";
    if (value?.due_preset === "custom") return value?.custom_due_date || "";
    return resolveDueDateFromPreset(value?.due_preset || "in_7_days", bookDateIso, value?.custom_due_date);
  }, [showDueSchedule, bookDateIso, value?.due_preset, value?.custom_due_date]);

  const dueLabel =
    duePreview ?
      formatAdminDateFromIso(duePreview, { day: "numeric", month: "short", year: "numeric" })
    : "";

  function setMode(next) {
    if (next !== "full") {
      onNeedCustomer?.();
      setExpanded(true);
    }
    onChange({
      ...value,
      payment_mode: next,
      amount_received:
        next === "full" ? String(billTotal)
        : next === "later" ? "0"
        : value?.amount_received || "",
    });
  }

  const modeLabel = MODES.find((m) => m.id === mode)?.short || "Full";

  if (mode === "full" && !expanded) {
    return (
      <div className={`customer-sale-payment is-collapsed${compact ? " is-compact" : ""}`}>
        <div className="customer-sale-payment-summary-row">
          <span className="customer-sale-payment-summary-label">Payment</span>
          <span className="customer-sale-payment-summary-value">
            Full pay · <strong>₹{formatMoney(billTotal)}</strong>
          </span>
          <button type="button" className="customer-sale-payment-change" onClick={() => setExpanded(true)}>
            Udhaar / partial
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`customer-sale-payment${compact ? " is-compact" : ""}`}>
      <div className="customer-sale-payment-head">
        <span className="customer-sale-payment-title">How are they paying?</span>
        {mode === "full" ?
          <button type="button" className="customer-sale-payment-change" onClick={() => setExpanded(false)}>
            Simple view
          </button>
        : null}
      </div>
      <div className="customer-sale-payment-modes" role="group" aria-label="Payment type">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`customer-sale-payment-chip${mode === m.id ? " is-active" : ""}`}
            onClick={() => setMode(m.id)}
          >
            {compact ? m.short : m.label}
          </button>
        ))}
      </div>
      <div className="customer-sale-payment-amounts">
        <div className="customer-sale-payment-amount-row">
          <span>Bill total</span>
          <strong>₹{formatMoney(billTotal)}</strong>
        </div>
        {mode === "partial" || mode === "advance" ?
          <label className="customer-sale-payment-amount-row">
            <span>Received now</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="0"
              value={value?.amount_received ?? ""}
              onChange={(e) =>
                onChange({ ...value, payment_mode: mode, amount_received: e.target.value.replace(/[^\d.]/g, "") })
              }
            />
          </label>
        : null}
        {mode === "later" ?
          <div className="customer-sale-payment-amount-row">
            <span>Received now</span>
            <strong>₹0</strong>
          </div>
        : null}
        {balance > 0.009 ?
          <div className="customer-sale-payment-amount-row is-due">
            <span>Balance due</span>
            <strong>₹{formatMoney(balance)}</strong>
          </div>
        : null}
      </div>
      {showDueSchedule ?
        <div className="customer-sale-payment-due-block">
          <p className="customer-sale-payment-sub">When to collect balance</p>
          <div className="customer-sale-payment-presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`customer-sale-payment-chip is-small${value?.due_preset === p.id ? " is-active" : ""}`}
                onClick={() => onChange({ ...value, due_preset: p.id })}
              >
                {p.label}
              </button>
            ))}
          </div>
          {value?.due_preset === "custom" ?
            <label className="customer-sale-payment-date">
              <span>Due date</span>
              <input
                type="date"
                value={value?.custom_due_date || ""}
                onChange={(e) => onChange({ ...value, custom_due_date: e.target.value })}
              />
            </label>
          : dueLabel ?
            <p className="customer-sale-payment-due-hint">Collect by {dueLabel}</p>
          : null}
        </div>
      : null}
      {mode === "advance" ?
        <p className="customer-sale-payment-callout">
          Stock stays reserved until you mark <strong>delivered</strong> in Customer dues.
        </p>
      : null}
      {mode !== "full" ?
        <p className="customer-sale-payment-callout is-customer">
          Fill in <strong>Customer</strong> (section above) with name and mobile.
        </p>
      : null}
      <label className="customer-sale-payment-notes">
        <span>Note (optional)</span>
        <input
          type="text"
          maxLength={200}
          placeholder="Promise, reference…"
          value={value?.due_notes || ""}
          onChange={(e) => onChange({ ...value, due_notes: e.target.value })}
        />
      </label>
    </div>
  );
}
