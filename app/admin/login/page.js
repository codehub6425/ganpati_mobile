"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "../../admin.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Login failed.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-wrap">
        <div className="login-brand">
          <span className="admin-brand-mark">G</span>
          <div>
            <strong>Ganpati Mobile Point</strong>
            <small>Nirman Nagar, Jaipur</small>
          </div>
        </div>
        <h1>Welcome back</h1>
        <p>Sign in with your admin or staff account to manage leads.</p>
        <form onSubmit={onSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="you@shop.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <div className="login-password">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                className="login-eye"
                type="button"
                onClick={() => setShowPassword((open) => !open)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>
          {error ? <p className="admin-error">{error}</p> : null}
          <button className="admin-btn" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
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
