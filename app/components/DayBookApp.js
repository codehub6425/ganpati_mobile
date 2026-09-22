"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { commissionEligible, suggestCommission } from "@/lib/commission";
import { adminShiftIsoDays, formatAdminDateFromIso, formatAdminTime } from "@/lib/format";
import {
  CATEGORY_LABELS,
  DEFAULT_PAYMENT_TAKEN_ITEMS,
  entryCollectionAmount,
  entryMtCollectionGross,
  entryRevenueAmount,
  entryTxnAmount,
  isApsEntry,
  LEDGER_CATEGORIES,
  MT_SUBTYPES,
  PAYMENT_FLOW_LABELS,
  PAYMENT_FLOWS,
  PAYMENT_METHODS,
  RECHARGE_PROVIDERS,
  todayDateString,
} from "@/lib/ledger";
import { PHONE_BRANDS } from "@/lib/brands";
import { confirmAction, showError } from "@/lib/swal";
import DateRangeFilter from "./DateRangeFilter";
import LeadPicker from "./LeadPicker";

const CUSTOMER_LINK_CATEGORIES = ["recharge", "money_transfer", "accessory", "repair"];

const EMPTY_FORM = {
  amount: "",
  customer_phone: "",
  customer_name: "",
  transfer_amount: "",
  mt_subtype: "",
  provider: "Jio",
  description: "",
  payment_method: "",
  lead_id: null,
  repair_brand: "",
  repair_brand_other: "",
  payment_flow: "given",
  commission_amount: "",
  commission_manual: false,
  accessory_lines: [{ description: "", amount: "" }],
};

function accessoryLinesTotal(lines) {
  return (lines || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function normalizeAccessoryLines(lines) {
  return (lines || [])
    .map((row) => ({
      description: String(row.description || "").trim(),
      amount: String(row.amount ?? "").trim(),
    }))
    .filter((row) => row.description || row.amount);
}

const SUMMARY_META = {
  recharge: { label: "Recharge", tone: "recharge" },
  money_transfer: { label: "M/T", tone: "mt" },
  accessory: { label: "Accessories", tone: "accessory" },
  repair: { label: "Repair", tone: "repair" },
  payment: { label: "Payment", tone: "payment" },
};

const MT_SUBTYPE_LABELS = {
  mt: "M/T",
  redem: "Redeem",
  aps: "APS",
};

const SIMPLE_ADD_HINT = {
  recharge: "Amount and provider.",
  money_transfer: "Pick type, then enter amount.",
  accessory: "Enter sale amount and item name.",
  repair: "Amount, mobile brand, and repair details.",
  payment: "Enter expense amount and what it was for.",
};

const TOTAL_KEYS = {
  recharge: "total_recharge",
  money_transfer: "total_mt",
  accessory: "total_accessory",
  repair: "total_repair",
  payment: "total_payment",
};

const TOTAL_GROSS_KEYS = {
  recharge: "total_recharge_gross",
  money_transfer: "total_mt_gross",
};

function LedgerCategoryIcon({ kind }) {
  const common = { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: 2 };
  switch (kind) {
    case "recharge":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
        </svg>
      );
    case "mt":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "accessory":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M6 7h12l-1 12H7L6 7z" strokeLinejoin="round" />
          <path d="M9 7V5a3 3 0 016 0v2" strokeLinecap="round" />
        </svg>
      );
    case "repair":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M14 7a3.5 3.5 0 00-4.95 4.95L5 16l3 3 4.05-4.05A3.5 3.5 0 0014 7z" strokeLinejoin="round" />
          <path d="M12 19v3" strokeLinecap="round" />
        </svg>
      );
    case "payment":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case "net":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 19V5M4 19h16" strokeLinecap="round" />
          <path d="M8 15l3-4 3 2 4-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

function isPaymentTaken(entry) {
  return entry.category === "payment" && entry.payment_flow === "taken";
}

function entryCategoryBadge(entry) {
  if (entry.category === "payment") {
    return isPaymentTaken(entry) ? "Credit" : "Debit";
  }
  return CATEGORY_LABELS[entry.category] || entry.category;
}

function entryBadgeClass(entry) {
  const base = entry.category.replace(/_/g, "-");
  if (isPaymentTaken(entry)) return "payment-in";
  return base;
}

function entryAmountDisplay(entry) {
  if (isApsEntry(entry)) {
    const txn = entryTxnAmount(entry);
    return txn > 0 ? `−₹${formatMoney(txn)}` : "₹0";
  }
  const gross = entryCollectionAmount(entry);
  const formatted = formatMoney(gross);
  return isPaymentTaken(entry) ? `+₹${formatted}` : `₹${formatted}`;
}

/** Txn + profit breakdown under collection total in lists. */
function entryProfitLine(entry) {
  if (entry.category === "payment") return null;
  const txn = entryTxnAmount(entry);
  const profit = entryRevenueAmount(entry);
  const hasProfit = Number.isFinite(profit) && profit > 0;

  if (commissionEligible(entry.category, entry.mt_subtype)) {
    const parts = [];
    if (hasProfit) parts.push(`Profit ₹${formatMoney(profit)}`);
    if (isApsEntry(entry) && txn > 0) {
      parts.push(`Debit ₹${formatMoney(txn)} from total collection`);
    }
    const transfer = entry.transfer_amount != null ? Number(entry.transfer_amount) : NaN;
    if (Number.isFinite(transfer) && transfer > 0 && transfer !== txn) {
      parts.push(`Transfer ₹${formatMoney(transfer)}`);
    }
    return parts.length ? parts.join(" · ") : null;
  }

  if ((entry.category === "accessory" || entry.category === "repair") && hasProfit) {
    return `Profit ₹${formatMoney(profit)}`;
  }

  return null;
}

function computeMtBreakdown(entries) {
  const subs = ["mt", "redem", "aps"];
  const bySub = Object.fromEntries(
    subs.map((sub) => [sub, { count: 0, gross: 0, commission: 0 }])
  );
  const other = { count: 0, gross: 0, commission: 0 };

  for (const entry of entries) {
    if (entry.category !== "money_transfer") continue;
    const raw = String(entry.mt_subtype || "mt").trim().toLowerCase();
    const bucket = subs.includes(raw) ? bySub[raw] : other;
    bucket.count += 1;
    bucket.gross += entryMtCollectionGross(entry);
    bucket.commission += entryRevenueAmount(entry);
  }

  const rows = subs
    .map((sub) => ({
      sub,
      label: MT_SUBTYPE_LABELS[sub] || sub,
      ...bySub[sub],
    }))
    .filter((row) => row.count > 0);
  if (other.count > 0) {
    rows.push({ sub: "other", label: "Other", ...other });
  }

  const totalGross = rows.reduce((sum, row) => sum + row.gross, 0);
  const totalCommission = rows.reduce((sum, row) => sum + row.commission, 0);
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);

  return { rows, totalGross, totalCommission, totalCount };
}

function computeRechargeBreakdown(entries) {
  const byProvider = new Map();

  for (const entry of entries) {
    if (entry.category !== "recharge") continue;
    const label = String(entry.provider || "Other").trim() || "Other";
    const bucket = byProvider.get(label) || { label, count: 0, gross: 0, commission: 0 };
    bucket.count += 1;
    bucket.gross += Number(entry.amount) || 0;
    bucket.commission += entryRevenueAmount(entry);
    byProvider.set(label, bucket);
  }

  const rows = [...byProvider.values()].sort((a, b) => b.gross - a.gross || b.commission - a.commission);
  const totalGross = rows.reduce((sum, row) => sum + row.gross, 0);
  const totalCommission = rows.reduce((sum, row) => sum + row.commission, 0);
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);

  return { rows, totalGross, totalCommission, totalCount };
}

