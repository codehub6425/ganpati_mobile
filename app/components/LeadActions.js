"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatPhone, telHref } from "@/lib/format";

const OPTIONS = [
  { id: "pending", label: "Pending" },
  { id: "no_answer", label: "No answer" },
  { id: "waiting", label: "Waiting" },
  { id: "done", label: "Done" },
];

function toInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function shiftHours(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours, 0, 0, 0);
  return toInputValue(date);
}

export default function LeadActions({ id, status, phone, name = "", followup = {}, compact = false }) {
  const router = useRouter();
  const dotsRef = useRef(null);
  const menuRef = useRef(null);
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const hasFollowup = Boolean(followup.status && followup.status !== "none");
  const [followStatus, setFollowStatus] = useState(hasFollowup ? followup.status : "pending");
  const [at, setAt] = useState(toInputValue(followup.at));
  const [note, setNote] = useState(followup.note || "");
  const call = telHref(phone);

  function openFollowup() {
    setFollowStatus(followup.status && followup.status !== "none" ? followup.status : "pending");
    setAt(toInputValue(followup.at));
    setNote(followup.note || "");
    setMenuOpen(false);
    setOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function toggleMenu() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    const box = dotsRef.current?.getBoundingClientRect();
    if (!box) return;

    const width = 216;
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
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function onDoc(event) {
      if (dotsRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    }

    function onKey(event) {
      if (event.key === "Escape") setMenuOpen(false);
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

  async function setLeadStatus(next) {
    if (next === "verified" && !window.confirm("Mark as verified after calling? This saves the customer for staff.")) {
      return;
    }
    if (next === "spam" && !window.confirm("Mark this as spam and hide it from new leads?")) {
      return;
    }

    setBusy(next);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        window.alert(data.message || "Could not update this lead.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Could not update this lead. Check the server.");
    } finally {
      setBusy("");
    }
  }

  async function saveFollowup(next = {}) {
    const payload = {
      status: next.status || followStatus,
      at: next.at ?? at,
      note: next.note ?? note,
    };
    setBusy("follow");
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followup: payload }),
      });
      const data = await res.json();
      if (!data.ok) {
        window.alert(data.message || "Could not save follow-up.");
        return;
      }
      setFollowStatus(payload.status);
      setAt(payload.at || "");
      setNote(payload.note || "");
      setOpen(false);
      router.refresh();
    } catch {
      window.alert("Could not save follow-up.");
    } finally {
      setBusy("");
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
            {call ? (
              <a className="admin-action-item" href={call} role="menuitem" onClick={closeMenu}>
                <PhoneIcon />
                Call {formatPhone(phone)}
              </a>
            ) : null}

            {status !== "verified" ? (
              <button
                className="admin-action-item is-ok"
                type="button"
                role="menuitem"
                disabled={Boolean(busy)}
                onClick={() => setLeadStatus("verified")}
              >
                {busy === "verified" ? "Saving…" : "Verified"}
              </button>
            ) : null}

            {status !== "spam" ? (
              <button
                className="admin-action-item is-danger"
                type="button"
                role="menuitem"
                disabled={Boolean(busy)}
                onClick={() => setLeadStatus("spam")}
              >
                {busy === "spam" ? "Hiding…" : "Spam"}
              </button>
            ) : null}

            {status !== "new" ? (
              <button
                className="admin-action-item"
                type="button"
                role="menuitem"
                disabled={Boolean(busy)}
                onClick={() => setLeadStatus("new")}
              >
                {busy === "new" ? "Moving…" : "Move to New"}
              </button>
            ) : null}

            <button className="admin-action-item" type="button" role="menuitem" onClick={openFollowup}>
              {hasFollowup ? "Update follow-up" : "Follow-up"}
            </button>
          </div>,
          document.body
        )
      : null;

  const modal =
    mounted && open
      ? createPortal(
          <div className="admin-modal" role="dialog" aria-modal="true">
            <button className="admin-modal-backdrop" type="button" onClick={() => setOpen(false)} />
            <div className="admin-modal-card">
              <div className="admin-modal-head">
                <div>
                  <h3>{hasFollowup ? "Update follow-up" : "Add follow-up"}</h3>
                  <p>{name || "Customer"}</p>
                </div>
                <button className="admin-reset-btn" type="button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              <form
                className="admin-follow"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveFollowup();
                }}
              >
                <div className="admin-follow-presets">
                  <button type="button" disabled={Boolean(busy)} onClick={() => saveFollowup({ status: "pending", at: shiftHours(0) })}>
                    Today
                  </button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => saveFollowup({ status: "waiting", at: shiftHours(24) })}>
                    Tomorrow
                  </button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => saveFollowup({ status: "no_answer", at: shiftHours(2) })}>
                    No answer
                  </button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => saveFollowup({ status: "done", at: "" })}>
                    Done
                  </button>
                </div>
                <label className="admin-sheet-label">Status</label>
                <select value={followStatus} onChange={(event) => setFollowStatus(event.target.value)}>
                  {OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <label className="admin-sheet-label">Next follow-up</label>
                <input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} />
                <label className="admin-sheet-label">Staff note</label>
                <textarea
                  rows={3}
                  maxLength={200}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Called, will visit, waiting for part…"
                />
                <button className="admin-follow-save" type="submit" disabled={Boolean(busy)}>
                  {busy === "follow" ? "Saving…" : hasFollowup ? "Update follow-up" : "Save follow-up"}
                </button>
              </form>
            </div>
          </div>,
          document.body
        )
      : null;

  if (compact) {
    return (
      <>
        <div className="admin-lead-actions is-compact">
          <button
            ref={dotsRef}
            className="admin-dots-btn"
            type="button"
            aria-label={`More actions for ${name || "lead"}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={toggleMenu}
          >
            <DotsIcon />
          </button>
        </div>
        {menu}
        {modal}
      </>
    );
  }

  return (
    <>
      <div className="admin-lead-actions">
        {call ? (
          <a className="admin-call-btn" href={call} aria-label={`Call ${formatPhone(phone)}`}>
            <PhoneIcon />
            <span>Call</span>
          </a>
        ) : null}

        {status !== "verified" ? (
          <button className="admin-verify-btn" type="button" disabled={Boolean(busy)} onClick={() => setLeadStatus("verified")}>
            {busy === "verified" ? "Saving…" : "Verified"}
          </button>
        ) : null}

        {status !== "spam" ? (
          <button className="admin-spam-btn" type="button" disabled={Boolean(busy)} onClick={() => setLeadStatus("spam")}>
            {busy === "spam" ? "Hiding…" : "Spam"}
          </button>
        ) : null}

        {status !== "new" ? (
          <button className="admin-reset-btn" type="button" disabled={Boolean(busy)} onClick={() => setLeadStatus("new")}>
            {busy === "new" ? "Moving…" : "New"}
          </button>
        ) : null}

        <button className={`admin-follow-btn${hasFollowup ? " is-update" : ""}`} type="button" onClick={openFollowup}>
          {hasFollowup ? "Update follow-up" : "Follow-up"}
        </button>
      </div>
      {modal}
    </>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.7 3 3.1 3.4 2.7 4 2.7h3.4c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.1 2.2Z"
      />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </svg>
  );
}
