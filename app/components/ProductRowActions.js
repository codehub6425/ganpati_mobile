"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

export default function ProductRowActions({ product, onLinkQr, onDelete }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  function toggleMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    if (menuOpen) {
      closeMenu();
      return;
    }
    const box = btnRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = 200;
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

  const editHref = `/admin/inventory/products/${product.id}`;

  const menu =
    mounted && menuOpen ?
      createPortal(
        <div
          ref={menuRef}
          className="admin-action-menu inv-product-action-menu"
          role="menu"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <button
            type="button"
            className="admin-action-item"
            role="menuitem"
            onClick={(e) => {
              closeMenu();
              onLinkQr(product, e);
            }}
          >
            Link QR
          </button>
          <Link
            href={editHref}
            className="admin-action-item"
            role="menuitem"
            onClick={() => closeMenu()}
          >
            Edit product
          </Link>
          <button
            type="button"
            className="admin-action-item is-danger"
            role="menuitem"
            onClick={(e) => {
              closeMenu();
              onDelete(product, e);
            }}
          >
            Delete
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="inv-row-actions is-menu-only">
      <button
        ref={btnRef}
        type="button"
        className="admin-dots-btn inv-product-menu-btn"
        aria-label={`Actions for ${product.name}`}
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
