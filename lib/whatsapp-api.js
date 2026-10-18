import { publicWhatsappError, whatsappConfigured } from "./whatsapp-gateway.js";

export function whatsappStatusLabel(status) {
  if (status === "connected") return "Connected";
  if (status === "qr") return "Scan QR";
  if (status === "pairing") return "Enter code on phone";
  return "Disconnected";
}

export function whatsappJsonPayload(state, ok = true) {
  const status = state.status || "disconnected";
  return {
    ok,
    status,
    connected: status === "connected",
    configured: whatsappConfigured(),
    phone: state.phone ?? null,
    qr: state.qr ?? null,
    pairing_code: state.pairing_code ?? null,
    pairing_phone: state.pairing_phone ?? null,
    error: publicWhatsappError(state.error, status) || null,
    gateway: Boolean(state.gateway),
    label: whatsappStatusLabel(status),
  };
}
