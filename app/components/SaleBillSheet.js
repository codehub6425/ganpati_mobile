"use client";

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

export default function SaleBillSheet({ bill }) {
  if (!bill?.lines?.length) return null;

  const total = saleBillTotal(bill.lines);
  const shopPhone = formatShopPhone(SHOP_BILL.phone);
  const dateText = bill.date
    ? formatAdminDateFromIso(bill.date, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <article className="ledger-sale-bill" id="ledger-sale-bill">
      <header className="ledger-sale-bill-head">
        <div>
          <p className="ledger-sale-bill-kicker">{SHOP_BILL.line}</p>
          <h2>{SHOP_BILL.name}</h2>
          <p>{SHOP_BILL.address}</p>
          {shopPhone ? <p>{shopPhone}</p> : null}
        </div>
        <div className="ledger-sale-bill-meta">
          <p>
            <strong>Invoice #{bill.invoiceNo || "—"}</strong>
          </p>
          {dateText ? <p>Date: {dateText}</p> : null}
          {bill.time ? <p>Time: {bill.time}</p> : null}
          {bill.cashier ? <p>Cashier: {bill.cashier}</p> : null}
        </div>
      </header>

      {bill.customer_name || bill.customer_phone ? (
        <p className="ledger-sale-bill-customer">
          Customer: {bill.customer_name || "—"}
          {bill.customer_phone ? ` · +91 ${bill.customer_phone}` : ""}
        </p>
      ) : null}

      <table className="ledger-sale-bill-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Serial no.</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.map((row, index) => (
            <tr key={`${row.description}-${index}`}>
              <td>{index + 1}</td>
              <td>
                <strong>{row.description || "Item"}</strong>
                {row.made_in_date ? (
                  <small>
                    Made in{" "}
                    {formatAdminDateFromIso(row.made_in_date, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </small>
                ) : null}
                {row.warranty_months && row.warranty_until ? (
                  <small>
                    Warranty {row.warranty_months} mo · till{" "}
                    {formatWarrantyUntilLabel(row.warranty_until)}
                  </small>
                ) : null}
              </td>
              <td>{row.serial_number || "—"}</td>
              <td>₹{formatBillMoney(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ledger-sale-bill-totals">
        <p>Payment: {paymentLabel(bill.payment_method)}</p>
        <p>
          <strong>Total ₹{formatBillMoney(bill.bill_total != null ? bill.bill_total : total)}</strong>
        </p>
        {bill.balance_due != null && Number(bill.balance_due) > 0 ?
          <>
            <p>Paid today: ₹{formatBillMoney(bill.amount_paid ?? total)}</p>
            <p>
              <strong>Balance due: ₹{formatBillMoney(bill.balance_due)}</strong>
            </p>
            {bill.due_date ?
              <p>Due by {formatAdminDateFromIso(bill.due_date, { day: "numeric", month: "short", year: "numeric" })}</p>
            : null}
          </>
        : null}
      </div>
      <p className="ledger-sale-bill-thanks">
        {bill.kind === "repair"
          ? "Thank you for choosing us. Keep this bill for warranty."
          : "Thank you for shopping with us. Keep this bill for warranty."}
      </p>
    </article>
  );
}
