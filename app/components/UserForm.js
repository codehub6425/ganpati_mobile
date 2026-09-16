"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import { showError } from "@/lib/swal";

export default function UserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: "staff" }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.message || "Could not add this user.");
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setOpen(false);
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
                  <p>Give this person shop login. They will not see admin accounts.</p>
                </div>
                <button className="admin-reset-btn" type="button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              <form className="admin-follow" onSubmit={onSubmit}>
                <label className="admin-sheet-label">Name</label>
                <input value={name} onChange={(event) => setName(event.target.value)} required />
                <label className="admin-sheet-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <label className="admin-sheet-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
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
