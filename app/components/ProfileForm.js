"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { showError, showSuccess } from "@/lib/swal";

function ProfilePasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="admin-sheet-label">
      <span>{label}</span>
      <div className="login-password admin-profile-password">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
        />
        <button
          className="login-eye"
          type="button"
          onClick={() => setVisible((open) => !open)}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

export default function ProfileForm({ initialName = "", email = "", role = "staff" }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      showError("New password and confirmation do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/profile"), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          current_password: newPassword ? currentPassword : "",
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showError(data.message || "Could not save profile.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (data.profile?.name) setName(data.profile.name);
      await showSuccess("Your profile has been updated.");
      router.refresh();
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = role === "admin" ? "Admin" : "Staff";

  return (
    <div className="admin-profile-page">
      <header className="admin-profile-head">
        <h1>My profile</h1>
        <p>Update your display name and password for this shop login.</p>
      </header>

      <section className="admin-card admin-profile-card">
        <div className="admin-profile-meta">
          <span className="admin-profile-avatar" aria-hidden="true">
            {(name || "?").charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{name || "—"}</strong>
            <p>{email || "No email on file"}</p>
            <span className="admin-profile-role">{roleLabel}</span>
          </div>
        </div>

        <form className="admin-profile-form" onSubmit={onSubmit} autoComplete="on">
          {email ? (
            <input
              className="admin-profile-autofill-user"
              type="text"
              name="username"
              autoComplete="username"
              value={email}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
            />
          ) : null}

          <label className="admin-sheet-label">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>

          <div className="admin-profile-divider">
            <p>Change password</p>
            <small>Leave blank to keep your current password.</small>
          </div>

          <ProfilePasswordField
            label="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Required only when setting a new password"
          />

          <ProfilePasswordField
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            minLength={6}
          />

          <ProfilePasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Repeat new password"
          />

          <button className="admin-btn" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5A2.5 2.5 0 1 0 9.5 12 2.5 2.5 0 0 0 12 14.5Z"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.3 2.3 2 3.6l3.2 3.2C3.3 8.1 1.8 9.9 1 12c1.7 3.9 6 7 11 7 1.8 0 3.5-.4 5-.1l3.7 3.7 1.3-1.3ZM12 17c-3.7 0-6.9-2.1-8.5-5 .8-1.4 2-2.7 3.5-3.5l2 2A5 5 0 0 0 12 16a5 5 0 0 0 3.2-1.2l1.5 1.5c-1.3.5-2.9.7-4.7.7Zm9.9-5c-.5-1.2-1.3-2.3-2.3-3.2l-1.5 1.5c.6.5 1.1 1.1 1.4 1.7-1.6 2.9-4.8 5-8.5 5-.5 0-1 0-1.4-.1l-1.7 1.7c1 .3 2 .4 3.1.4 5 0 9.3-3.1 11-7ZM8.1 6.9 9.7 8.5A5 5 0 0 1 16 12c0 .3 0 .5-.1.8l2.2 2.2c1.3-.9 2.4-2.1 3.1-3.5-1.7-3.9-6-7-11-7-1.3 0-2.6.2-3.8.6Z"
      />
    </svg>
  );
}
