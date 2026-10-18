/**
 * HTTP client for the shared Machwale Baileys gateway (Express on WHATSAPP_GATEWAY_URL).
 */

function config() {
  const secret = String(process.env.WHATSAPP_GATEWAY_SECRET || "").trim();
  const base = String(process.env.WHATSAPP_GATEWAY_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
  const shopIdRaw = String(process.env.WHATSAPP_SHOP_ID || "100").replace(/\D/g, "");
  const shopId = shopIdRaw !== "" ? shopIdRaw : "100";
  const timeout = Math.max(3, Number(process.env.WHATSAPP_GATEWAY_TIMEOUT) || 8);
  const sendTimeout = Math.max(15, Number(process.env.WHATSAPP_GATEWAY_SEND_TIMEOUT) || 90);
  return { secret, base, shopId, timeout, sendTimeout };
}

function emptyState(extra = {}) {
  return {
    status: "disconnected",
    phone: null,
    qr: null,
    pairing_code: null,
    pairing_phone: null,
    error: extra.error ?? null,
    gateway: extra.gateway ?? false,
  };
}

function normalizePayload(payload) {
  let status = payload?.status ?? "disconnected";
  if (!["disconnected", "qr", "pairing", "connected"].includes(status)) {
    status = "disconnected";
  }
  const pairingCode = payload?.pairing_code ?? payload?.pairingCode ?? null;
  const pairingPhone = payload?.pairing_phone ?? payload?.pairingPhone ?? null;
  return {
    status,
    phone: payload?.phone ?? null,
    qr: payload?.qr ?? null,
    pairing_code: pairingCode ? String(pairingCode) : null,
    pairing_phone: pairingPhone ? String(pairingPhone) : null,
    error: payload?.error ?? null,
    gateway: Boolean(payload?.gateway),
  };
}

async function request(method, path, body, timeoutMs) {
  const { secret, base } = config();
  if (!secret || !base) {
    return {
      ok: false,
      ...emptyState({ error: "WhatsApp gateway is not configured", gateway: false }),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const init = {
      method,
      headers: {
        "X-WhatsApp-Secret": secret,
        Accept: "application/json",
      },
      signal: controller.signal,
    };
    if (method !== "GET" && body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetch(`${base}${path}`, init);
    const json = await response.json().catch(() => ({}));
    const merged = { ...json, gateway: true, http_status: response.status };
    if (!response.ok && !merged.error) {
      merged.error = `WhatsApp gateway error (HTTP ${response.status})`;
      merged.status = merged.status ?? "disconnected";
    }
    return merged;
  } catch (err) {
    const isAbort = err?.name === "AbortError";
    return {
      ok: false,
      ambiguous: isAbort,
      ...emptyState({
        error: isAbort
          ? "WhatsApp send timed out (message may still have been delivered)."
          : "WhatsApp gateway is not running. Start whatsapp-gateway on port 3001.",
        gateway: false,
      }),
    };
  } finally {
    clearTimeout(timer);
  }
}

function sessionPath(suffix = "") {
  const { shopId } = config();
  return `/session/${shopId}${suffix}`;
}

export function whatsappShopId() {
  return config().shopId;
}

export function whatsappConfigured() {
  const { secret, base } = config();
  return Boolean(secret && base);
}

/** @returns {Promise<{ status: string, phone: ?string, qr: ?string, pairing_code: ?string, pairing_phone: ?string, error: ?string, gateway: boolean }>} */
export async function whatsappStatus() {
  const payload = await request("GET", sessionPath(), undefined, config().timeout);
  return normalizePayload({ ...payload, gateway: payload.gateway ?? true });
}

/** @returns {Promise<ReturnType<typeof normalizePayload>>} */
export async function whatsappStart(clearPairing = true) {
  const payload = await request(
    "POST",
    sessionPath("/start"),
    clearPairing ? {} : undefined,
    Math.max(25, config().timeout)
  );
  return normalizePayload({ ...payload, gateway: payload.gateway ?? true });
}

/** @returns {Promise<ReturnType<typeof normalizePayload>>} */
export async function whatsappPair(phone, code = null) {
  const body = { phone: String(phone || "").trim() };
  if (code) {
    body.code = String(code).trim();
  }
  let payload = await request("POST", sessionPath("/pair"), body, Math.max(25, config().timeout));
  if (Number(payload.http_status) === 404) {
    payload = await request("POST", sessionPath("/start"), body, Math.max(25, config().timeout));
  }
  const state = normalizePayload({ ...payload, gateway: payload.gateway ?? true });
  if (
    !state.pairing_code &&
    state.status !== "connected" &&
    state.status !== "pairing" &&
    !state.error
  ) {
    state.error = "Could not get a pairing code. Try again in a moment.";
  }
  return state;
}

/** @returns {Promise<ReturnType<typeof normalizePayload>>} */
export async function whatsappLogout() {
  const payload = await request("POST", sessionPath("/logout"), {}, config().timeout);
  return normalizePayload({ ...payload, gateway: payload.gateway ?? true });
}

/**
 * @param {{ to: string, text: string, buttons?: Array<{label: string, url: string}>, footer?: string }} opts
 */
export async function whatsappSendMessage(opts) {
  const payload = await request(
    "POST",
    sessionPath("/send"),
    {
      to: opts.to,
      text: opts.text,
      buttons: opts.buttons,
      footer: opts.footer,
    },
    config().sendTimeout
  );

  if (payload.ok) {
    return {
      ok: true,
      error: null,
      via: payload.via ?? "text",
      buttons_sent: Number(payload.buttons_sent ?? 0),
    };
  }

  return {
    ok: false,
    error: payload.error ?? "WhatsApp send failed",
    via: payload.via ?? null,
    ambiguous: Boolean(payload.ambiguous),
  };
}

export function publicWhatsappError(raw, status) {
  const msg = String(raw || "").trim();
  if (!msg || status === "connected") return "";
  const low = msg.toLowerCase();
  if (
    low.includes("stream") ||
    low.includes("restart") ||
    low.includes("gateway") ||
    low.includes("http") ||
    low.includes("socket") ||
    low.includes("connection closed") ||
    low.includes("not running") ||
    low.includes("not configured") ||
    low.includes("boom") ||
    low.includes("econn")
  ) {
    return "";
  }
  if (low.includes("expired")) {
    return "The code expired. Tap Get code for a new one.";
  }
  if (low.includes("logged out")) {
    return "WhatsApp was unlinked. Scan the QR or link with a phone number again.";
  }
  if (low.includes("could not get a pairing")) {
    return "Could not get a pairing code. Try again in a moment.";
  }
  if (low.includes("unauthorized")) {
    return "Gateway secret mismatch. Ganpati WHATSAPP_GATEWAY_SECRET must equal whatsapp-gateway GATEWAY_SECRET, then pm2 restart both.";
  }
  return msg;
}
