import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

function formatCategoryTotal(totals, cat) {
  const grossKey = TOTAL_GROSS_KEYS[cat];
  const profit = totals[TOTAL_KEYS[cat]] ?? 0;
  const main = grossKey ? categoryCollectionTotal(totals, cat) : profit;
  const gross = grossKey ? totals[grossKey] ?? 0 : 0;
  if (grossKey && (gross > 0 || profit > 0)) {
    return `Rs ${formatMoney(main)}\nTxn Rs ${formatMoney(gross)} · Profit Rs ${formatMoney(profit)}`;
  }
  return `Rs ${formatMoney(main)}`;
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

function cellText(entry, isRangeView, entryItemLabel, entryNote) {
  if (!entry) return "";
  const main = entryItemLabel(entry);
  const note = entryNote(entry);
  const detail = note && note !== "—" && !main.includes(note) ? `${main} (${note})` : main;
  const gross = entryTxnAmount(entry);
  const profit = entryRevenueAmount(entry);
  const prefix =
    entry.category === "payment" && entry.payment_flow === "taken" ? "+Rs " : "Rs ";
  const lines = [`${prefix}${formatMoney(gross)}`, detail];
  if (profit > 0 && entry.category !== "payment") {
    lines.push(`Profit Rs ${formatMoney(profit)}`);
  }
  if (isRangeView && entry.book_date) lines.push(String(entry.book_date));
  const time = formatAdminTime(entry.created_at);
  if (time) lines.push(time);
  return lines.join("\n");
}

export function downloadDayBookPdf({
  entries = [],
  totals = null,
  dateFrom = "",
  dateTo = "",
  isRangeView = false,
  entryItemLabel,
  entryNote,
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.text("Ganpati Mobile Point — Daily Accounts", 14, 14);
  doc.setFontSize(10);
  doc.text("Nirman Nagar, Jaipur", 14, 20);
  doc.text(`Date: ${formatHeaderDate(dateFrom, dateTo, isRangeView)}`, pageWidth - 14, 14, {
    align: "right",
  });
  doc.text(
    `Exported: ${new Date().toLocaleString("en-IN", { timeZone: ADMIN_TIME_ZONE })}`,
    pageWidth - 14,
    20,
    { align: "right" }
  );

  const grouped = {};
  for (const cat of LEDGER_CATEGORIES) grouped[cat] = [];
  for (const entry of entries) {
    if (grouped[entry.category]) grouped[entry.category].push(entry);
  }

  const maxRows = Math.max(1, ...LEDGER_CATEGORIES.map((cat) => grouped[cat].length));

  if (totals) {
    autoTable(doc, {
      startY: 26,
      head: [
        [
          ...LEDGER_CATEGORIES.map((cat) => COLUMN_TITLES[cat]),
          "Collection",
        ],
      ],
      body: [
        [
          ...LEDGER_CATEGORIES.map((cat) => formatCategoryTotal(totals, cat)),
          `Rs ${formatMoney(totals.total_collection ?? 0)}\nProfit Rs ${formatMoney(totals.net_day ?? 0)}`,
        ],
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
      theme: "grid",
    });
  }

  const startY = (doc.lastAutoTable?.finalY || 26) + 4;

  const body = Array.from({ length: maxRows }).map((_, rowIndex) =>
    LEDGER_CATEGORIES.map((cat) =>
      cellText(grouped[cat][rowIndex], isRangeView, entryItemLabel, entryNote)
    )
  );

  const foot = totals ?
    [
      LEDGER_CATEGORIES.map((cat) => formatCategoryTotal(totals, cat)),
    ]
  : undefined;

  autoTable(doc, {
    startY,
    head: [LEDGER_CATEGORIES.map((cat) => COLUMN_TITLES[cat])],
    body,
    foot,
    styles: { fontSize: 8, cellPadding: 2, valign: "top" },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold" },
    footStyles: { fillColor: [250, 250, 250], textColor: 0, fontStyle: "bold" },
    theme: "grid",
  });

  if (totals) {
    const y = (doc.lastAutoTable?.finalY || startY) + 8;
    doc.setFontSize(9);
    doc.text(
      `Revenue inflow: Rs ${formatMoney(totals.net_inflow ?? 0)}  |  Payment out: Rs ${formatMoney(totals.total_payment ?? 0)}  |  Payment in: Rs ${formatMoney(totals.total_payment_taken ?? 0)}  |  Net profit: Rs ${formatMoney(totals.net_day ?? 0)}  |  ${entries.length} transaction(s)`,
      14,
      y
    );
  }

  const fileSuffix =
    isRangeView && dateFrom !== dateTo ? `${dateFrom}_to_${dateTo}` : dateFrom || "export";
  doc.save(`daily-accounts-${fileSuffix}.pdf`);
}
