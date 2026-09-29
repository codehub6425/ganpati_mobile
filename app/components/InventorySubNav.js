"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/inventory", label: "Dashboard", exact: true },
  { href: "/admin/inventory/products", label: "Products" },
  { href: "/admin/inventory/stock", label: "Stock (QR)" },
  { href: "/admin/inventory/stock/add", label: "Add stock" },
  { href: "/admin/inventory/qr", label: "QR management" },
  { href: "/admin/inventory/purchases", label: "Purchases" },
  { href: "/admin/inventory/sales/new", label: "Sales" },
  { href: "/admin/inventory/requests", label: "Requests" },
  { href: "/admin/inventory/reports", label: "Reports" },
  { href: "/admin/inventory/scan", label: "Scan" },
];

export default function InventorySubNav() {
  const pathname = usePathname();

  function active(href, exact) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="inv-subnav" aria-label="Inventory sections">
      {LINKS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={active(item.href, item.exact) ? "is-active" : ""}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
