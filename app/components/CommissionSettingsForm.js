"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { showError, showSuccess } from "@/lib/swal";

const CALC_OPTIONS = [
  { id: "percent", label: "Percent", hint: "% of amount" },
  { id: "fixed", label: "Fixed", hint: "₹ per entry" },
  { id: "slab", label: "Slab", hint: "Tier steps (₹ per band)" },
];

const RULE_META = {
  money_transfer_mt: { short: "M/T", tone: "mt" },
  money_transfer_redem: { short: "RD", tone: "redeem" },
  money_transfer_aps: { short: "APS", tone: "aps" },
  recharge: { short: "RC", tone: "recharge" },
};

function ruleHelper(rule) {
  if (rule.rule_key === "money_transfer_mt") {
    return "₹0–1000 → ₹10 · ₹1000–2000 → ₹20 (each ₹1000 band, incl. ₹700 → ₹10)";
  }
  if (rule.rule_key === "money_transfer_redem") {
    return "₹0–100 → ₹10 · ₹100–200 → ₹20 (each ₹100 band)";
  }
  if (rule.rule_key === "money_transfer_aps") {
    return "Same tiers as M/T: ₹1000 band → ₹10 fee; deducted from collection";
  }
  if (rule.rule_key === "recharge") {
    return "2.5% on ₹1000 recharge → ₹25 revenue";
  }
  return "";
}

function emptyDraft(rule) {
  return {
    calc_type: rule.calc_type || "percent",
    rate: rule.rate ?? "",
    slab_base: rule.slab_base ?? "",
    slab_value: rule.slab_value ?? "",
    base_field: rule.base_field || "amount",
    is_active: rule.is_active !== false,
  };
}

export default function CommissionSettingsForm({ initialRules = [] }) {
  const [rules, setRules] = useState(initialRules);
  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    setRules(initialRules);
    const next = {};
    for (const rule of initialRules) {
      next[rule.rule_key] = emptyDraft(rule);
    }
    setDrafts(next);
  }, [initialRules]);

  function setDraft(ruleKey, patch) {
    setDrafts((prev) => ({
      ...prev,
      [ruleKey]: { ...prev[ruleKey], ...patch },
    }));
  }

  async function saveRule(ruleKey) {
    const draft = drafts[ruleKey];
    if (!draft) return;
    setBusyKey(ruleKey);
    try {
      const res = await fetch(apiUrl("/api/admin/commission-rules"), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_key: ruleKey,
          calc_type: draft.calc_type,
          rate: draft.rate,
          slab_base: draft.slab_base,
          slab_value: draft.slab_value,
          base_field: draft.base_field,
          is_active: draft.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not save.");
        return;
      }
      setRules((prev) => prev.map((r) => (r.rule_key === ruleKey ? data.rule : r)));
      setDraft(ruleKey, emptyDraft(data.rule));
      showSuccess("Commission rule saved.");
    } catch {
      showError("Network error.");
    } finally {
      setBusyKey("");
    }
  }

  if (!rules.length) {
    return <p className="admin-muted">No commission rules found. Refresh after database migration.</p>;
  }

  return (
    <div className="commission-settings">
      <div className="commission-intro admin-card">
        <p className="commission-intro-title">Commission master</p>
        <p className="commission-intro-text">
          Set default revenue for <strong>Recharge</strong>, <strong>M/T</strong>,{" "}
          <strong>Redeem</strong>, and <strong>APS</strong>. Staff see the calculated fee when adding
          entries and can change it before saving.
        </p>
      </div>

      <div className="commission-settings-grid">
        {rules.map((rule) => {
          const draft = drafts[rule.rule_key] || emptyDraft(rule);
          const meta = RULE_META[rule.rule_key] || { short: "?", tone: "default" };
          const isSlab = draft.calc_type === "slab";
          const isPercentOrFixed = draft.calc_type === "percent" || draft.calc_type === "fixed";
          const inactive = !draft.is_active;

          return (
            <section
              className={`admin-card commission-rule-card is-${meta.tone}${inactive ? " is-inactive" : ""}`}
              key={rule.rule_key}
            >
              <header className="commission-rule-head">
                <div className="commission-rule-title">
                  <span className={`commission-rule-icon is-${meta.tone}`} aria-hidden="true">
                    {meta.short}
                  </span>
                  <div>
                    <h2>{rule.label}</h2>
                    <p className="commission-rule-example">{ruleHelper(rule)}</p>
                  </div>
                </div>
                <label className="commission-switch">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => setDraft(rule.rule_key, { is_active: e.target.checked })}
                  />
                  <span className="commission-switch-ui" aria-hidden="true" />
                  <span className="commission-switch-label">{draft.is_active ? "On" : "Off"}</span>
                </label>
              </header>

              <div className="commission-rule-body">
                <p className="commission-section-label">Calculation method</p>
                <div className="commission-calc-types" role="group" aria-label="Calculation type">
                  {CALC_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`commission-calc-chip${draft.calc_type === opt.id ? " is-active" : ""}`}
                      onClick={() => setDraft(rule.rule_key, { calc_type: opt.id })}
                    >
                      <strong>{opt.label}</strong>
                      <small>{opt.hint}</small>
                    </button>
                  ))}
                </div>

                <div className="commission-fields">
                  {isPercentOrFixed ? (
                    <label className="commission-field">
                      <span>{draft.calc_type === "percent" ? "Rate (%)" : "Fixed amount (₹)"}</span>
                      <input
                        className="commission-input"
                        type="number"
                        min="0"
                        step={draft.calc_type === "percent" ? "0.01" : "1"}
                        value={draft.rate}
                        onChange={(e) => setDraft(rule.rule_key, { rate: e.target.value })}
                      />
                    </label>
                  ) : null}

                  {isSlab ? (
                    <>
                      <label className="commission-field">
                        <span>When amount is (₹)</span>
                        <input
                          className="commission-input"
                          type="number"
                          min="1"
                          step="1"
                          value={draft.slab_base}
                          onChange={(e) => setDraft(rule.rule_key, { slab_base: e.target.value })}
                        />
                      </label>
                      <label className="commission-field">
                        <span>Commission (₹)</span>
                        <input
                          className="commission-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.slab_value}
                          onChange={(e) => setDraft(rule.rule_key, { slab_value: e.target.value })}
                        />
                      </label>
                    </>
                  ) : null}
                </div>

                {rule.rule_key === "money_transfer_mt" ? (
                  <p className="commission-base-hint">
                    Uses <strong>transfer amount</strong> when filled; otherwise main amount.
                  </p>
                ) : null}
                {rule.rule_key === "money_transfer_aps" ? (
                  <p className="commission-base-hint">
                    Fee is calculated on the APS amount entered, <strong>deducted from collection</strong>,
                    and saved as shop profit (e.g. ₹1000 → ₹10 fee, ₹990 net collection).
                  </p>
                ) : null}
              </div>

              <footer className="commission-rule-foot">
                <button
                  className="admin-btn commission-save-btn"
                  type="button"
                  disabled={busyKey === rule.rule_key}
                  onClick={() => saveRule(rule.rule_key)}
                >
                  {busyKey === rule.rule_key ? "Saving…" : "Save rule"}
                </button>
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
