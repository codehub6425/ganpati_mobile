"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "@/lib/basePath";
import { confirmAction, showError, showSuccess } from "@/lib/swal";

export default function StaffStatusActions({ userId, status, name = "", disabled = false }) {
  const router = useRouter();
  const dotsRef = useRef(null);
  const menuRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const isActive = status === "active";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function onDoc(event) {
      if (dotsRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    }

    function onKey(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    function closeMenu() {
      setMenuOpen(false);
    }

    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menuOpen]);

  function toggleMenu() {
    if (disabled) return;
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    const box = dotsRef.current?.getBoundingClientRect();
    if (!box) return;

    const width = 220;
    let left = box.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;

    setMenuPos({ top: box.bottom + 6, left });
    setMenuOpen(true);
  }

  async function setAccountStatus(next) {
    if (busy || disabled) return;
    setMenuOpen(false);

    if (next === "suspended") {
      const ok = await confirmAction({
        title: "Suspend staff?",
        text: "They will not be able to log in until you mark the account active again.",
        confirmText: "Suspend",
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showError(data.message || "Could not update status.");
        return;
      }
      if (next === "active") {
        await showSuccess("Staff account is active again.");
      } else {
        await showSuccess("Staff account suspended.");
      }
      router.refresh();
    } catch {
      showError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const menu =
    mounted && menuOpen
      ? createPortal(
          <div
            ref={menuRef}
            className="admin-action-menu"
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <p className="admin-action-menu-label">Update status</p>
            {isActive ? (
              <button
                className="admin-action-item is-danger"
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => setAccountStatus("suspended")}
              >
                {busy ? "Updating…" : "Suspend account"}
              </button>
            ) : (
              <button
                className="admin-action-item is-ok"
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => setAccountStatus("active")}
              >
                {busy ? "Updating…" : "Mark active"}
              </button>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="admin-staff-status-actions">
        <span
          className={`admin-status admin-staff-status${isActive ? " is-active-account" : " is-suspended-account"}`}
        >
          {isActive ? "Active" : "Suspended"}
        </span>
        <button
          ref={dotsRef}
          className="admin-dots-btn"
          type="button"
          aria-label={`More actions for ${name || "staff"}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={disabled}
          onClick={toggleMenu}
        >
          <DotsIcon />
        </button>
      </div>
      {menu}
    </>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}
