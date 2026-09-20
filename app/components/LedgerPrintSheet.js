"use client";

import { ADMIN_TIME_ZONE, formatAdminDateFromIso, formatAdminTime } from "@/lib/format";
import {
  categoryCollectionTotal,
  entryRevenueAmount,
  entryTxnAmount,
  LEDGER_CATEGORIES,
} from "@/lib/ledger";

const COLUMN_TITLES = {
  recharge: "Recharge",
  money_transfer: "M/T",
  accessory: "Acc.",
  repair: "Repair",
  payment: "Payment",
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

function categoryTotalCell(totals, cat) {
  const grossKey = TOTAL_GROSS_KEYS[cat];
  const profit = totals[TOTAL_KEYS[cat]] ?? 0;
  const main = grossKey ? categoryCollectionTotal(totals, cat) : profit;
  const gross = grossKey ? totals[grossKey] ?? 0 : 0;
  if (grossKey && (gross > 0 || profit > 0)) {
    return (
      <>
        ₹{formatMoney(main)}
        <br />
        <small>
          Txn ₹{formatMoney(gross)} · Profit ₹{formatMoney(profit)}
        </small>
      </>
    );
  }
  return <>₹{formatMoney(main)}</>;
}

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

function formatHeaderDate(from, to, isRange) {
  const fmt = (iso) =>
    formatAdminDateFromIso(iso, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  if (!isRange || from === to) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

function entryLineLabel(entry, entryItemLabel, entryNote) {
  const main = entryItemLabel(entry);
  const note = entryNote(entry);
  if (note && note !== "—" && !main.includes(note)) return `${main} (${note})`;
  return main;
}

export default function LedgerPrintSheet({
  entries = [],
  totals = null,
  dateFrom = "",
  dateTo = "",
  isRangeView = false,
  entryItemLabel,
  entryNote,
}) {
  const grouped = {};
  for (const cat of LEDGER_CATEGORIES) grouped[cat] = [];
  for (const entry of entries) {
    if (grouped[entry.category]) grouped[entry.category].push(entry);
  }

  const maxRows = Math.max(1, ...LEDGER_CATEGORIES.map((cat) => grouped[cat].length));

  const printedAt = new Date().toLocaleString("en-IN", {
    timeZone: ADMIN_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="ledger-print-sheet" aria-hidden="true">
      <header className="ledger-print-head">
        <div>
          <h1>Ganpati Mobile Point</h1>
          <p>Daily Accounts · Nirman Nagar, Jaipur</p>
        </div>
        <div className="ledger-print-meta">
          <p>
            <strong>Date:</strong> {formatHeaderDate(dateFrom, dateTo, isRangeView)}
          </p>
          <p>
            <strong>Printed:</strong> {printedAt}
          </p>
        </div>
      </header>

      {totals ? (
        <table className="ledger-print-totals">
          <thead>
            <tr>
              {LEDGER_CATEGORIES.map((cat) => (
                <th key={cat}>{COLUMN_TITLES[cat]}</th>
              ))}
              <th>Collection</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {LEDGER_CATEGORIES.map((cat) => (
                <td key={cat}>{categoryTotalCell(totals, cat)}</td>
              ))}
              <td className="is-net">
                ₹{formatMoney(totals.total_collection ?? 0)}
                <br />
                <small>Profit ₹{formatMoney(totals.net_day ?? 0)}</small>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}

      <table className="ledger-print-grid">
        <thead>
          <tr>
            {LEDGER_CATEGORIES.map((cat) => (
              <th key={cat}>{COLUMN_TITLES[cat]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {LEDGER_CATEGORIES.map((cat) => {
                const entry = grouped[cat][rowIndex];
                if (!entry) return <td key={cat} />;
                return (
                  <td key={cat}>
                    <div className="ledger-print-cell">
                      <strong>₹{formatMoney(entryTxnAmount(entry))}</strong>
                      <span>{entryLineLabel(entry, entryItemLabel, entryNote)}</span>
                      {entryRevenueAmount(entry) > 0 ?
                        <small>Profit ₹{formatMoney(entryRevenueAmount(entry))}</small>
                      : null}
                      {isRangeView && entry.book_date ? <small>{entry.book_date}</small> : null}
                      <small>{formatAdminTime(entry.created_at)}</small>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            {LEDGER_CATEGORIES.map((cat) => (
              <td key={cat}>
                <strong>{categoryTotalCell(totals, cat)}</strong>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>

      {totals ? (
        <footer className="ledger-print-foot">
          <p>
            Revenue inflow (commission on Recharge/M/T + Acc + Repair):{" "}
            <strong>₹{formatMoney(totals.net_inflow ?? 0)}</strong>
          </p>
          {(totals.total_recharge_gross ?? 0) > 0 || (totals.total_mt_gross ?? 0) > 0 ?
            <p>
              Gross handled (not revenue): Recharge ₹{formatMoney(totals.total_recharge_gross ?? 0)} · M/T ₹
              {formatMoney(totals.total_mt_gross ?? 0)}
            </p>
          : null}
          <p>
            Payment (out): <strong>₹{formatMoney(totals.total_payment ?? 0)}</strong>
            {(totals.total_payment_taken ?? 0) > 0 ?
              <>
                {" "}
                · Payment in: <strong>₹{formatMoney(totals.total_payment_taken)}</strong>
              </>
            : null}
          </p>
          <p>
            Net profit: <strong>₹{formatMoney(totals.net_day ?? 0)}</strong> · {entries.length} transaction
            {entries.length === 1 ? "" : "s"}
          </p>
        </footer>
      ) : null}
    </div>
  );
}
