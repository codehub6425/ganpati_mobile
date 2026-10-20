"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import WhatsappBrandIcon from "@/app/components/WhatsappBrandIcon";

function MenuLinesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 7a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1zm0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1zm0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1z"
      />
    </svg>
  );
}

export default function LedgerEntryActions({
  entry,
  whatsappConnected,
  sending,
  waCount,
  historyTitle,
  onSendWhatsapp,
  onShowHistory,
  onPrintBill,
  onDelete,
}) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  const phoneOk = String(entry.customer_phone || "").replace(/\D/g, "").length >= 10;
  const showBillActions = entry.category === "accessory" || entry.category === "repair";
  const canSend = showBillActions && phoneOk;

  function closeMenu() {
    setMenuOpen(false);
  }

  function toggleMenu() {
    if (menuOpen) {
      closeMenu();
      return;
    }
    const box = btnRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = 248;
    let left = box.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    setMenuPos({ top: box.bottom + 6, left });
    setMenuOpen(true);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function onDoc(event) {
      if (btnRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      closeMenu();
    }

    function onKey(event) {
      if (event.key === "Escape") closeMenu();
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

  const menu =
    mounted && menuOpen ?
      createPortal(
        <div
          ref={menuRef}
          className="admin-action-menu ledger-entry-action-menu"
          role="menu"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {canSend ?
            <button
              type="button"
              className="admin-action-item ledger-entry-action-wa"
              role="menuitem"
              disabled={sending || !whatsappConnected}
              title={
                whatsappConnected ? undefined : "Connect WhatsApp in Settings first"
              }
              onClick={() => {
                closeMenu();
                onSendWhatsapp();
              }}
            >
              <WhatsappBrandIcon size={22} />
              <span className="ledger-entry-action-text">
                {sending ? "Sending…" : "Send message"}
                {waCount > 0 ?
                  <small className="ledger-entry-action-meta"> · sent {waCount}×</small>
                : null}
              </span>
            </button>
          : null}

          {showBillActions && onPrintBill ?
            <button
              type="button"
              className="admin-action-item"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onPrintBill();
              }}
            >
              Print / PDF bill
            </button>
          : null}

          {showBillActions ?
            <button
              type="button"
              className="admin-action-item ledger-entry-action-history"
              role="menuitem"
              title={historyTitle || undefined}
              onClick={() => {
                closeMenu();
                onShowHistory();
              }}
            >
              <span>Show message history</span>
              {waCount > 0 ?
                <span className="ledger-entry-action-badge">{waCount}</span>
              : null}
            </button>
          : null}

          <button
            type="button"
            className="admin-action-item is-danger"
            role="menuitem"
            onClick={() => {
              closeMenu();
              onDelete();
            }}
          >
            Delete entry
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="ledger-row-actions is-menu-only">
      <button
        ref={btnRef}
        type="button"
        className="admin-dots-btn ledger-entry-menu-btn"
        aria-label="Entry actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={toggleMenu}
      >
        <MenuLinesIcon />
      </button>
      {menu}
    </div>
  );
}
