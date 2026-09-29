"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import InvPageShell from "@/app/components/InvPageShell";
import { apiUrl } from "@/lib/basePath";

const STATUS_OPTS = [
  { value: "", label: "All status" },
  { value: "unassigned", label: "Unassigned" },
  { value: "in_stock", label: "In stock" },
  { value: "sold", label: "Sold" },
  { value: "returned", label: "Returned" },
];

export default function InventoryQrStockListApp() {
  const [units, setUnits] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (search.trim()) qs.set("search", search.trim());
    qs.set("limit", "100");
    const res = await fetch(apiUrl(`/api/admin/inventory/qr/units?${qs}`), { credentials: "include" });
    const data = await res.json();
    if (data.ok) {
      setUnits(data.units || []);
      setTotal(data.total || 0);
    }
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <InvPageShell
      title="Stock list (QR)"
      subtitle="Every sticker code and its product link status."
      action={
        <Link href="/admin/inventory/stock/add" className="admin-btn">
          Add stock
        </Link>
      }
    >

      <div className="inv-table-toolbar admin-card">
        <input
          type="search"
          placeholder="Search code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-card inv-table-wrap">
        <table className="inv-product-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Product</th>
              <th>Status</th>
              <th>Linked</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.code}</strong>
                </td>
                <td>{u.product_name || "—"}</td>
                <td>
                  <span className={`inv-status-pill inv-qr-${u.status}`}>{u.status.replace("_", " ")}</span>
                </td>
                <td>{u.linked_at ? new Date(u.linked_at).toLocaleDateString("en-IN") : "—"}</td>
                <td>
                  <Link href={`/admin/inventory/scan?code=${encodeURIComponent(u.code)}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="inv-table-footer">
          Showing {units.length} of {total}
        </p>
      </div>
    </InvPageShell>
  );
}
