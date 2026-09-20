"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import { DEFAULT_STAFF_PASSWORD } from "@/lib/staff";
import { showError, showSuccess } from "@/lib/swal";

export default function UserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    const emailTrim = email.trim().toLowerCase();
    const phoneTrim = phone.trim();
    if (!emailTrim && !phoneTrim) {
      showError("Enter mobile number (or email if no mobile).");
      return;
    }
    if (emailTrim && !emailTrim.includes("@")) {
      showError("Enter a valid email address.");
      return;
    }
    if (phoneTrim && phoneTrim.length !== 10) {
      showError("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: emailTrim || undefined,
          phone: phoneTrim || undefined,
          role: "staff",
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.message || "Could not add this user.");
        return;
      }
      setName("");
      setEmail("");
      setPhone("");
      setOpen(false);
      await showSuccess(
        `Staff added. They sign in with mobile (or email) and default password ${DEFAULT_STAFF_PASSWORD}, then set a new password on first login.`
      );
      router.refresh();
    } catch {
      showError("Could not add this user.");
    } finally {
      setBusy(false);
    }
  }

  const modal =
    mounted && open
      ? createPortal(
          <div className="admin-modal" role="dialog" aria-modal="true">
            <button className="admin-modal-backdrop" type="button" onClick={() => setOpen(false)} />
            <div className="admin-modal-card">
              <div className="admin-modal-head">
                <div>
                  <h3>Add staff</h3>
                  <p>
                    Default password: <strong>{DEFAULT_STAFF_PASSWORD}</strong>. Staff must set a new
                    password on first login.
                  </p>
                </div>
                <button className="admin-reset-btn" type="button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              <form className="admin-follow" onSubmit={onSubmit} noValidate>
                <label className="admin-sheet-label">Name</label>
                <input value={name} onChange={(event) => setName(event.target.value)} required />
                <label className="admin-sheet-label">Mobile</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit mobile (preferred for login)"
                  maxLength={10}
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                />
                <label className="admin-sheet-label">Email</label>
                <input
                  type="email"
                  value={email}
                  placeholder="Optional if mobile is added"
                  onChange={(event) => setEmail(event.target.value)}
                />
                <p className="admin-field-hint">
                  Mobile is preferred. Add email only when needed — at least one of mobile or email is
                  required.
                </p>
                <button className="admin-follow-save" type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save staff"}
                </button>
              </form>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button className="admin-btn" type="button" onClick={() => setOpen(true)}>
        Add staff
      </button>
      {modal}
    </>
  );
}