function LedgerSummaryEyeIcon() {
  const common = {
    viewBox: "0 0 24 24",
    width: 16,
    height: 16,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    "aria-hidden": true,
  };
  return (
    <svg {...common}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function simpleAddHint(category, paymentFlow) {
  if (category === "payment") {
    return paymentFlow === "taken" ?
        "Enter amount received (credit), e.g. room rent, interest, or due."
      : "Enter expense amount and what it was paid for.";
  }
  return SIMPLE_ADD_HINT[category];
}

function normalizePaymentSuggestions(raw) {
  if (raw && !Array.isArray(raw)) {
    return {
      given: raw.given || [],
      taken: [...new Set([...DEFAULT_PAYMENT_TAKEN_ITEMS, ...(raw.taken || [])])],
    };
  }
  const list = Array.isArray(raw) ? raw : [];
  return {
    given: list,
    taken: [...DEFAULT_PAYMENT_TAKEN_ITEMS],
  };
}

const ENTRY_SORT_KEYS = {
  time: "created_at",
  date: "book_date",
  type: "category",
  item: "item",
  amount: "amount",
  note: "note",
  staff: "staff",
};

function entrySortValue(entry, sortKey) {
  switch (sortKey) {
    case "created_at":
      return new Date(entry.created_at).getTime() || 0;
    case "book_date":
      return entry.book_date || "";
    case "category":
      return CATEGORY_LABELS[entry.category] || entry.category || "";
    case "item":
      return entryItemLabel(entry).toLowerCase();
    case "amount":
      return entryCollectionAmount(entry);
    case "note":
      return entryNote(entry).toLowerCase();
    case "staff":
      return (entry.created_by_name || "").toLowerCase();
    default:
      return entry.id || 0;
  }
}

function compareEntries(a, b, sortKey, sortDir) {
  const va = entrySortValue(a, sortKey);
  const vb = entrySortValue(b, sortKey);
  let cmp = 0;
  if (typeof va === "number" && typeof vb === "number") {
    cmp = va - vb;
  } else {
    cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
  }
  if (cmp === 0) {
    cmp = (Number(b.id) || 0) - (Number(a.id) || 0);
  }
  return sortDir === "asc" ? cmp : -cmp;
}

function LedgerSortHeader({ label, column, sortKey, sortDir, onSort }) {
  const resolvedKey = ENTRY_SORT_KEYS[column] || column;
  const active = sortKey === resolvedKey;
  return (
    <th scope="col">
      <button
        type="button"
        className={`ledger-sort-btn${active ? " is-active" : ""}`}
        onClick={() => onSort(column)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{label}</span>
        <span className="ledger-sort-indicator" aria-hidden="true">
          {active ?
            sortDir === "asc" ?
              "↑"
            : "↓"
          : "↕"}
        </span>
      </button>
    </th>
  );
}

function customerEntrySuffix(entry) {
  if (entry.customer_name && entry.customer_phone) {
    return `${entry.customer_name} · ${entry.customer_phone}`;
  }
  if (entry.customer_phone) return entry.customer_phone;
  return null;
}

function entryItemLabel(entry) {
  const customer = customerEntrySuffix(entry);
  switch (entry.category) {
    case "recharge": {
      const base = entry.provider || "Recharge";
      return customer ? `${base} · ${customer}` : base;
    }
    case "money_transfer": {
      const base = entry.mt_subtype ? entry.mt_subtype.toUpperCase() : "M/T";
      return customer ? `${base} · ${customer}` : base;
    }
    case "repair": {
      const detail = entry.description || CATEGORY_LABELS.repair;
      const base = entry.device_brand ? `${entry.device_brand} · ${detail}` : detail;
      return customer ? `${base} · ${customer}` : base;
    }
    case "accessory": {
      const base = entry.description || CATEGORY_LABELS.accessory;
      return customer ? `${base} · ${customer}` : base;
    }
    case "payment":
      return entry.description || CATEGORY_LABELS[entry.category];
    default:
      return entry.description || entry.category;
  }
}

function entryNote(entry) {
  const parts = [];
  if (entry.category === "money_transfer" && entry.transfer_amount) {
    parts.push(`Transfer ₹${formatMoney(entry.transfer_amount)}`);
  }
  if (entry.category === "recharge" && entry.description) {
    parts.push(entry.description);
  }
  if (entry.payment_method) parts.push(entry.payment_method.toUpperCase());
  if (entry.lead_name) parts.push(`Lead: ${entry.lead_name}`);
  return parts.join(" · ") || "—";
}

function LedgerInlineSpinner({ size = 18 }) {
  return <span className="ledger-inline-spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

function AccessoryLinesEditor({ lines, onChange, suggestions, compact, error }) {
  const listId = useId();
  const picks = suggestions.slice(0, compact ? 4 : 8);
  const total = accessoryLinesTotal(lines);

  function updateLine(index, patch) {
    onChange(lines.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addLine() {
    onChange([...lines, { description: "", amount: "" }]);
  }

  function removeLine(index) {
    if (lines.length <= 1) {
      onChange([{ description: "", amount: "" }]);
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  }

  return (
    <div className={`ledger-accessory-lines${error ? " has-error" : ""}`}>
      <div className="ledger-accessory-lines-head">
        <span className="ledger-accessory-lines-title">Items sold</span>
        {total > 0 ?
          <span className="ledger-accessory-lines-total">Total ₹{formatMoney(total)}</span>
        : null}
      </div>
      <datalist id={listId}>
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <ul className="ledger-accessory-line-list">
        {lines.map((line, index) => (
          <li key={index} className="ledger-accessory-line">
            <input
              type="text"
              list={listId}
              placeholder="e.g. Charger"
              value={line.description}
              aria-label={`Item ${index + 1} name`}
              onChange={(e) => updateLine(index, { description: e.target.value })}
            />
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="₹"
              value={line.amount}
              aria-label={`Item ${index + 1} amount`}
              onChange={(e) => updateLine(index, { amount: e.target.value.replace(/[^\d.]/g, "") })}
            />
            <button
              type="button"
              className="ledger-accessory-line-remove"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => removeLine(index)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {!compact && picks.length > 0 ?
        <div className="ledger-item-picks" role="list">
          {picks.map((item) => (
            <button
              key={item}
              type="button"
              className="ledger-item-pick"
              onClick={() => {
                const emptyIndex = lines.findIndex((row) => !row.description.trim());
                if (emptyIndex >= 0) {
                  updateLine(emptyIndex, { description: item });
                } else {
                  onChange([...lines, { description: item, amount: "" }]);
                }
              }}
            >
              {item}
            </button>
          ))}
        </div>
      : null}
      <button type="button" className="ledger-accessory-add-line" onClick={addLine}>
        + Add item
      </button>
      {error ?
        <p className="ledger-field-error" role="alert">
          {error}
        </p>
      : null}
    </div>
  );
}

function SavedItemField({
  label,
  placeholder,
  value,
  suggestions,
  onChange,
  compact = false,
  multiline = false,
  error = "",
}) {
  const listId = useId();
  const picks = suggestions.slice(0, compact ? 4 : 10);

  return (
    <label className={`ledger-quick-field${multiline ? " is-multiline" : ""}${error ? " has-error" : ""}`}>
      <span>{label}</span>
      {multiline ?
        <textarea
          rows={compact ? 2 : 3}
          placeholder={placeholder}
          value={value}
          aria-invalid={error ? "true" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      : <>
          <input
            type="text"
            list={listId}
            placeholder={placeholder}
            value={value}
            aria-invalid={error ? "true" : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          <datalist id={listId}>
            {suggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </>
      }
      {!compact && picks.length > 0 ? (
        <div className="ledger-item-picks" role="list">
          {picks.map((item) => (
            <button
              key={item}
              type="button"
              className={`ledger-item-pick${value === item ? " is-active" : ""}`}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      {!compact ?
        <small className="ledger-field-hint">Saved from past entries — tap a chip or type to add new.</small>
      : null}
      {error ?
        <p className="ledger-field-error" role="alert">
          {error}
        </p>
      : null}
    </label>
  );
}

function LedgerCustomerLinkPanel({
  linkMode,
  onSkip,
  onLink,
  phone,
  onPhoneChange,
  name,
  onNameChange,
  lookup,
  nameEditOpen,
  onEditName,
  onDoneEditName,
  errors = {},
  compact = false,
}) {
  const phoneComplete = phone.length === 10;
  const showNameSummary =
    phoneComplete &&
    (lookup === "found" || lookup === "staff") &&
    !nameEditOpen &&
    Boolean(name.trim());
  const hidePhoneRow = compact && showNameSummary;
  const showNameInput =
    phoneComplete &&
    lookup !== "loading" &&
    (lookup === "new" || nameEditOpen || !name.trim());

  let phoneStatus = `${phone.length}/10`;
  if (phoneComplete) {
    if (lookup === "loading") phoneStatus = "…";
    else if (lookup === "found") phoneStatus = "✓";
    else if (lookup === "staff") phoneStatus = "!";
    else if (lookup === "new") phoneStatus = "+";
  }

  return (
    <div className={`ledger-customer-panel${compact ? " is-compact" : ""}`}>
      <div className="ledger-segmented ledger-segmented-customer" role="tablist" aria-label="Customer">
        <button
          type="button"
          role="tab"
          aria-selected={linkMode === "none"}
          className={`ledger-segmented-btn${linkMode === "none" ? " is-active" : ""}`}
          onClick={onSkip}
        >
          Skip
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={linkMode === "customer"}
          className={`ledger-segmented-btn${linkMode === "customer" ? " is-active" : ""}`}
          onClick={onLink}
        >
          Customer
        </button>
      </div>

      {linkMode === "customer" ?
        <div className="ledger-customer-panel-body">
          {!hidePhoneRow ?
            <>
              <label className="ledger-customer-phone-label">
                <span className="ledger-sr-only">Customer mobile</span>
                <div className="ledger-phone-row">
                  <div
                    className={`ledger-phone-wrap${errors.customer_phone ? " is-invalid" : ""}${lookup === "found" || lookup === "staff" ? " is-valid" : ""}`}
                  >
                    <span className="ledger-phone-prefix">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      placeholder={compact ? "10-digit mobile" : "Mobile number"}
                      value={phone}
                      aria-invalid={errors.customer_phone ? "true" : undefined}
                      onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    />
                  </div>
                  <span
                    className={`ledger-phone-status${lookup === "found" ? " is-ok" : ""}${lookup === "new" ? " is-new" : ""}${lookup === "loading" ? " is-loading" : ""}`}
                    aria-live="polite"
                  >
                    {lookup === "loading" && phoneComplete ?
                      <LedgerInlineSpinner size={16} />
                    : phoneStatus}
                  </span>
                </div>
              </label>
              {errors.customer_phone ?
                <p className="ledger-field-error" role="alert">
                  {errors.customer_phone}
                </p>
              : null}
            </>
          : null}

          {phoneComplete && lookup === "loading" ?
            <div
              className={`ledger-customer-search-loader${compact ? " is-compact" : ""}`}
              aria-busy="true"
              aria-live="polite"
            >
              <LedgerInlineSpinner size={compact ? 18 : 22} />
              <span>{compact ? "Searching…" : "Looking up customer…"}</span>
            </div>
          : null}

          {showNameSummary ?
            <div className={`ledger-customer-result is-saved${compact ? " is-compact" : ""}`}>
              <div className="ledger-customer-result-main">
                <strong>{name}</strong>
                <span>
                  +91 {phone}
                  {lookup === "found" ? " · Saved" : " · Staff"}
                </span>
              </div>
              <div className="ledger-customer-result-actions">
                <button
                  type="button"
                  className="ledger-commission-edit"
                  aria-label="Edit customer name"
                  title="Edit name"
                  onClick={onEditName}
                >
                  <PencilIcon />
                </button>
                {hidePhoneRow ?
                  <button
                    type="button"
                    className="ledger-customer-change-phone"
                    onClick={() => onPhoneChange("")}
                  >
                    Change
                  </button>
                : null}
              </div>
            </div>
          : null}

          {showNameInput ?
            <div className={`ledger-customer-result${lookup === "new" ? " is-new" : " is-edit"}`}>
              <label className="ledger-customer-name-field">
                <span>{lookup === "new" ? "New customer name" : "Edit name"}</span>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Full name"
                  value={name}
                  autoFocus={nameEditOpen || lookup === "new"}
                  aria-invalid={errors.customer_name ? "true" : undefined}
                  onChange={(e) => onNameChange(e.target.value.slice(0, 80))}
                />
              </label>
              {errors.customer_name ?
                <p className="ledger-field-error" role="alert">
                  {errors.customer_name}
                </p>
              : null}
              {nameEditOpen && lookup !== "new" ?
                <button type="button" className="ledger-commission-reset" onClick={onDoneEditName}>
                  Done
                </button>
              : null}
            </div>
          : null}

          {!phoneComplete && !compact ?
            <p className="ledger-customer-status-line">Enter 10 digits to search Customers.</p>
          : null}
        </div>
      : null}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 18h4v-2h-4v2ZM3 6v2h18V6H3Zm3 7h12v-2H6v2Z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function PaymentFlowIcon({ flow }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 16,
    height: 16,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (flow === "given") {
    return (
      <svg {...common}>
        <path d="M12 19V9" />
        <path d="M8 13l4-4 4 4" />
        <path d="M5 5h14" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 5v10" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

function LedgerExportButton({ onClick }) {
  return (
    <button type="button" className="ledger-export-btn" onClick={onClick} aria-label="Export PDF">
      <DownloadIcon />
      <span className="ledger-export-btn-label">Export PDF</span>
    </button>
  );
}

const LEDGER_DAY_STRIP_LENGTH = 30;

function buildLastNDays(count = LEDGER_DAY_STRIP_LENGTH) {
  const today = todayDateString();
  const oldestOffset = -(count - 1);
  return Array.from({ length: count }, (_, i) => adminShiftIsoDays(today, oldestOffset + i));
}

function scrollDayStripToSelection(container, activeEl, alignEnd) {
  if (!container) return;
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  if (!activeEl) {
    container.scrollLeft = maxScroll;
    return;
  }
  let next = 0;
  if (alignEnd) {
    next = activeEl.offsetLeft + activeEl.offsetWidth - container.clientWidth + 8;
  } else {
    next = activeEl.offsetLeft - (container.clientWidth - activeEl.offsetWidth) / 2;
  }
  container.scrollLeft = Math.min(maxScroll, Math.max(0, next));
}

function LedgerDayStrip({ selectedFrom, selectedTo, onSelectDay, panelOpen = false }) {
  const days = useMemo(() => buildLastNDays(), []);
  const stripElRef = useRef(null);
  const singleDay = selectedFrom === selectedTo ? selectedFrom : null;

  useLayoutEffect(() => {
    if (!panelOpen) return;
    const node = stripElRef.current;
    if (!node) return;
    const syncScroll = () => {
      const active = node.querySelector(".ledger-day-pill.is-active");
      scrollDayStripToSelection(node, active, singleDay === todayDateString());
    };
    syncScroll();
    requestAnimationFrame(syncScroll);
  }, [panelOpen, selectedFrom, selectedTo, singleDay]);

  return (
    <div className="ledger-day-strip-wrap">
      <div className="ledger-day-strip" ref={stripElRef} role="listbox" aria-label="Last 30 days, oldest to newest">
        {days.map((iso) => {
          const isToday = iso === todayDateString();
          const isActive = iso === singleDay;
          const label = formatAdminDateFromIso(iso, { day: "numeric", month: "short" });
          return (
            <button
              key={iso}
              type="button"
              role="option"
              aria-selected={isActive}
              aria-label={isToday ? `Today, ${label}` : label}
              className={`ledger-day-pill${isActive ? " is-active" : ""}${isToday ? " is-today" : ""}`}
              onClick={() => onSelectDay(iso)}
            >
              <span className="ledger-day-pill-label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LedgerDateRangeControl({ isAdmin, dateFrom, dateTo, onChange }) {
  if (isAdmin) {
    return (
      <DateRangeFilter
        variant="field"
        label="Date range"
        maxDate={todayDateString()}
        from={dateFrom}
        to={dateTo}
        onChange={onChange}
      />
    );
  }
  return (
    <div className="ledger-date-readonly-wrap">
      <span className="ledger-filter-types-label">Date</span>
      <span className="ledger-date-readonly">{dateFrom}</span>
    </div>
  );
}

export default function DayBookApp({ userRole = "staff" }) {
  const isAdmin = userRole === "admin";
  const [dateFrom, setDateFrom] = useState(todayDateString());
  const [dateTo, setDateTo] = useState(todayDateString());
  const [book, setBook] = useState(null);
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState(null);
  const [category, setCategory] = useState("recharge");
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addSimple, setAddSimple] = useState(false);
  const [customerLinkMode, setCustomerLinkMode] = useState("none");
  const [customerLookup, setCustomerLookup] = useState("idle");
  const [customerNameEditOpen, setCustomerNameEditOpen] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [entrySortKey, setEntrySortKey] = useState("created_at");
  const [entrySortDir, setEntrySortDir] = useState("desc");
  const [mtTypeError, setMtTypeError] = useState(false);
  const [commissionEditOpen, setCommissionEditOpen] = useState(false);
  const [itemSuggestions, setItemSuggestions] = useState({
    accessory: [],
    repair: [],
    payment: { given: [], taken: [...DEFAULT_PAYMENT_TAKEN_ITEMS] },
  });
  const [commissionRules, setCommissionRules] = useState([]);
  const [mtSummaryOpen, setMtSummaryOpen] = useState(false);
  const [rechargeSummaryOpen, setRechargeSummaryOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);

  const canEdit = book?.can_edit ?? false;
  const mtBreakdown = useMemo(() => computeMtBreakdown(entries), [entries]);
  const rechargeBreakdown = useMemo(() => computeRechargeBreakdown(entries), [entries]);
  const isRangeView = Boolean(book?.is_range) || dateFrom !== dateTo;
  const isSingleDay = dateFrom === dateTo;
  const selectedDayIso = !isRangeView && isSingleDay ? dateFrom : null;
  const canAddEntry = Boolean(selectedDayIso && canEdit);
  const isViewingToday = selectedDayIso === todayDateString();

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/admin/day-books/suggestions"), { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.suggestions) {
        setItemSuggestions({
          ...data.suggestions,
          payment: normalizePaymentSuggestions(data.suggestions.payment),
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const loadRange = useCallback(async (from, to) => {
    setLoadError("");
    try {
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(apiUrl(`/api/admin/day-books?${qs.toString()}`), {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.message || "Could not load daily accounts.");
        setBook(null);
        setEntries([]);
        setTotals(null);
        return;
      }
      setBook(data.book);
      setEntries(data.entries || []);
      setTotals(data.totals || null);
      setCommissionRules(data.commission_rules || []);
    } catch {
      setLoadError("Network error.");
    }
  }, []);

  const load = useCallback(async () => {
    await loadRange(dateFrom, dateTo);
  }, [dateFrom, dateTo, loadRange]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setMtSummaryOpen(false);
    setRechargeSummaryOpen(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!mtSummaryOpen && !rechargeSummaryOpen) return undefined;
    const onPointerDown = (event) => {
      if (!event.target.closest?.("[data-summary-detail-root]")) {
        setMtSummaryOpen(false);
        setRechargeSummaryOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [mtSummaryOpen, rechargeSummaryOpen]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    if (loadError) showError(loadError);
  }, [loadError]);

  useEffect(() => {
    if (!addOpen) {
      document.documentElement.style.removeProperty("--keyboard-inset");
      return undefined;
    }
    const root = document.documentElement;
    function syncKeyboardInset() {
      const vv = window.visualViewport;
      if (!vv) {
        root.style.setProperty("--keyboard-inset", "0px");
        return;
      }
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
    }
    syncKeyboardInset();
    window.visualViewport?.addEventListener("resize", syncKeyboardInset);
    window.visualViewport?.addEventListener("scroll", syncKeyboardInset);
    return () => {
      window.visualViewport?.removeEventListener("resize", syncKeyboardInset);
      window.visualViewport?.removeEventListener("scroll", syncKeyboardInset);
      root.style.removeProperty("--keyboard-inset");
    };
  }, [addOpen]);

  function scrollFieldIntoView(event) {
    const el = event.target;
    if (!el?.matches?.("input, textarea, select")) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  useEffect(() => {
    if (!commissionEligible(category, form.mt_subtype)) return;
    if (form.commission_manual) return;
    const suggested = suggestCommission(commissionRules, {
      category,
      amount: form.amount,
      transfer_amount: form.transfer_amount,
      mt_subtype: form.mt_subtype,
    });
    const next = suggested > 0 ? String(suggested) : "";
    setForm((prev) =>
      prev.commission_amount === next && !prev.commission_manual ?
        prev
      : { ...prev, commission_amount: next }
    );
  }, [
    category,
    form.amount,
    form.transfer_amount,
    form.mt_subtype,
    form.commission_manual,
    commissionRules,
  ]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (filterCategory && entry.category !== filterCategory) return false;
      if (!q) return true;
      const hay = [
        entryItemLabel(entry),
        entry.description,
        entry.provider,
        entry.customer_phone,
        entry.customer_name,
        entry.device_brand,
        entry.created_by_name,
        CATEGORY_LABELS[entry.category],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    return [...filtered].sort((a, b) => compareEntries(a, b, entrySortKey, entrySortDir));
  }, [entries, search, filterCategory, entrySortKey, entrySortDir]);

  function toggleEntrySort(column) {
    const sortKey = ENTRY_SORT_KEYS[column] || column;
    if (entrySortKey === sortKey) {
      setEntrySortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setEntrySortKey(sortKey);
    setEntrySortDir(sortKey === "created_at" || sortKey === "amount" ? "desc" : "asc");
  }

  const todayIso = todayDateString();
  const dateFilterActive = dateFrom !== dateTo || dateFrom !== todayIso;
  const filtersActive = Boolean(search.trim() || filterCategory || dateFilterActive);
  const entriesSectionTitle =
    isRangeView ?
      `Entries · ${formatAdminDateFromIso(dateFrom, { day: "numeric", month: "short" })} – ${formatAdminDateFromIso(dateTo, { day: "numeric", month: "short", year: "numeric" })}`
    : isSingleDay && dateFrom === todayDateString() ?
      "Today's entries"
    : isSingleDay ?
      `Entries · ${formatAdminDateFromIso(dateFrom, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`
    : "Entries";

  function selectLedgerDay(iso) {
    setDateFrom(iso);
    setDateTo(iso);
    setRangePickerOpen(false);
  }

  function openFiltersPanel() {
    setRangePickerOpen(dateFrom !== dateTo);
    setFiltersOpen(true);
  }

  function closeFiltersPanel() {
    setFiltersOpen(false);
    setRangePickerOpen(false);
  }

  function resetCustomerLink() {
    setCustomerLinkMode("none");
    setCustomerLookup("idle");
    setCustomerNameEditOpen(false);
  }

  function clearFormError(key) {
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function resetForm(keepCategory = true) {
    setForm(EMPTY_FORM);
    setCommissionEditOpen(false);
    resetCustomerLink();
    setFormErrors({});
    if (!keepCategory) setCategory("recharge");
  }

  function onCategoryChange(next) {
    setCategory(next);
    setForm(EMPTY_FORM);
    resetCustomerLink();
    setMtTypeError(false);
    setFormErrors({});
  }

  function openAddModal(nextCategory = "recharge", { simple = false } = {}) {
    setCategory(nextCategory);
    setForm(EMPTY_FORM);
    setAddSimple(simple);
    resetCustomerLink();
    setMtTypeError(false);
    setCommissionEditOpen(false);
    setAddOpen(true);
  }

  function enableCustomerLink() {
    setCustomerLinkMode("customer");
    setCustomerLookup("idle");
  }

  function disableCustomerLink() {
    setCustomerLinkMode("none");
    setCustomerLookup("idle");
    setForm((p) => ({ ...p, customer_phone: "", customer_name: "" }));
  }

  useEffect(() => {
    if (customerLinkMode !== "customer") return undefined;
    const phone = String(form.customer_phone || "");
    if (phone.length !== 10) {
      setCustomerLookup("idle");
      setCustomerNameEditOpen(false);
      return undefined;
    }

    let cancelled = false;
    setCustomerLookup("loading");
    setCustomerNameEditOpen(false);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/admin/customers/lookup?phone=${encodeURIComponent(phone)}`),
          { credentials: "include" }
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setCustomerLookup("idle");
          return;
        }
        if (data.found && data.customer) {
          setCustomerLookup(data.customer.is_customer ? "found" : "staff");
          setCustomerNameEditOpen(false);
          setFormErrors((prev) => {
            const next = { ...prev };
            delete next.customer_phone;
            delete next.customer_name;
            return next;
          });
          setForm((p) => ({ ...p, customer_name: data.customer.name || "" }));
        } else {
          setCustomerLookup("new");
          setCustomerNameEditOpen(true);
          setFormErrors((prev) => {
            const next = { ...prev };
            delete next.customer_phone;
            return next;
          });
          setForm((p) => ({ ...p, customer_name: "" }));
        }
      } catch {
        if (!cancelled) setCustomerLookup("idle");
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerLinkMode, form.customer_phone]);

  function pickMtSubtype(next) {
    setForm((p) => ({
      ...p,
      mt_subtype: next,
      commission_amount: "",
      commission_manual: false,
    }));
    setMtTypeError(false);
    clearFormError("amount");
    clearFormError("mt_subtype");
    setCommissionEditOpen(false);
  }

  function useSystemCommission() {
    setCommissionEditOpen(false);
    setForm((p) => ({
      ...p,
      commission_manual: false,
    }));
  }

  function blockMtAmountEntry() {
    if (category !== "money_transfer" || form.mt_subtype) return false;
    setMtTypeError(true);
    return true;
  }

  const mtTypeSelected = category !== "money_transfer" || Boolean(form.mt_subtype);

  function openQuickAdd(nextCategory) {
    openAddModal(nextCategory, { simple: true });
  }

  function closeAddModal() {
    if (busy) return;
    setAddOpen(false);
    setAddSimple(false);
  }

  function clearFilters() {
    setSearch("");
    setFilterCategory("");
    const today = todayDateString();
    setDateFrom(today);
    setDateTo(today);
    setRangePickerOpen(false);
  }

  function validateEntryForm() {
    const errors = {};

    if (category === "money_transfer") {
      if (!form.mt_subtype || !MT_SUBTYPES.includes(form.mt_subtype)) {
        setMtTypeError(true);
        errors.mt_subtype = "Select M/T, Redeem, or APS.";
      } else {
        setMtTypeError(false);
      }
    }

    if (category === "accessory") {
      const lines = form.accessory_lines || [];
      const complete = lines.filter(
        (row) => row.description.trim() && row.amount !== "" && Number(row.amount) >= 0
      );
      const partial = lines.some(
        (row) =>
          (row.description.trim() && (row.amount === "" || Number(row.amount) < 0)) ||
          (!row.description.trim() && row.amount !== "")
      );
      if (complete.length === 0) {
        errors.accessory_lines = "Add at least one item with name and amount.";
      } else if (partial) {
        errors.accessory_lines = "Fill both name and amount, or remove empty rows.";
      }
    } else {
      const amountNum = Number(form.amount);
      if (form.amount === "" || !Number.isFinite(amountNum) || amountNum < 0) {
        errors.amount =
          category === "money_transfer" && !form.mt_subtype ?
            "Select type, then enter amount."
          : "Enter amount (₹).";
      }
    }

    if (category === "repair") {
      if (!form.repair_brand) {
        errors.repair_brand = "Select mobile brand.";
      } else if (form.repair_brand === "Other" && !form.repair_brand_other.trim()) {
        errors.repair_brand_other = "Enter brand name under Other.";
      }
      if (!form.description.trim()) {
        errors.description = "Enter repair details.";
      }
    }

    if (category === "payment" && !form.description.trim()) {
      errors.description =
        form.payment_flow === "taken" ?
          "Enter what was received."
        : "Enter what this payment was for.";
    }

    if (CUSTOMER_LINK_CATEGORIES.includes(category) && customerLinkMode === "customer") {
      const phone = String(form.customer_phone || "").trim();
      if (customerLookup === "loading") {
        errors.customer_phone = "Please wait — looking up customer.";
      } else if (phone && phone.length !== 10) {
        errors.customer_phone = "Enter full 10-digit mobile or tap Skip.";
      } else if (phone.length === 10 && customerLookup === "new" && !form.customer_name.trim()) {
        errors.customer_name = "Enter name for this new customer.";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function confirmEntryBookDate() {
    if (!selectedDayIso || isViewingToday) return true;
    const dateLabel = formatAdminDateFromIso(selectedDayIso, {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return confirmAction({
      title: "Add to selected date?",
      text: `This entry will be saved on ${dateLabel}, not today (${formatAdminDateFromIso(todayDateString(), { day: "numeric", month: "short" })}). Do you want to continue?`,
      confirmText: "Yes, add entry",
      cancelText: "Cancel",
      icon: "question",
    });
  }

  async function submitEntry(event) {
    event.preventDefault();
    if (!canAddEntry || !selectedDayIso) return;
    if (!validateEntryForm()) return;

    const saveDate = selectedDayIso;
    if (!isViewingToday) {
      setAddOpen(false);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const dateOk = await confirmEntryBookDate();
      if (!dateOk) {
        setAddOpen(true);
        return;
      }
    }

    setBusy(true);
    try {
      const customerPhone =
        CUSTOMER_LINK_CATEGORIES.includes(category) && customerLinkMode === "customer" ?
          form.customer_phone || undefined
        : undefined;
      const customerName =
        CUSTOMER_LINK_CATEGORIES.includes(category) && customerLinkMode === "customer" ?
          form.customer_name || undefined
        : undefined;

      const postEntry = async (body) => {
        const res = await fetch(apiUrl("/api/admin/day-books/entries"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return { res, data };
      };

      if (category === "accessory") {
        const lines = normalizeAccessoryLines(form.accessory_lines).filter(
          (row) => row.description && row.amount !== "" && Number(row.amount) >= 0
        );
        for (const line of lines) {
          const { res, data } = await postEntry({
            date: saveDate,
            category: "accessory",
            amount: line.amount,
            description: line.description,
            payment_method: form.payment_method || undefined,
            customer_phone: customerPhone,
            customer_name: customerName,
          });
          if (!res.ok) {
            showError(data.message || `Could not save ${line.description}.`);
            return;
          }
        }
      } else {
        const { res, data } = await postEntry({
          date: saveDate,
          category,
          amount: form.amount,
          transfer_amount: category === "money_transfer" ? form.transfer_amount : undefined,
          mt_subtype: category === "money_transfer" ? form.mt_subtype : undefined,
          provider: category === "recharge" ? form.provider : undefined,
          description: form.description,
          payment_method: undefined,
          lead_id: category === "repair" ? form.lead_id : undefined,
          customer_phone: customerPhone,
          customer_name: customerName,
          device_brand:
            category === "repair" ?
              form.repair_brand === "Other" ?
                form.repair_brand_other.trim()
              : form.repair_brand.trim()
            : undefined,
          payment_flow: category === "payment" ? form.payment_flow || "given" : undefined,
          commission_amount:
            commissionEligible(category, form.mt_subtype) && form.commission_amount !== "" ?
              form.commission_amount
            : undefined,
          commission_manual: form.commission_manual,
        });
        if (!res.ok) {
          showError(data.message || "Could not save.");
          return;
        }
      }
      resetForm(true);
      setAddOpen(false);
      setDateFrom(saveDate);
      setDateTo(saveDate);
      await loadRange(saveDate, saveDate);
      await loadSuggestions();
    } catch {
      showError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function renderAddForm() {
    const simple = addSimple;
    const categoryLabel = SUMMARY_META[category]?.label || CATEGORY_LABELS[category];
    const mtSubmitLabel =
      category === "money_transfer" && form.mt_subtype ?
        MT_SUBTYPE_LABELS[form.mt_subtype] || form.mt_subtype.toUpperCase()
      : categoryLabel;

    const customerLinkPanel =
      CUSTOMER_LINK_CATEGORIES.includes(category) ?
        <LedgerCustomerLinkPanel
          linkMode={customerLinkMode}
          onSkip={disableCustomerLink}
          onLink={enableCustomerLink}
          phone={form.customer_phone}
          onPhoneChange={(next) => {
            clearFormError("customer_phone");
            clearFormError("customer_name");
            setForm((p) => ({ ...p, customer_phone: next }));
          }}
          name={form.customer_name}
          onNameChange={(next) => {
            clearFormError("customer_name");
            setForm((p) => ({ ...p, customer_name: next }));
          }}
          lookup={customerLookup}
          nameEditOpen={customerNameEditOpen}
          onEditName={() => setCustomerNameEditOpen(true)}
          onDoneEditName={() => setCustomerNameEditOpen(false)}
          errors={{
            customer_phone: formErrors.customer_phone,
            customer_name: formErrors.customer_name,
          }}
          compact={simple && (category === "repair" || category === "accessory")}
        />
      : null;

    const customerAfterDetails =
      category === "repair" || category === "accessory";
    const repairQuickSheet = simple && category === "repair";
    const accessoryLineCount =
      category === "accessory" ?
        normalizeAccessoryLines(form.accessory_lines).filter(
          (row) => row.description && row.amount !== "" && Number(row.amount) >= 0
        ).length
      : 0;
    const rechargeRule = commissionRules.find((r) => r.rule_key === "recharge");
    const rechargeRateHint =
      category === "recharge" && rechargeRule?.calc_type === "percent" && rechargeRule.rate != null ?
        `${rechargeRule.rate}% of recharge amount (added as profit, not deducted)`
      : category === "recharge" ?
        "Profit on recharge amount (added, not deducted)"
      : "";

    return (
      <>
        {!simple ? (
          <div className="ledger-tabs" role="tablist">
            {LEDGER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`ledger-tab${category === cat ? " is-active" : ""}`}
                onClick={() => onCategoryChange(cat)}
              >
                {SUMMARY_META[cat]?.label || CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        ) : !addSimple ?
          <p className="ledger-simple-kicker">
            <span className={`ledger-type-badge is-${category.replace(/_/g, "-")}`}>
              {category === "money_transfer" && form.mt_subtype ?
                MT_SUBTYPE_LABELS[form.mt_subtype]
              : categoryLabel}
            </span>
          </p>
        : null}

        <form
          id="ledger-add-entry-form"
          className={`ledger-quick-form is-modal${simple ? " is-simple is-sheet-layout" : ""}${repairQuickSheet ? " is-repair-quick" : ""}`}
          onSubmit={submitEntry}
          onFocusCapture={scrollFieldIntoView}
          noValidate
        >
          <div className={`ledger-quick-form-scroll${repairQuickSheet ? " is-no-scroll" : ""}`}>
          {category === "money_transfer" ? (
            <div className="ledger-mt-type-block">
              <p className="ledger-mt-type-label">Select type</p>
              <div className="ledger-mt-type-tabs" role="tablist" aria-label="M/T type">
                {MT_SUBTYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={form.mt_subtype === t}
                    className={`ledger-mt-type-tab${form.mt_subtype === t ? " is-active" : ""}`}
                    onClick={() => pickMtSubtype(t)}
                  >
                    {MT_SUBTYPE_LABELS[t] || t.toUpperCase()}
                  </button>
                ))}
              </div>
              {mtTypeError ? (
                <p className="ledger-field-error" role="alert">
                  Please select M/T, Redeem, or APS before entering amount.
                </p>
              ) : !form.mt_subtype ? (
                <p className="ledger-mt-type-hint">Choose type to continue.</p>
              ) : null}
            </div>
          ) : null}

          {category === "accessory" ?
            <AccessoryLinesEditor
              lines={form.accessory_lines || [{ description: "", amount: "" }]}
              suggestions={itemSuggestions.accessory}
              compact={simple}
              error={formErrors.accessory_lines}
              onChange={(accessory_lines) => {
                clearFormError("accessory_lines");
                setForm((p) => ({ ...p, accessory_lines }));
              }}
            />
          : <label
              className={`ledger-quick-field${!mtTypeSelected ? " is-disabled" : ""}${formErrors.amount ? " has-error" : ""}`}
            >
              <span>Amount (₹)</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                disabled={!mtTypeSelected}
                placeholder={mtTypeSelected ? "0" : "Select type first"}
                value={form.amount}
                aria-invalid={formErrors.amount ? "true" : undefined}
                onFocus={() => blockMtAmountEntry()}
                onChange={(e) => {
                  if (blockMtAmountEntry()) return;
                  clearFormError("amount");
                  setCommissionEditOpen(false);
                  setForm((p) => ({
                    ...p,
                    amount: e.target.value,
                    commission_manual: false,
                  }));
                }}
              />
              {formErrors.amount ?
                <p className="ledger-field-error" role="alert">
                  {formErrors.amount}
                </p>
              : null}
            </label>
          }

          {commissionEligible(category, form.mt_subtype) && mtTypeSelected && form.amount !== "" ? (
            <div className="ledger-commission-field">
              {(() => {
                const txn = Number(form.amount) || 0;
                const profit = Number(form.commission_amount) || 0;
                const showTotal = txn > 0 && profit > 0;
                if (!showTotal) return null;
                if (category === "money_transfer" && form.mt_subtype === "aps") {
                  return (
                    <p className="ledger-commission-total-hint">
                      APS <strong>₹{formatMoney(txn)}</strong>
                      <span className="ledger-commission-total-breakdown">
                        {" "}
                        · Debited from total collection · Profit ₹{formatMoney(profit)} added to day profit
                      </span>
                    </p>
                  );
                }
                if (category === "recharge") {
                  return (
                    <p className="ledger-commission-total-hint">
                      Customer pays <strong>₹{formatMoney(txn)}</strong>
                      <span className="ledger-commission-total-breakdown">
                        {" "}
                        · Your profit ₹{formatMoney(profit)} (from operator, not extra from customer)
                      </span>
                    </p>
                  );
                }
                return null;
              })()}
              {commissionEditOpen || form.commission_manual ? (
                <>
                  <label className="ledger-quick-field">
                    <span>Revenue (commission) ₹ — manual</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      autoFocus
                      value={form.commission_amount}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          commission_amount: e.target.value,
                          commission_manual: true,
                        }))
                      }
                    />
                  </label>
                  <button type="button" className="ledger-commission-reset" onClick={useSystemCommission}>
                    Use system calculation
                  </button>
                </>
              ) : (
                <div className="ledger-commission-summary">
                  <p className="ledger-commission-summary-text">
                    {simple ?
                      <>
                        Profit{" "}
                        <strong>
                          ₹
                          {form.commission_amount !== "" ?
                            formatMoney(form.commission_amount)
                          : "0"}
                        </strong>
                        {rechargeRateHint ?
                          <span className="ledger-commission-rate-hint"> · {rechargeRateHint}</span>
                        : null}
                      </>
                    : <>
                        System calculated commission for this entry:{" "}
                        <strong>
                          ₹
                          {form.commission_amount !== "" ?
                            formatMoney(form.commission_amount)
                          : "0"}
                        </strong>
                      </>
                    }
                  </p>
                  <button
                    type="button"
                    className="ledger-commission-edit"
                    aria-label="Edit commission manually"
                    title="Edit manually"
                    onClick={() => setCommissionEditOpen(true)}
                  >
                    <PencilIcon />
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {!customerAfterDetails ? customerLinkPanel : null}

          {category === "recharge" ? (
            <label className="ledger-quick-field">
              <span>Provider</span>
              <select
                value={form.provider}
                onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
              >
                {RECHARGE_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {category === "repair" ? (
            <>
              <div
                className={`ledger-quick-field ledger-brand-field${formErrors.repair_brand ? " has-error" : ""}`}
              >
                <span>Brand</span>
                <div
                  className={`ledger-brand-chips${simple ? " is-scroll" : ""}`}
                  role="radiogroup"
                  aria-label="Mobile brand"
                >
                  {PHONE_BRANDS.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      role="radio"
                      aria-checked={form.repair_brand === brand}
                      className={`ledger-brand-chip${form.repair_brand === brand ? " is-active" : ""}`}
                      onClick={() => {
                        clearFormError("repair_brand");
                        clearFormError("repair_brand_other");
                        setForm((p) => ({
                          ...p,
                          repair_brand: brand,
                          repair_brand_other: brand === "Other" ? p.repair_brand_other : "",
                        }));
                      }}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
                {formErrors.repair_brand ?
                  <p className="ledger-field-error" role="alert">
                    {formErrors.repair_brand}
                  </p>
                : null}
              </div>
              {form.repair_brand === "Other" ? (
                <label className={`ledger-quick-field${formErrors.repair_brand_other ? " has-error" : ""}`}>
                  <span>Brand name</span>
                  <input
                    type="text"
                    placeholder="Enter mobile brand"
                    value={form.repair_brand_other}
                    aria-invalid={formErrors.repair_brand_other ? "true" : undefined}
                    onChange={(e) => {
                      clearFormError("repair_brand_other");
                      setForm((p) => ({ ...p, repair_brand_other: e.target.value }));
                    }}
                  />
                  {formErrors.repair_brand_other ?
                    <p className="ledger-field-error" role="alert">
                      {formErrors.repair_brand_other}
                    </p>
                  : null}
                </label>
              ) : null}
              <SavedItemField
                label="Repair details"
                placeholder="e.g. combo, screen, battery…"
                value={form.description}
                suggestions={itemSuggestions.repair}
                compact={simple}
                multiline
                error={formErrors.description}
                onChange={(description) => {
                  clearFormError("description");
                  setForm((p) => ({ ...p, description }));
                }}
              />
            </>
          ) : null}

          {customerAfterDetails ? customerLinkPanel : null}

          {category === "payment" ? (
            <>
              <div className="ledger-payment-flow">
                <span className="ledger-payment-flow-label">Type</span>
                <div className="ledger-payment-flow-chips" role="group" aria-label="Payment type">
                  {PAYMENT_FLOWS.map((flow) => (
                    <button
                      key={flow}
                      type="button"
                      className={`ledger-flow-chip${form.payment_flow === flow ? " is-active" : ""}${flow === "taken" ? " is-credit" : " is-debit"}`}
                      onClick={() => setForm((p) => ({ ...p, payment_flow: flow, description: "" }))}
                    >
                      <span
                        className={`ledger-flow-chip-icon${flow === "taken" ? " is-credit" : " is-debit"}`}
                      >
                        <PaymentFlowIcon flow={flow} />
                      </span>
                      <span className="ledger-flow-chip-text">{PAYMENT_FLOW_LABELS[flow]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <SavedItemField
                label={form.payment_flow === "taken" ? "Received for" : "Paid for"}
                placeholder={
                  form.payment_flow === "taken" ? "Room rent, interest, due…" : "Petrol, parts…"
                }
                value={form.description}
                suggestions={
                  form.payment_flow === "taken" ?
                    itemSuggestions.payment.taken
                  : itemSuggestions.payment.given
                }
                error={formErrors.description}
                onChange={(description) => {
                  clearFormError("description");
                  setForm((p) => ({ ...p, description }));
                }}
              />
            </>
          ) : null}

          {!simple && (category === "recharge" || category === "money_transfer") ? (
            <label className="ledger-quick-field">
              <span>Notes (optional)</span>
              <input
                type="text"
                placeholder="Extra detail"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </label>
          ) : null}

          {!simple && category === "money_transfer" ? (
            <label className={`ledger-quick-field${!mtTypeSelected ? " is-disabled" : ""}`}>
              <span>Transfer amount (₹, optional)</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                disabled={!mtTypeSelected}
                value={form.transfer_amount}
                onFocus={() => blockMtAmountEntry()}
                onChange={(e) => {
                  if (blockMtAmountEntry()) return;
                  setForm((p) => ({ ...p, transfer_amount: e.target.value }));
                }}
                placeholder={mtTypeSelected ? "e.g. 3000" : "Select type first"}
              />
            </label>
          ) : null}

          {!simple && category === "accessory" ? (
            <label className="ledger-quick-field">
              <span>Payment method (optional)</span>
              <select
                value={form.payment_method}
                onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}
              >
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!simple && category === "repair" ? (
            <div className="ledger-quick-field">
              <LeadPicker value={form.lead_id} onChange={onLeadPick} disabled={busy} />
            </div>
          ) : null}
          </div>

          <div className={`ledger-modal-foot${simple ? " is-sticky" : ""}`}>
            <button
              className="admin-btn ledger-quick-submit"
              type="submit"
              disabled={
                busy ||
                (category === "money_transfer" && !form.mt_subtype) ||
                customerLookup === "loading"
              }
            >
              {busy ?
                "Saving…"
              : customerLookup === "loading" ?
                "Checking customer…"
              : simple ?
                category === "money_transfer" && !form.mt_subtype ?
                  "Select type first"
                : category === "accessory" && accessoryLineCount > 1 ?
                  `Add ${accessoryLineCount} accessories`
                : category === "accessory" && accessoryLineCount === 1 ?
                  "Add accessory"
                : `Add ${mtSubmitLabel}`
              : category === "accessory" && accessoryLineCount > 1 ?
                `Save ${accessoryLineCount} items`
              : "Save entry"}
            </button>
            {simple ?
              <button type="button" className="ledger-more-options" onClick={() => setAddSimple(false)}>
                More options (notes, lead link…)
              </button>
            : null}
          </div>
        </form>
      </>
    );
  }

  async function removeEntry(id) {
    if (!canEdit) return;
    const ok = await confirmAction({
      title: "Remove entry?",
      text: "Remove this line from daily accounts?",
      confirmText: "Remove",
    });
    if (!ok) return;
    const res = await fetch(apiUrl(`/api/admin/day-books/entries/${id}`), {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Could not delete.");
      return;
    }
    await load();
  }

  function onLeadPick(leadId, lead) {
    setForm((prev) => {
      const next = {
        ...prev,
        lead_id: leadId,
        description: prev.description || (lead?.problem ? String(lead.problem).trim() : ""),
      };
      if (lead?.brand) {
        const match = PHONE_BRANDS.find((b) => b.toLowerCase() === String(lead.brand).toLowerCase());
        if (match && match !== "Other") {
          next.repair_brand = match;
          next.repair_brand_other = "";
        } else {
          next.repair_brand = "Other";
          next.repair_brand_other = String(lead.brand);
        }
      }
      return next;
    });
  }

  function exportDayBookPdf() {
    import("./exportDayBookPdf").then(({ downloadDayBookPdf }) => {
      downloadDayBookPdf({
        entries,
        totals,
        dateFrom,
        dateTo,
        isRangeView,
        entryItemLabel,
        entryNote,
      });
    });
  }

  function handleDateRangeChange({ from, to }) {
    const today = todayDateString();
    const nextFrom = from || today;
    const nextTo = to || nextFrom;
    setDateFrom(nextFrom);
    setDateTo(nextTo);
  }

  const dateRangeProps = {
    isAdmin,
    dateFrom,
    dateTo,
    onChange: handleDateRangeChange,
  };

  return (
    <div className="ledger-app ledger-flow">
      <header className="ledger-top">
        <div className="ledger-top-copy">
          <h1>Daily Accounts</h1>
          <p>Daily shop accounting — recharge, M/T, accessories, repair, payment &amp; more.</p>
        </div>
        <div className="ledger-top-actions ledger-toolbar-desktop">
          <LedgerDateRangeControl {...dateRangeProps} />
          <LedgerExportButton onClick={exportDayBookPdf} />
          {canAddEntry ?
            <button type="button" className="admin-btn ledger-top-add" onClick={() => openAddModal()}>
              + Add entry
            </button>
          : null}
        </div>
      </header>

      {book && isRangeView ? (
        <p className="ledger-hint">
          Showing combined totals for the selected range. Pick a single day in the date range to add or edit entries.
        </p>
      ) : null}
      {!canEdit && book && !isRangeView ?
        <p className="ledger-hint">View only — staff can edit today&apos;s accounts only.</p>
      : null}
      {canAddEntry && !isViewingToday ?
        <p className="ledger-hint ledger-hint-selected-day">
          Entries you add will be saved on{" "}
          <strong>
            {formatAdminDateFromIso(selectedDayIso, {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </strong>
          , not today.
        </p>
      : null}

      {totals ? (
        <section className="ledger-summary-grid" aria-label="Today's totals">
          {LEDGER_CATEGORIES.map((cat) => {
            const meta = SUMMARY_META[cat];
            const profitVal = totals[TOTAL_KEYS[cat]] ?? 0;
            const grossKey = TOTAL_GROSS_KEYS[cat];
            const grossVal = grossKey ? totals[grossKey] ?? 0 : profitVal;
            const showSplitGross = Boolean(grossKey);
            const displayMain = showSplitGross ? grossVal : profitVal;
            const isMt = cat === "money_transfer";
            const isRecharge = cat === "recharge";
            const hasSummaryEye = isMt || isRecharge;
            const summaryOpen = isMt ? mtSummaryOpen : isRecharge ? rechargeSummaryOpen : false;
            const mtGross = totals.total_mt_gross ?? mtBreakdown.totalGross;
            const rechargeGross = totals.total_recharge_gross ?? rechargeBreakdown.totalGross;
            return (
              <article
                key={cat}
                className={`ledger-summary-card is-${meta.tone}${summaryOpen ? " is-detail-open" : ""}`}
                {...(hasSummaryEye ? { "data-summary-detail-root": true } : {})}
              >
                {canAddEntry ?
                  <button
                    type="button"
                    className="ledger-summary-add"
                    aria-label={`Quick add ${meta.label}`}
                    title={`Add ${meta.label}`}
                    onClick={() => openQuickAdd(cat)}
                  >
                    +
                  </button>
                : null}
                {isMt && mtSummaryOpen ? (
                  <div className="ledger-summary-popover" role="region" aria-label="M/T summary details">
                    <p className="ledger-summary-popover-title">M/T summary</p>
                    {mtBreakdown.totalCount === 0 ? (
                      <p className="ledger-summary-popover-empty">No M/T entries in this period.</p>
                    ) : (
                      <>
                        <ul className="ledger-summary-popover-list">
                          {mtBreakdown.rows.map((row) => (
                            <li key={row.sub}>
                              <span className="ledger-summary-popover-type">{row.label}</span>
                              <span className="ledger-summary-popover-meta">
                                {row.count} txn{row.count === 1 ? "" : "s"}
                              </span>
                              <span className="ledger-summary-popover-gross">
                                {row.sub === "aps" ? "Debit" : "Txn"} ₹{formatMoney(Math.abs(row.gross))}
                                {row.gross < 0 ? " (−)" : ""}
                              </span>
                              <span className="ledger-summary-popover-comm">
                                Profit ₹{formatMoney(row.commission)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="ledger-summary-popover-total">
                          <span>From customers</span>
                          <strong>₹{formatMoney(mtBreakdown.totalGross)}</strong>
                          <span>Your profit</span>
                          <strong>₹{formatMoney(mtBreakdown.totalCommission)}</strong>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
                {isRecharge && rechargeSummaryOpen ? (
                  <div className="ledger-summary-popover" role="region" aria-label="Recharge summary details">
                    <p className="ledger-summary-popover-title">Recharge summary</p>
                    {rechargeBreakdown.totalCount === 0 ? (
                      <p className="ledger-summary-popover-empty">No recharge entries in this period.</p>
                    ) : (
                      <>
                        <ul className="ledger-summary-popover-list">
                          {rechargeBreakdown.rows.map((row) => (
                            <li key={row.label}>
                              <span className="ledger-summary-popover-type">{row.label}</span>
                              <span className="ledger-summary-popover-meta">
                                {row.count} txn{row.count === 1 ? "" : "s"}
                              </span>
                              <span className="ledger-summary-popover-gross">Txn ₹{formatMoney(row.gross)}</span>
                              <span className="ledger-summary-popover-comm">
                                Profit ₹{formatMoney(row.commission)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="ledger-summary-popover-total">
                          <span>From customers</span>
                          <strong>₹{formatMoney(rechargeBreakdown.totalGross)}</strong>
                          <span>Your profit</span>
                          <strong>₹{formatMoney(rechargeBreakdown.totalCommission)}</strong>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
                <span className="ledger-summary-icon" aria-hidden="true">
                  <LedgerCategoryIcon kind={meta.tone} />
                </span>
                <div
                  className={`ledger-summary-copy${hasSummaryEye ? " is-summary-with-footer" : ""}`}
                >
                  <p>{meta.label}</p>
                  {cat === "payment" ? (
                    <>
                      <strong>₹{formatMoney(totals.total_payment ?? 0)}</strong>
                      {(totals.total_payment_taken ?? 0) > 0 ? (
                        <p className="ledger-summary-sub is-credit">
                          +₹{formatMoney(totals.total_payment_taken)} credit
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <strong>₹{formatMoney(displayMain)}</strong>
                      {showSplitGross && profitVal > 0 ?
                        <p className="ledger-summary-sub is-profit">Profit ₹{formatMoney(profitVal)}</p>
                      : null}
                      {!showSplitGross && (cat === "accessory" || cat === "repair") && profitVal > 0 ?
                        <p className="ledger-summary-sub is-profit">Profit ₹{formatMoney(profitVal)}</p>
                      : null}
                      {hasSummaryEye ?
                        <div className="ledger-summary-footer">
                          <span className="ledger-summary-sub is-muted">
                            {isMt && mtGross <= 0 ?
                              "No txn amount yet"
                            : isRecharge && rechargeGross <= 0 ?
                              "No txn amount yet"
                            : "\u00A0"}
                          </span>
                          <button
                            type="button"
                            className="ledger-summary-detail"
                            aria-label={isMt ? "View M/T summary" : "View recharge summary"}
                            aria-expanded={summaryOpen}
                            title={isMt ? "M/T details" : "Recharge details"}
                            onClick={() => {
                              if (isMt) {
                                setRechargeSummaryOpen(false);
                                setMtSummaryOpen((open) => !open);
                              } else {
                                setMtSummaryOpen(false);
                                setRechargeSummaryOpen((open) => !open);
                              }
                            }}
                          >
                            <LedgerSummaryEyeIcon />
                          </button>
                        </div>
                      : null}
                    </>
                  )}
                </div>
              </article>
            );
          })}
          <article className="ledger-summary-card is-net">
            <span className="ledger-summary-icon" aria-hidden="true">
              <LedgerCategoryIcon kind="net" />
            </span>
            <div className="ledger-summary-net-body">
              <div className="ledger-summary-net-main">
                <div className="ledger-summary-net-left">
                  <p className="ledger-summary-net-title">
                    {isRangeView ?
                      "Total collection (range)"
                    : isViewingToday ?
                      "Total collection today"
                    : `Total collection · ${formatAdminDateFromIso(selectedDayIso, { day: "numeric", month: "short" })}`}
                  </p>
                  <div className="ledger-summary-net-row">
                    <strong className="ledger-summary-net-total">
                      ₹{formatMoney(totals.total_collection ?? 0)}
                    </strong>
                    <span className="ledger-summary-net-count">
                      {entries.length} transaction{entries.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="ledger-summary-net-profit">
                  <span className="ledger-summary-net-profit-label">Profit</span>
                  <strong className="ledger-summary-net-profit-value">
                    ₹{formatMoney(totals.net_day ?? 0)}
                  </strong>
                </div>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      <section className="admin-card ledger-entries" id="ledger-entries">
        <div className="ledger-entries-head">
          <div>
            <h2 className="ledger-section-title">{entriesSectionTitle}</h2>
            <p className="ledger-entries-count">
              Showing {filteredEntries.length} of {entries.length}
              {filtersActive ? " · filters on" : ""}
            </p>
          </div>
          <div className="ledger-entries-head-actions">
            <button
              type="button"
              className={`ledger-filter-toggle${filtersOpen ? " is-open" : ""}${filtersActive ? " has-active" : ""}`}
              aria-expanded={filtersOpen}
              aria-label={filtersOpen ? "Hide filters" : "Show filters"}
              title={filtersOpen ? "Hide filters" : "Filters"}
              onClick={() => (filtersOpen ? closeFiltersPanel() : openFiltersPanel())}
            >
              <FilterIcon />
              {filtersActive && !filtersOpen ?
                <span className="ledger-filter-toggle-dot" aria-hidden="true" />
              : null}
            </button>
            <span className="ledger-entries-head-export">
              <LedgerExportButton onClick={exportDayBookPdf} />
            </span>
          </div>
        </div>

        {filtersOpen ?
          <div className="ledger-filter-panel" id="ledger-filter-panel">
            <div className="ledger-filter-panel-head">
              <span className="ledger-filter-panel-title">Filters</span>
              <button
                type="button"
                className="ledger-filter-panel-close"
                aria-label="Close filters"
                onClick={closeFiltersPanel}
              >
                ×
              </button>
            </div>

            <div className="ledger-filter-block ledger-filter-dates">
              <span className="ledger-filter-types-label">Date</span>
              <LedgerDayStrip
                panelOpen={filtersOpen}
                selectedFrom={dateFrom}
                selectedTo={dateTo}
                onSelectDay={selectLedgerDay}
              />
              {isAdmin && dateFrom !== dateTo ?
                <p className="ledger-filter-range-hint">
                  Range:{" "}
                  {formatAdminDateFromIso(dateFrom, { day: "numeric", month: "short" })}
                  {" – "}
                  {formatAdminDateFromIso(dateTo, { day: "numeric", month: "short", year: "numeric" })}
                </p>
              : null}
              {isAdmin ?
                <div className="ledger-filter-range-extra">
                  {rangePickerOpen ?
                    <div className="ledger-filter-range-field ledger-filter-range-admin">
                      <LedgerDateRangeControl {...dateRangeProps} />
                      <button
                        type="button"
                        className="ledger-filter-range-back"
                        onClick={() => setRangePickerOpen(false)}
                      >
                        Use day picker above
                      </button>
                    </div>
                  : (
                    <button
                      type="button"
                      className="ledger-filter-range-link"
                      onClick={() => setRangePickerOpen(true)}
                    >
                      Custom date range…
                    </button>
                  )}
                </div>
              : null}
            </div>

            <div className="ledger-filter-block">
              <label className="ledger-filter-search">
                <span>Search</span>
                <input
                  type="search"
                  className="ledger-search"
                  placeholder="Provider, item, staff, note…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>

            <div className="ledger-filter-block ledger-filter-types">
              <span className="ledger-filter-types-label">Type</span>
              <div className="ledger-filter-chips" role="group" aria-label="Filter by type">
                <button
                  type="button"
                  className={`ledger-filter-chip${filterCategory === "" ? " is-active" : ""}`}
                  onClick={() => setFilterCategory("")}
                >
                  All
                </button>
                {LEDGER_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`ledger-filter-chip${filterCategory === cat ? " is-active" : ""}`}
                    onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                  >
                    {SUMMARY_META[cat]?.label || CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {filtersActive ?
              <div className="ledger-filter-panel-foot">
                <button type="button" className="ledger-filter-clear" onClick={clearFilters}>
                  Clear all filters
                </button>
              </div>
            : null}
          </div>
        : null}

        {filteredEntries.length === 0 ?
          <div className="ledger-empty-state">
            <p className="ledger-empty-title">
              {entries.length === 0 ?
                isRangeView ?
                  "No entries in this range"
                : "No entries for this day"
              : "No entries match your filters"}
            </p>
            <p className="ledger-empty-hint">
              {entries.length === 0 && !isRangeView && canAddEntry ?
                "Use + to add recharge, M/T, accessories, repair, or payment."
              : entries.length === 0 ?
                "Open filters to pick another date."
              : "Change search or type filters."}
            </p>
            {entries.length === 0 && !isRangeView && canAddEntry ?
              <button type="button" className="admin-btn ledger-empty-cta" onClick={() => openAddModal()}>
                Add entry
              </button>
            : null}
            {filtersActive ?
              <button type="button" className="ledger-filter-clear" onClick={clearFilters}>
                Clear filters
              </button>
            : null}
          </div>
        : (
          <>
            <div className="ledger-table-wrap admin-table-wrap">
              <table className="admin-table ledger-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    {isRangeView ?
                      <LedgerSortHeader
                        label="Date"
                        column="date"
                        sortKey={entrySortKey}
                        sortDir={entrySortDir}
                        onSort={toggleEntrySort}
                      />
                    : null}
                    <LedgerSortHeader
                      label="Time"
                      column="time"
                      sortKey={entrySortKey}
                      sortDir={entrySortDir}
                      onSort={toggleEntrySort}
                    />
                    <LedgerSortHeader
                      label="Type"
                      column="type"
                      sortKey={entrySortKey}
                      sortDir={entrySortDir}
                      onSort={toggleEntrySort}
                    />
                    <LedgerSortHeader
                      label="Provider / item"
                      column="item"
                      sortKey={entrySortKey}
                      sortDir={entrySortDir}
                      onSort={toggleEntrySort}
                    />
                    <LedgerSortHeader
                      label="Amount"
                      column="amount"
                      sortKey={entrySortKey}
                      sortDir={entrySortDir}
                      onSort={toggleEntrySort}
                    />
                    <LedgerSortHeader
                      label="Note"
                      column="note"
                      sortKey={entrySortKey}
                      sortDir={entrySortDir}
                      onSort={toggleEntrySort}
                    />
                    <LedgerSortHeader
                      label="Added by"
                      column="staff"
                      sortKey={entrySortKey}
                      sortDir={entrySortDir}
                      onSort={toggleEntrySort}
                    />
                    {canEdit ? <th scope="col">Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, index) => (
                    <tr key={entry.id}>
                      <td>{index + 1}</td>
                      {isRangeView ? <td>{entry.book_date || "—"}</td> : null}
                      <td>{formatAdminTime(entry.created_at)}</td>
                      <td>
                        <span className={`ledger-type-badge is-${entryBadgeClass(entry)}`}>
                          {entryCategoryBadge(entry)}
                        </span>
                      </td>
                      <td>{entryItemLabel(entry)}</td>
                      <td
                        className={`ledger-amount-cell${isPaymentTaken(entry) ? " is-credit" : ""}`}
                      >
                        {entryAmountDisplay(entry)}
                        {entryProfitLine(entry) ?
                          <small className="ledger-entry-profit">{entryProfitLine(entry)}</small>
                        : null}
                      </td>
                      <td>{entryNote(entry)}</td>
                      <td>{entry.created_by_name || "—"}</td>
                      {canEdit ? (
                        <td>
                          <button
                            type="button"
                            className="ledger-row-delete"
                            onClick={() => removeEntry(entry.id)}
                            aria-label="Delete entry"
                          >
                            Delete
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="ledger-entry-cards">
              {filteredEntries.map((entry) => (
                <li
                  key={entry.id}
                  className={`ledger-entry-card is-${entryBadgeClass(entry)}`}
                >
                  <div className="ledger-entry-card-top">
                    <div className="ledger-entry-card-badges">
                      <span className={`ledger-type-badge is-${entryBadgeClass(entry)}`}>
                        {entryCategoryBadge(entry)}
                      </span>
                      <span className="ledger-entry-card-time">{formatAdminTime(entry.created_at)}</span>
                    </div>
                    <strong className={isPaymentTaken(entry) ? "is-credit" : undefined}>
                      {entryAmountDisplay(entry)}
                    </strong>
                  </div>
                  {entryProfitLine(entry) ?
                    <p className="ledger-entry-card-profit">{entryProfitLine(entry)}</p>
                  : null}
                  <p className="ledger-entry-card-main">{entryItemLabel(entry)}</p>
                  {entryNote(entry) !== "—" ? (
                    <p className="ledger-entry-card-note">{entryNote(entry)}</p>
                  ) : null}
                  <div className="ledger-entry-card-foot">
                    <p className="ledger-entry-card-meta">
                      {isRangeView && entry.book_date ? `${entry.book_date} · ` : ""}
                      {entry.created_by_name || "—"}
                    </p>
                    {canEdit ? (
                      <button
                        type="button"
                        className="ledger-row-delete"
                        onClick={() => removeEntry(entry.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {canAddEntry && addOpen ?
        <div
          className={`admin-modal ledger-add-modal${addSimple ? " is-quick-sheet" : ""}${addSimple && category === "repair" ? " is-repair-sheet" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ledger-add-title"
        >
          <button className="admin-modal-backdrop" type="button" onClick={closeAddModal} aria-label="Close" />
          <div className="admin-modal-card">
            <div className="admin-modal-head">
              <div>
                <h3 id="ledger-add-title">
                  {addSimple ?
                    `Add ${category === "money_transfer" && form.mt_subtype ?
                      MT_SUBTYPE_LABELS[form.mt_subtype]
                    : SUMMARY_META[category]?.label || CATEGORY_LABELS[category]}`
                  : "Add transaction"}
                </h3>
                {!addSimple ?
                  <p>Choose type and enter amount.</p>
                : null}
                {!isViewingToday ?
                  <p className="ledger-add-modal-date">
                    Saving to{" "}
                    {formatAdminDateFromIso(selectedDayIso, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                : null}
              </div>
              <button type="button" className="ledger-modal-close" onClick={closeAddModal} aria-label="Close">
                ×
              </button>
            </div>
            <div className="ledger-modal-body">{renderAddForm()}</div>
          </div>
        </div>
      : null}

      {canAddEntry ?
        <button type="button" className="ledger-fab" aria-label="Add entry" onClick={() => openAddModal()}>
          +
        </button>
      : null}

      {totals ? (
        <footer className="ledger-day-foot ledger-day-foot-desktop">
          <div className="ledger-day-stat is-balance">
            <span>{isRangeView ? "Total collection" : "Total collection"}</span>
            <strong>₹{formatMoney(totals.total_collection ?? 0)}</strong>
            <span className="ledger-day-stat-sub">Profit ₹{formatMoney(totals.net_day ?? 0)}</span>
          </div>
          <div className="ledger-day-stat">
            <span>Total transactions</span>
            <strong>{entries.length}</strong>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 20h4l10.5-10.5a1.4 1.4 0 0 0 0-2L16.5 5.5a1.4 1.4 0 0 0-2 0L4 16v4Zm13.7-9.3 1.6-1.6-1.6-1.6-1.6 1.6 1.6 1.6Z"
      />
    </svg>
  );
}
