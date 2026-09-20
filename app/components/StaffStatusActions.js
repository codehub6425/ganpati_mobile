"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "@/lib/basePath";
import { confirmAction, showError, showSuccess } from "@/lib/swal";

export default function StaffStatusActions({
  userId,
  status,
  name = "",
  phone = "",
  email = "",
  blockSuspend = false,
}) {
  const router = useRouter();
  const dotsRef = useRef(null);
  const menuRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(name || "");
  const [phoneDraft, setPhoneDraft] = useState(phone || "");
  const [emailDraft, setEmailDraft] = useState(email || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const isActive = status === "active";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!editOpen) {
      setNameDraft(name || "");
      setPhoneDraft(phone || "");
      setEmailDraft(email || "");
    }
  }, [name, phone, email, editOpen]);

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

  function openEditDetails() {
    setMenuOpen(false);
    setNameDraft(name || "");
    setPhoneDraft(phone || "");
    setEmailDraft(email || "");
    setEditOpen(true);
  }

  function validateProfileDraft() {
    const nameTrim = nameDraft.trim();
    const emailTrim = emailDraft.trim().toLowerCase();
    const phoneTrim = phoneDraft.trim();
    if (!nameTrim) {
      showError("Name is required.");
      return false;
    }
    if (!emailTrim && !phoneTrim) {
      showError("Enter mobile number (or email if no mobile).");
      return false;
    }
    if (emailTrim && !emailTrim.includes("@")) {
      showError("Enter a valid email address.");
      return false;
    }
    if (phoneTrim && phoneTrim.length !== 10) {
      showError("Enter a valid 10-digit mobile number.");
      return false;
    }
    return true;
  }

  async function saveDetails(event) {
    event.preventDefault();
    if (busy || !validateProfileDraft()) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameDraft.trim(),
          email: emailDraft.trim().toLowerCase(),
          phone: phoneDraft.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showError(data.message || "Could not update staff.");
        return;
      }
      setEditOpen(false);
      await showSuccess("Staff details updated.");
      router.refresh();
    } catch {
      showError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function setAccountStatus(next) {
    if (busy || blockSuspend) return;
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
            <p className="admin-action-menu-label">Staff actions</p>
            <button
              className="admin-action-item"
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={openEditDetails}
            >
              Edit details
            </button>
            {isActive ? (
              <button
                className="admin-action-item is-danger"
                type="button"
                role="menuitem"
                disabled={busy || blockSuspend}
                title={blockSuspend ? "You cannot suspend your own account." : undefined}
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

  const editModal =
    mounted && editOpen
      ? createPortal(
          <div className="admin-modal" role="dialog" aria-modal="true">
            <button
              className="admin-modal-backdrop"
              type="button"
              onClick={() => !busy && setEditOpen(false)}
            />
            <div className="admin-modal-card">
              <div className="admin-modal-head">
                <div>
                  <h3>Edit staff</h3>
                  <p>Update name, mobile, and email. Mobile is preferred for login.</p>
                </div>
                <button
                  className="admin-reset-btn"
                  type="button"
                  disabled={busy}
                  onClick={() => setEditOpen(false)}
                >
                  Close
                </button>
              </div>
              <form className="admin-follow" onSubmit={saveDetails} noValidate>
                <label className="admin-sheet-label">Name</label>
                <input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  required
                />
                <label className="admin-sheet-label">Mobile</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit mobile (preferred for login)"
                  maxLength={10}
                  value={phoneDraft}
                  onChange={(event) =>
                    setPhoneDraft(event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                />
                <label className="admin-sheet-label">Email</label>
                <input
                  type="email"
                  placeholder="Optional if mobile is added"
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                />
                <p className="admin-field-hint">
                  At least mobile or email is required. Clear a field only if the other login is set.
                </p>
                <button className="admin-follow-save" type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </form>
            </div>
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
          onClick={toggleMenu}
        >
          <DotsIcon />
        </button>
      </div>
      {menu}
      {editModal}
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
