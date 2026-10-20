import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatAdminDateFromIso } from "@/lib/format";
import { formatWarrantyUntilLabel } from "@/lib/warranty";
import {
  formatBillMoney,
  formatShopPhone,
  saleBillTotal,
  SHOP_BILL,
} from "@/lib/sale-bill";

function paymentLabel(method) {
  const raw = String(method || "cash").trim();
  return raw ? raw.toUpperCase() : "CASH";
}

function dateLabel(iso) {
  if (!iso) return "";
  return formatAdminDateFromIso(iso, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function downloadSaleBillPdf(bill) {
  if (!bill?.lines?.length) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const total = saleBillTotal(bill.lines);
  const shopPhone = formatShopPhone(SHOP_BILL.phone);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(SHOP_BILL.name, 12, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(SHOP_BILL.line, 12, 19);
  doc.text(SHOP_BILL.address, 12, 23.5);
  if (shopPhone) doc.text(shopPhone, 12, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Invoice #${bill.invoiceNo || "—"}`, pageWidth - 12, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const when = [dateLabel(bill.date), bill.time].filter(Boolean).join("  ");
  if (when) doc.text(when, pageWidth - 12, 19, { align: "right" });
  if (bill.cashier) doc.text(`Cashier: ${bill.cashier}`, pageWidth - 12, 23.5, { align: "right" });

  let y = 34;
  const customer = [bill.customer_name, bill.customer_phone ? `+91 ${bill.customer_phone}` : ""]
    .filter(Boolean)
    .join(" · ");
  if (customer) {
    doc.setFontSize(9);
    doc.text(`Customer: ${customer}`, 12, y);
    y += 5;
  }

  const body = bill.lines.map((row, index) => {
    const details = [row.description || "Item"];
    if (row.made_in_date) details.push(`Made in ${dateLabel(row.made_in_date)}`);
    const serial = row.serial_number || "—";
    const warranty =
      row.warranty_months && row.warranty_until
        ? `${row.warranty_months} mo / ${formatWarrantyUntilLabel(row.warranty_until)}`
        : "—";
    return [
      String(index + 1),
      details.join("\n"),
      serial,
      warranty,
      `Rs ${formatBillMoney(row.amount)}`,
    ];
  });

  autoTable(doc, {
    startY: y + 1,
    head: [["#", "Item", "Serial no.", "Warranty", "Amount"]],
    body,
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 2.6,
      valign: "middle",
      textColor: [17, 19, 24],
      lineColor: [230, 232, 238],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [17, 19, 24],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { fontStyle: "bold", fontSize: 11, cellWidth: "auto" },
      2: { cellWidth: 28, fontSize: 10 },
      3: { cellWidth: 28, fontSize: 10 },
      4: { cellWidth: 24, halign: "right", fontStyle: "bold", fontSize: 11 },
    },
    theme: "grid",
    margin: { left: 12, right: 12 },
  });

  const afterTable = (doc.lastAutoTable?.finalY || y) + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Payment: ${paymentLabel(bill.payment_method)}`, 12, afterTable);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total  Rs ${formatBillMoney(total)}`, pageWidth - 12, afterTable, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Thank you for shopping with us.", 12, afterTable + 10);
  doc.text("Please keep this bill for warranty and support.", 12, afterTable + 14);

  const safeName = String(bill.invoiceNo || "bill").replace(/[^\w-]+/g, "");
  doc.save(`invoice-${safeName}.pdf`);
}
