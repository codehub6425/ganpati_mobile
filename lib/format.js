export function titleCase(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

export function formatPhone(value) {
  const digits = phoneDigits(value);
  if (digits.length !== 10) return value ? `+91 ${value}` : "—";
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function telHref(value) {
  const digits = phoneDigits(value);
  return digits ? `tel:+91${digits}` : "";
}
