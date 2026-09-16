"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import {
  CATEGORY_LABELS,
  LEDGER_CATEGORIES,
  MT_SUBTYPES,
  PAYMENT_METHODS,
  RECHARGE_PROVIDERS,
  todayDateString,
} from "@/lib/ledger";
import { PHONE_BRANDS } from "@/lib/brands";
import DateRangeFilter from "./DateRangeFilter";
import LeadPicker from "./LeadPicker";

const EMPTY_FORM = {
  amount: "",
  customer_phone: "",
  transfer_amount: "",
  mt_subtype: "mt",
  provider: "Jio",
  description: "",
  payment_method: "",
  lead_id: null,
  repair_brand: "",
  repair_brand_other: "",
};

const SUMMARY_META = {
  recharge: { label: "Recharge", tone: "recharge" },
  money_transfer: { label: "M/T", tone: "mt" },
  accessory: { label: "Accessories", tone: "accessory" },
  repair: { label: "Repair", tone: "repair" },
  payment: { label: "Payment", tone: "payment" },
};

const SIMPLE_ADD_HINT = {
  recharge: "Amount and provider.",
  money_transfer: "Amount and M/T type.",
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

function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function entryItemLabel(entry) {
  switch (entry.category) {
    case "recharge": {
      const base = entry.provider || "Recharge";
      return entry.customer_phone ? `${base} · ${entry.customer_phone}` : base;
    }
    case "money_transfer": {
      const base = entry.mt_subtype ? entry.mt_subtype.toUpperCase() : "M/T";
      return entry.customer_phone ? `${base} · ${entry.customer_phone}` : base;
    }
    case "repair": {
      const detail = entry.description || CATEGORY_LABELS.repair;
      return entry.device_brand ? `${entry.device_brand} · ${detail}` : detail;
    }
    case "accessory":
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

function SavedItemField({ label, placeholder, value, suggestions, onChange }) {
  const listId = useId();
  const picks = suggestions.slice(0, 10);

  return (
    <label className="ledger-quick-field">
      <span>{label}</span>
      <input
        type="text"
        required
        list={listId}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {suggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      {picks.length > 0 ? (
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
      <small className="ledger-field-hint">Saved from past entries — tap a chip or type to add new.</small>
    </label>
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

function LedgerExportButton({ onClick }) {
  return (
    <button type="button" className="ledger-export-btn" onClick={onClick} aria-label="Export PDF">
      <DownloadIcon />
      <span className="ledger-export-btn-label">Export PDF</span>
    </button>
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addSimple, setAddSimple] = useState(false);
  const [showCustomerPhone, setShowCustomerPhone] = useState(false);
  const [itemSuggestions, setItemSuggestions] = useState({
    accessory: [],
    repair: [],
    payment: [],
  });

  const canEdit = book?.can_edit ?? false;
  const isRangeView = Boolean(book?.is_range) || dateFrom !== dateTo;
  const entryDate = dateFrom === dateTo ? dateFrom : dateTo;

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/admin/day-books/suggestions"), { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.suggestions) {
        setItemSuggestions(data.suggestions);
      }
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const qs = new URLSearchParams({
        from: dateFrom,
        to: dateTo,
      });
      const res = await fetch(apiUrl(`/api/admin/day-books?${qs.toString()}`), {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.message || "Could not load day book.");
        setBook(null);
        setEntries([]);
        setTotals(null);
        return;
      }
      setBook(data.book);
      setEntries(data.entries || []);
      setTotals(data.totals || null);
    } catch {
      setLoadError("Network error.");
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filterCategory && entry.category !== filterCategory) return false;
      if (!q) return true;
      const hay = [
        entryItemLabel(entry),
        entry.description,
        entry.provider,
        entry.customer_phone,
        entry.device_brand,
        entry.created_by_name,
        CATEGORY_LABELS[entry.category],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, search, filterCategory]);

  const filtersActive = Boolean(search.trim() || filterCategory);

  function resetForm(keepCategory = true) {
    setForm(EMPTY_FORM);
    setError("");
    if (!keepCategory) setCategory("recharge");
  }

  function onCategoryChange(next) {
    setCategory(next);
    setForm(EMPTY_FORM);
    setError("");
    setShowCustomerPhone(false);
  }

  function openAddModal(nextCategory = "recharge", { simple = false } = {}) {
    setCategory(nextCategory);
    setForm(EMPTY_FORM);
    setError("");
    setAddSimple(simple);
    setShowCustomerPhone(false);
    setAddOpen(true);
  }

  function openQuickAdd(nextCategory) {
    openAddModal(nextCategory, { simple: true });
  }

  function closeAddModal() {
    if (busy) return;
    setAddOpen(false);
    setAddSimple(false);
    setError("");
  }

  function clearFilters() {
    setSearch("");
    setFilterCategory("");
  }

  async function submitEntry(event) {
    event.preventDefault();
    if (!canEdit) return;
    setError("");
    if (category === "repair") {
      const brand =
        form.repair_brand === "Other" ? form.repair_brand_other.trim() : form.repair_brand.trim();
      if (!form.repair_brand) {
        setError("Select mobile brand.");
        return;
      }
      if (form.repair_brand === "Other" && !brand) {
        setError("Enter brand name under Other.");
        return;
      }
    }
    setBusy(true);
    try {
      const payload = {
        date: entryDate,
        category,
        amount: form.amount,
        transfer_amount: category === "money_transfer" ? form.transfer_amount : undefined,
        mt_subtype: category === "money_transfer" ? form.mt_subtype : undefined,
        provider: category === "recharge" ? form.provider : undefined,
        description: form.description,
        payment_method: category === "accessory" ? form.payment_method || undefined : undefined,
        lead_id: category === "repair" ? form.lead_id : undefined,
        customer_phone:
          category === "recharge" || category === "money_transfer" ? form.customer_phone : undefined,
        device_brand:
          category === "repair" ?
            form.repair_brand === "Other" ?
              form.repair_brand_other.trim()
            : form.repair_brand.trim()
          : undefined,
      };
      const res = await fetch(apiUrl("/api/admin/day-books/entries"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Could not save.");
        return;
      }
      resetForm(true);
      setAddOpen(false);
      await load();
      await loadSuggestions();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function renderAddForm() {
    const simple = addSimple;
    const categoryLabel = SUMMARY_META[category]?.label || CATEGORY_LABELS[category];

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
        ) : (
          <p className="ledger-simple-kicker">
            <span className={`ledger-type-badge is-${category.replace(/_/g, "-")}`}>{categoryLabel}</span>
          </p>
        )}

        <form className={`ledger-quick-form is-modal${simple ? " is-simple" : ""}`} onSubmit={submitEntry}>
          <label className="ledger-quick-field">
            <span>Amount (₹)</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              required
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            />
          </label>

          {category === "recharge" || category === "money_transfer" ? (
            <div className="ledger-phone-accordion">
              <button
                type="button"
                className="ledger-phone-toggle"
                aria-expanded={showCustomerPhone}
                onClick={() => setShowCustomerPhone((open) => !open)}
              >
                {showCustomerPhone ? "Hide customer mobile" : "+ Customer mobile (optional)"}
              </button>
              {showCustomerPhone ? (
                <label className="ledger-quick-field">
                  <span>Customer mobile</span>
                  <div className="ledger-phone-wrap">
                    <span className="ledger-phone-prefix">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      placeholder="10-digit number"
                      value={form.customer_phone}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          customer_phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                        }))
                      }
                    />
                  </div>
                </label>
              ) : null}
            </div>
          ) : null}

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

          {category === "money_transfer" ? (
            <label className="ledger-quick-field">
              <span>Type</span>
              <select
                value={form.mt_subtype}
                onChange={(e) => setForm((p) => ({ ...p, mt_subtype: e.target.value }))}
              >
                {MT_SUBTYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {category === "accessory" ? (
            <SavedItemField
              label="Item"
              placeholder="Charger, tempered..."
              value={form.description}
              suggestions={itemSuggestions.accessory}
              onChange={(description) => setForm((p) => ({ ...p, description }))}
            />
          ) : null}

          {category === "repair" ? (
            <>
              <div className="ledger-quick-field">
                <span>Mobile brand</span>
                <div className="ledger-brand-chips" role="radiogroup" aria-label="Mobile brand">
                  {PHONE_BRANDS.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      role="radio"
                      aria-checked={form.repair_brand === brand}
                      className={`ledger-brand-chip${form.repair_brand === brand ? " is-active" : ""}`}
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          repair_brand: brand,
                          repair_brand_other: brand === "Other" ? p.repair_brand_other : "",
                        }))
                      }
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
              {form.repair_brand === "Other" ? (
                <label className="ledger-quick-field">
                  <span>Brand name</span>
                  <input
                    type="text"
                    placeholder="Enter mobile brand"
                    value={form.repair_brand_other}
                    onChange={(e) => setForm((p) => ({ ...p, repair_brand_other: e.target.value }))}
                  />
                </label>
              ) : null}
              <SavedItemField
                label="Repair details"
                placeholder="e.g. combo, screen"
                value={form.description}
                suggestions={itemSuggestions.repair}
                onChange={(description) => setForm((p) => ({ ...p, description }))}
              />
            </>
          ) : null}

          {category === "payment" ? (
            <SavedItemField
              label="Expense for"
              placeholder="Petrol, parts..."
              value={form.description}
              suggestions={itemSuggestions.payment}
              onChange={(description) => setForm((p) => ({ ...p, description }))}
            />
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
            <label className="ledger-quick-field">
              <span>Transfer amount (₹, optional)</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.transfer_amount}
                onChange={(e) => setForm((p) => ({ ...p, transfer_amount: e.target.value }))}
                placeholder="e.g. 3000"
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

          {error ? <p className="admin-error">{error}</p> : null}
          <button className="admin-btn ledger-quick-submit" type="submit" disabled={busy}>
            {busy ? "Saving…" : simple ? `Add ${categoryLabel}` : "Save entry"}
          </button>
        </form>
        {simple ? (
          <button type="button" className="ledger-more-options" onClick={() => setAddSimple(false)}>
            More options (notes, lead link…)
          </button>
        ) : null}
      </>
    );
  }

  async function removeEntry(id) {
    if (!canEdit || !window.confirm("Remove this line?")) return;
    const res = await fetch(apiUrl(`/api/admin/day-books/entries/${id}`), {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      window.alert(data.message || "Could not delete.");
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
          <h1>Day book</h1>
          <p>Daily shop accounting — recharge, M/T, accessories, repair, payment &amp; more.</p>
        </div>
        <div className="ledger-top-actions ledger-toolbar-desktop">
          <LedgerDateRangeControl {...dateRangeProps} />
          <LedgerExportButton onClick={exportDayBookPdf} />
          {canEdit ? (
            <button type="button" className="admin-btn ledger-top-add" onClick={() => openAddModal()}>
              + Add entry
            </button>
          ) : null}
        </div>
      </header>

      {loadError ? <p className="admin-error">{loadError}</p> : null}
      {book && isRangeView ? (
        <p className="ledger-hint">
          Showing combined totals for the selected range. Pick a single day in the date range to add or edit entries.
        </p>
      ) : null}
      {!canEdit && book && !isRangeView ? (
        <p className="ledger-hint">View only — staff can edit today's book only.</p>
      ) : null}

      {totals ? (
        <section className="ledger-summary-grid" aria-label="Today's totals">
          {LEDGER_CATEGORIES.map((cat) => {
            const meta = SUMMARY_META[cat];
            const val = totals[TOTAL_KEYS[cat]] ?? 0;
            return (
              <article key={cat} className={`ledger-summary-card is-${meta.tone}`}>
                {canEdit ? (
                  <button
                    type="button"
                    className="ledger-summary-add"
                    aria-label={`Quick add ${meta.label}`}
                    title={`Add ${meta.label}`}
                    onClick={() => openQuickAdd(cat)}
                  >
                    +
                  </button>
                ) : null}
                <span className="ledger-summary-icon" aria-hidden="true">
                  <LedgerCategoryIcon kind={meta.tone} />
                </span>
                <div>
                  <p>{meta.label}</p>
                  <strong>₹{formatMoney(val)}</strong>
                </div>
              </article>
            );
          })}
          <article className="ledger-summary-card is-net">
            <span className="ledger-summary-icon" aria-hidden="true">
              <LedgerCategoryIcon kind="net" />
            </span>
            <div>
              <p>{isRangeView ? "Net (range)" : "Net today"}</p>
              <strong>₹{formatMoney(totals.net_day)}</strong>
            </div>
          </article>
        </section>
      ) : null}

      <section className="admin-card ledger-entries" id="ledger-entries">
        <div className="ledger-entries-head">
          <div>
            <h2 className="ledger-section-title">
              {isRangeView ? "Entries in range" : "Today's entries"}
            </h2>
            <p className="ledger-entries-count">
              Showing {filteredEntries.length} of {entries.length}
            </p>
          </div>
        </div>

        <div className="ledger-filter-panel">
          <div className="ledger-filter-range-row ledger-toolbar-mobile">
            <div className="ledger-filter-range-field">
              <LedgerDateRangeControl {...dateRangeProps} />
            </div>
            <LedgerExportButton onClick={exportDayBookPdf} />
          </div>
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
          <div className="ledger-filter-types">
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
          {filtersActive ? (
            <button type="button" className="ledger-filter-clear" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        {filteredEntries.length === 0 ? (
          <p className="admin-empty">
            {entries.length === 0 ? "No entries yet." : "No entries match your filters."}
          </p>
        ) : (
          <>
            <div className="ledger-table-wrap admin-table-wrap">
              <table className="admin-table ledger-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {isRangeView ? <th>Date</th> : null}
                    <th>Time</th>
                    <th>Type</th>
                    <th>Provider / item</th>
                    <th>Amount</th>
                    <th>Note</th>
                    <th>Added by</th>
                    {canEdit ? <th>Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, index) => (
                    <tr key={entry.id}>
                      <td>{index + 1}</td>
                      {isRangeView ? <td>{entry.book_date || "—"}</td> : null}
                      <td>{formatTime(entry.created_at)}</td>
                      <td>
                        <span className={`ledger-type-badge is-${entry.category.replace(/_/g, "-")}`}>
                          {CATEGORY_LABELS[entry.category] || entry.category}
                        </span>
                      </td>
                      <td>{entryItemLabel(entry)}</td>
                      <td className="ledger-amount-cell">₹{formatMoney(entry.amount)}</td>
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
              {filteredEntries.map((entry, index) => (
                <li key={entry.id} className="ledger-entry-card">
                  <div className="ledger-entry-card-top">
                    <span className={`ledger-type-badge is-${entry.category.replace(/_/g, "-")}`}>
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                    <strong>₹{formatMoney(entry.amount)}</strong>
                  </div>
                  <p className="ledger-entry-card-main">{entryItemLabel(entry)}</p>
                  {entryNote(entry) !== "—" ? (
                    <p className="ledger-entry-card-note">{entryNote(entry)}</p>
                  ) : null}
                  <div className="ledger-entry-card-foot">
                    <p className="ledger-entry-card-meta">
                      {isRangeView && entry.book_date ? `${entry.book_date} · ` : ""}
                      {formatTime(entry.created_at)} · {entry.created_by_name || "—"}
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

      {canEdit && addOpen ? (
        <div
          className="admin-modal ledger-add-modal"
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
                    `Quick add — ${SUMMARY_META[category]?.label || CATEGORY_LABELS[category]}`
                  : "Add transaction"}
                </h3>
                <p>{addSimple ? SIMPLE_ADD_HINT[category] : "Choose type and enter amount."}</p>
              </div>
              <button type="button" className="ledger-modal-close" onClick={closeAddModal} aria-label="Close">
                ×
              </button>
            </div>
            {renderAddForm()}
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <button type="button" className="ledger-fab" aria-label="Add entry" onClick={() => openAddModal()}>
          +
        </button>
      ) : null}

      {totals ? (
        <footer className="ledger-day-foot">
          <div className="ledger-day-stat is-balance">
            <span>{isRangeView ? "Range balance (net)" : "Day balance (net)"}</span>
            <strong>₹{formatMoney(totals.net_day)}</strong>
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

