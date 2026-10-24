"use client";

import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/ledger";

function resolveMethod(value) {
  const v = String(value || "").trim().toLowerCase();
  return PAYMENT_METHODS.includes(v) ? v : "cash";
}

function PaymentMethodIcon({ method }) {
  if (method === "upi") {
    return (
      <svg className="payment-method-icon is-upi" viewBox="0 0 32 20" width="32" height="20" aria-hidden>
        <path fill="#097939" d="M4 16 L14 4 L14 10 L20 4 L20 16 L10 16 L10 10 Z" opacity="0.95" />
        <path fill="#F47920" d="M12 16 L22 4 L22 10 L28 4 L28 16 L18 16 L18 10 Z" opacity="0.95" />
      </svg>
    );
  }

  if (method === "cash") {
    return (
      <svg className="payment-method-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <circle cx="12" cy="12" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M6 9h.01M18 15h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (method === "sbi") {
    return (
      <span className="payment-method-icon is-bank-badge is-sbi" aria-hidden>
        SBI
      </span>
    );
  }

  if (method === "boi") {
    return (
      <span className="payment-method-icon is-bank-badge is-boi" aria-hidden>
        BOI
      </span>
    );
  }

  return (
    <svg className="payment-method-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="7" cy="14" r="1" fill="currentColor" />
      <circle cx="12" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

/**
 * Icon chip row for cash / UPI / bank methods. Empty value = cash (ledger default).
 */
export default function PaymentMethodPicker({
  value,
  onChange,
  compact = false,
  label = "Paid via",
  optionalHint = true,
}) {
  const selected = resolveMethod(value);

  function pick(method) {
    onChange(method === "cash" ? "" : method);
  }

  return (
    <div className={`payment-method-picker${compact ? " is-compact" : ""}`}>
      <span className="payment-method-picker-label">
        {label}
        {optionalHint ?
          <span className="payment-method-picker-optional"> (optional)</span>
        : null}
      </span>
      <div className="payment-method-picker-chips" role="radiogroup" aria-label={label}>
        {PAYMENT_METHODS.map((method) => {
          const active = selected === method;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={active}
              title={PAYMENT_METHOD_LABELS[method]}
              className={`payment-method-chip${active ? " is-active" : ""}${method === "upi" ? " is-upi" : ""}`}
              onClick={() => pick(method)}
            >
              <span className={`payment-method-chip-icon is-${method}`}>
                <PaymentMethodIcon method={method} />
              </span>
              <span className="payment-method-chip-label">{PAYMENT_METHOD_LABELS[method]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
