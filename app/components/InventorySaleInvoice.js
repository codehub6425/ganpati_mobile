"use client";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n) || 0);
}

export default function InventorySaleInvoice({ sale }) {
  if (!sale) return null;
  return (
    <div className="inventory-invoice ledger-print-sheet" id="inventory-invoice">
      <header className="inventory-invoice-head">
        <h1>Ganpati Mobile</h1>
        <p>Sale invoice #{sale.id}</p>
        <p>Date: {sale.sale_date}</p>
      </header>
      {sale.customer_name || sale.customer_phone ?
        <p className="inventory-invoice-customer">
          Customer: {sale.customer_name || "—"}
          {sale.customer_phone ? ` · +91 ${sale.customer_phone}` : ""}
        </p>
      : null}
      <table className="inventory-invoice-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>MRP</th>
            <th>Price</th>
            <th>Disc</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((l) => (
            <tr key={l.id}>
              <td>
                {l.product_name}
                {l.sku ? ` (${l.sku})` : ""}
              </td>
              <td>{l.qty}</td>
              <td>₹{formatMoney(l.unit_mrp)}</td>
              <td>₹{formatMoney(l.unit_selling_price)}</td>
              <td>{l.line_discount > 0 ? `₹${formatMoney(l.line_discount)}` : "—"}</td>
              <td>₹{formatMoney(l.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inventory-invoice-totals">
        <p>Subtotal: ₹{formatMoney(sale.subtotal)}</p>
        {sale.discount_total > 0 ?
          <p>Discount: −₹{formatMoney(sale.discount_total)}</p>
        : null}
        <p>
          <strong>Grand total: ₹{formatMoney(sale.grand_total)}</strong>
        </p>
        <p className="is-profit">Profit (shop): ₹{formatMoney(sale.profit_total)}</p>
        <p>Payment: {sale.payment_method || "cash"}</p>
      </div>
      {sale.notes ? <p className="inventory-invoice-notes">Note: {sale.notes}</p> : null}
    </div>
  );
}
