"use client";

import SaleBillSheet from "./SaleBillSheet";
import { saleBillFromInventorySale } from "@/lib/sale-bill";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n) || 0);
}

export default function InventorySaleInvoice({ sale }) {
  const bill = saleBillFromInventorySale(sale);
  if (!bill) return null;
  return (
    <div className="inventory-invoice-wrap">
      <SaleBillSheet bill={bill} />
      {sale.profit_total != null ?
        <p className="is-profit inventory-invoice-shop-only">Profit (shop): ₹{formatMoney(sale.profit_total)}</p>
      : null}
    </div>
  );
}
