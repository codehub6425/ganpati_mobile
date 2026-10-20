"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import InvPageShell from "@/app/components/InvPageShell";
import { apiUrl } from "@/lib/basePath";
import { confirmAction, showError, showSuccess } from "@/lib/swal";

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

  async function removeUnusedCode(u) {
    if (u.is_linked || u.status !== "unassigned") {
      showError("Linked QR codes cannot be deleted.");
      return;
    }
    const ok = await confirmAction({
      title: "Delete unused code?",
      text: `${u.code} will be removed permanently.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    const res = await fetch(apiUrl(`/api/admin/inventory/qr/units?code=${encodeURIComponent(u.code)}`), {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Could not delete.");
      return;
    }
    showSuccess("Unused code removed.");
    load();
  }

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
              <th>Product link</th>
              <th>Linked on</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.code}</strong>
                </td>
                <td>
                  {u.product_id && u.product_name ?
                    <Link href={`/admin/inventory/products/${u.product_id}`}>{u.product_name}</Link>
                  : "—"}
                </td>
                <td>
                  <span className={`inv-status-pill inv-qr-${u.status}`}>{u.status.replace("_", " ")}</span>
                </td>
                <td>
                  {u.is_linked ?
                    <span className="inv-status-pill is-ok">Linked</span>
                  : u.status === "unassigned" ?
                    <span className="inv-status-pill is-muted">Not linked</span>
                  : (
                    <span className="inv-status-pill is-muted">—</span>
                  )}
                </td>
                <td>{u.linked_at ? new Date(u.linked_at).toLocaleDateString("en-IN") : "—"}</td>
                <td className="inv-col-actions">
                  <Link href={`/admin/inventory/scan?code=${encodeURIComponent(u.code)}`}>View</Link>
                  {u.status === "unassigned" && !u.is_linked ?
                    <button type="button" className="inv-text-btn is-danger" onClick={() => removeUnusedCode(u)}>
                      Delete
                    </button>
                  : null}
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
