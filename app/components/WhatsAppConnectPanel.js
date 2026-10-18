"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/basePath";

function displayLinkNumber(digits) {
  const raw = String(digits || "").replace(/\D/g, "");
  if (raw.length === 12 && raw.startsWith("91")) {
    return `+91 ${raw.slice(2, 7)} ${raw.slice(7)}`;
  }
  return raw ? `+${raw}` : "";
}

function formatTypedCode(raw) {
  const chars = String(raw || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
  if (chars.length > 4) return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  return chars;
}

function CodeBubbles({ code }) {
  const raw = String(code || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  const cells = [];
  for (let i = 0; i < 8; i += 1) {
    if (i === 4) {
      cells.push(
        <span key="dash" className="wa-connect-bubbledash">
          -
        </span>
      );
    }
    cells.push(
      <span key={i} className="wa-connect-bubble">
        {raw.charAt(i) || ""}
      </span>
    );
  }
  return <div className="wa-connect-codevalue">{cells}</div>;
}

const STATUS_LABELS = {
  connected: "Connected",
  qr: "Scan QR",
  pairing: "Enter code on phone",
  disconnected: "Disconnected",
};

export default function WhatsAppConnectPanel() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pairBusy, setPairBusy] = useState(false);
  const [pairFormOpen, setPairFormOpen] = useState(false);
  const [pairPhone, setPairPhone] = useState("");
  const [enterCode, setEnterCode] = useState("");
  const heldCode = useRef("");
  const heldPhone = useRef("");
  const lastQr = useRef(null);
  const preferQr = useRef(false);
  const pollRef = useRef(null);

  const normalizePayload = useCallback((data) => {
    if (!data) return null;
    let status = data.status || "disconnected";

    if (data.pairing_code) {
      heldCode.current = data.pairing_code;
    }
    if (data.error && String(data.error).toLowerCase().includes("expired")) {
      heldCode.current = "";
      heldPhone.current = "";
    }
    if (data.pairing_phone) {
      heldPhone.current = data.pairing_phone;
    }

    if (status === "connected") {
      heldCode.current = "";
      heldPhone.current = "";
      lastQr.current = null;
      preferQr.current = false;
      setPairFormOpen(false);
    }

    if (preferQr.current) {
      heldCode.current = "";
      heldPhone.current = "";
    }

    if (data.qr) {
      lastQr.current = data.qr;
    }

    if (heldCode.current && status !== "connected" && status !== "qr") {
      status = "pairing";
    }

    const qrImage = data.qr || lastQr.current;
    if (preferQr.current && qrImage && status !== "connected" && status !== "pairing") {
      status = "qr";
    }

    const label = data.label || STATUS_LABELS[status] || STATUS_LABELS.disconnected;

    return {
      ...data,
      status,
      qr: qrImage,
      label,
    };
  }, []);

  const applyState = useCallback(
    (data) => {
      const next = normalizePayload(data);
      if (next) setState(next);
    },
    [normalizePayload]
  );

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/admin/whatsapp/status"), { credentials: "include" });
      const data = await res.json();
      applyState(data);
    } catch {
      /* ignore poll errors */
    }
  }, [applyState]);

  useEffect(() => {
    fetchStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const status = state?.status;
    const shouldPoll =
      status === "qr" ||
      status === "pairing" ||
      heldCode.current ||
      preferQr.current;
    if (shouldPoll) {
      pollRef.current = setInterval(fetchStatus, 2000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state?.status, fetchStatus]);

  async function postConnect(body = {}) {
    const res = await fetch(apiUrl("/api/admin/whatsapp/connect"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    applyState(data);
    return data;
  }

  async function onScanQr() {
    setBusy(true);
    preferQr.current = true;
    heldCode.current = "";
    heldPhone.current = "";
    setPairFormOpen(false);
    try {
      await postConnect({});
    } finally {
      setBusy(false);
    }
  }

  async function onGetCode(e) {
    e.preventDefault();
    preferQr.current = false;
    setPairBusy(true);
    try {
      await postConnect({ phone: pairPhone });
    } finally {
      setPairBusy(false);
    }
  }

  async function onSubmitTypedCode(e) {
    e.preventDefault();
    const custom = enterCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (custom.length !== 8) return;
    preferQr.current = false;
    setPairBusy(true);
    try {
      await postConnect({ phone: pairPhone || heldPhone.current, code: custom });
    } finally {
      setPairBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    preferQr.current = false;
    lastQr.current = null;
    try {
      const res = await fetch(apiUrl("/api/admin/whatsapp/logout"), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      applyState(data);
    } finally {
      setBusy(false);
    }
  }

  function openPairForm() {
    preferQr.current = false;
    lastQr.current = null;
    setPairFormOpen(true);
  }

  const status = state?.status || "disconnected";
  const pairingCode = state?.pairing_code || heldCode.current;
  const qrImage = state?.qr || lastQr.current;
  const showQr = status === "qr" && qrImage;
  const showPairing = status === "pairing" && pairingCode;
  const configured = state?.configured !== false;

  return (
    <section className="admin-card wa-connect-panel">
      <header className="wa-connect-head">
        <div>
          <h2>WhatsApp Web</h2>
          <p className="admin-muted">
            Link the shop WhatsApp once. Accessory bills can be sent from the day book when a customer
            is linked.
          </p>
        </div>
        <span className={`wa-connect-status is-${status}`}>{state?.label || "…"}</span>
      </header>

      {!configured ?
        <p className="wa-connect-error">
          Set <code>WHATSAPP_GATEWAY_URL</code> and <code>WHATSAPP_GATEWAY_SECRET</code> in{" "}
          <code>.env.local</code>, then restart the app. Keep the Machwale gateway running (
          <code>npm start</code> in <code>whatsapp-gateway</code>).
        </p>
      : null}

      {state?.phone ?
        <p className="wa-connect-phone">
          Linked number: <strong>{displayLinkNumber(state.phone)}</strong>
        </p>
      : null}

      {state?.error && status !== "pairing" ?
        <p className="wa-connect-error" role="alert">
          {state.error}
        </p>
      : null}

      {showQr ?
        <div className="wa-connect-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrImage} alt="WhatsApp QR code" width={280} height={280} />
          <p className="admin-muted">Open WhatsApp → Linked devices → Link a device → Scan this code.</p>
        </div>
      : null}

      {showPairing ?
        <div className="wa-connect-codeblock">
          <p className="wa-connect-codetitle">Enter this code on the phone</p>
          <CodeBubbles code={pairingCode} />
          <p className="admin-muted">
            On <strong>{displayLinkNumber(state?.pairing_phone || heldPhone.current) || "shop WhatsApp"}</strong>
            : Settings → Linked devices → Link with phone number instead.
          </p>
          <form className="wa-connect-codeform" onSubmit={onSubmitTypedCode}>
            <label>
              <span className="admin-muted">Or enter the 8-character code from WhatsApp</span>
              <input
                type="text"
                value={enterCode}
                onChange={(e) => setEnterCode(formatTypedCode(e.target.value))}
                placeholder="A5CM-9EA1"
                maxLength={9}
                disabled={pairBusy}
              />
            </label>
            <button type="submit" className="admin-btn" disabled={pairBusy || enterCode.replace(/\W/g, "").length !== 8}>
              Connect
            </button>
          </form>
        </div>
      : null}

      {status !== "connected" && configured ?
        <div className="wa-connect-actions">
          {!pairFormOpen && !showPairing ?
            <>
              <button type="button" className="admin-btn" onClick={onScanQr} disabled={busy || pairBusy}>
                {busy ? "Starting…" : showQr ? "Refresh QR code" : "Scan QR code"}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={openPairForm}
                disabled={busy || pairBusy}
              >
                Link with phone number
              </button>
            </>
          : null}

          {pairFormOpen && !showPairing ?
            <form className="wa-connect-pairform" onSubmit={onGetCode}>
              <label>
                <span>Shop WhatsApp number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  value={pairPhone}
                  onChange={(e) => setPairPhone(e.target.value)}
                  disabled={pairBusy}
                />
              </label>
              <div className="wa-connect-pairactions">
                <button type="submit" className="admin-btn" disabled={pairBusy || !pairPhone.trim()}>
                  {pairBusy ? "Getting code…" : "Get code"}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setPairFormOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          : null}
        </div>
      : null}

      {status === "connected" ?
        <div className="wa-connect-actions">
          <button type="button" className="admin-btn admin-btn-danger" onClick={onLogout} disabled={busy}>
            {busy ? "Disconnecting…" : "Disconnect WhatsApp"}
          </button>
        </div>
      : null}
    </section>
  );
}
