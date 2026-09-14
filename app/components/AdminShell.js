"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/basePath";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "home" },
  { href: "/admin/leads", label: "Leads", icon: "leads" },
  { href: "/admin/customers", label: "Customers", icon: "people" },
  { href: "/admin/staff", label: "Staff", icon: "staff", adminOnly: true },
  { href: "/admin/jobs", label: "Jobs", icon: "jobs", soon: true },
  { href: "/admin/settings", label: "Settings", icon: "settings", soon: true },
];

const TABS = [
  { href: "/admin", label: "Home", icon: "home" },
  { href: "/admin/leads", label: "Leads", icon: "leads" },
  { href: "/admin/customers", label: "Customers", icon: "people" },
];

export default function AdminShell({ children, user = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch(apiUrl("/api/admin/logout"), { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  function isActive(href) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  const isAdmin = user?.role === "admin";
  const menu = NAV.filter((item) => !item.adminOnly || isAdmin);

  const pageTitle = pathname.startsWith("/admin/leads")
    ? "Leads"
    : pathname.startsWith("/admin/customers")
      ? "Customers"
      : pathname.startsWith("/admin/staff")
        ? "Staff"
        : "Home";

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar${open ? " is-open" : ""}`}>
        <div className="admin-brand">
          <span className="admin-brand-mark">G</span>
          <div>
            <strong>Ganpati Mobile</strong>
            <small>{user?.role === "staff" ? "Staff panel" : "Admin panel"}</small>
          </div>
        </div>

        <nav className="admin-nav">
          <p className="admin-nav-label">Menu</p>
          {menu.map((item) =>
            item.soon ? (
              <span className="admin-nav-item is-soon" key={item.href}>
                <MenuIcon name={item.icon} />
                {item.label}
                <em>Soon</em>
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-item${isActive(item.href) ? " is-active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <MenuIcon name={item.icon} />
                {item.label}
              </Link>
            )
          )}
        </nav>

        <a className="admin-nav-item" href="/" target="_blank" rel="noreferrer">
          <MenuIcon name="form" />
          View form
        </a>
      </aside>

      {open ? <button className="admin-backdrop" type="button" onClick={() => setOpen(false)} /> : null}

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-btn" type="button" onClick={() => setOpen(true)} aria-label="More">
            More
          </button>
          <p className="admin-topbar-title">{pageTitle}</p>
          <button className="admin-logout" type="button" onClick={logout}>
            Log out
          </button>
        </header>
        <div className="admin-content">{children}</div>
      </div>

      <nav className="admin-tabbar" aria-label="App navigation">
        {TABS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-tab${isActive(item.href) ? " is-active" : ""}`}
          >
            <MenuIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button className="admin-tab" type="button" onClick={() => setOpen(true)}>
          <MenuIcon name="more" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

function MenuIcon({ name }) {
  const icons = {
    home: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3.2 4 9.4V20a1 1 0 0 0 1 1h5.2v-6.2h3.6V21H19a1 1 0 0 0 1-1V9.4l-8-6.2Z"
        />
      </svg>
    ),
    leads: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M7 3h10a2 2 0 0 1 2 2v15.2l-7-3.2-7 3.2V5a2 2 0 0 1 2-2Zm2 5v2h6V8H9Zm0 4v2h6v-2H9Z"
        />
      </svg>
    ),
    people: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7.5 8a6.8 6.8 0 0 1 15 0 1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1Z"
        />
      </svg>
    ),
    staff: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20a6 6 0 0 1 12 0 1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Zm14.2-7.2 1.6 1.6-4.4 4.4-2.2-2.2 1.6-1.6  .6.6 2.8-2.8Z"
        />
      </svg>
    ),
    more: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z"
        />
      </svg>
    ),
    jobs: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="m21.6 13.1-2.1-1.2.2-1.9-2.4-.3-.9-1.8-1.8.8L13 7H11l-.6 2.7-1.8-.8-.9 1.8-2.4.3.2 1.9-2.1 1.2 1.2 2.1-1.9.2.3 2.4 1.8.9-.8 1.8L7 21h2l.6-2.7 1.8.8.9-1.8 2.4-.3-.2-1.9 2.1-1.2-1.2-2.1 1.9-.2-.3-2.4-1.8-.9.8-1.8L17 9h2l.6 2.7 1.8-.8.9 1.8 2.4.3-.2 1.9ZM12 15.2A3.2 3.2 0 1 1 15.2 12 3.2 3.2 0 0 1 12 15.2Z"
        />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19.4 13a7.8 7.8 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7.4 7.4 0 0 0-1.7-1L14.9 2h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.4L6.4 11a7.8 7.8 0 0 0 0 2L4.3 14.6l2 3.4 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.9h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.4ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"
        />
      </svg>
    ),
    form: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3ZM5 5h7v2H7v10h10v-5h2v7H5V5Z"
        />
      </svg>
    ),
  };

  return <span className="admin-menu-icon">{icons[name]}</span>;
}
