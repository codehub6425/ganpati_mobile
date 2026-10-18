"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { showError, showSuccess } from "@/lib/swal";

export default function MessageTemplatesForm({ initialTemplates = [], initialPlaceholders = [] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [placeholders] = useState(initialPlaceholders);
  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    setTemplates(initialTemplates);
    const next = {};
    for (const t of initialTemplates) {
      next[t.template_key] = t.body || "";
    }
    setDrafts(next);
  }, [initialTemplates]);

  async function saveTemplate(templateKey) {
    const body = drafts[templateKey];
    setBusyKey(templateKey);
    try {
      const res = await fetch(apiUrl("/api/admin/message-templates"), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_key: templateKey, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not save template.");
        return;
      }
      setTemplates(data.templates || []);
      showSuccess("Template saved.");
    } catch {
      showError("Network error.");
    } finally {
      setBusyKey("");
    }
  }

  if (!templates.length) {
    return <p className="admin-muted">No message templates yet. Run database migration and refresh.</p>;
  }

  return (
    <div className="message-templates">
      <div className="admin-card message-templates-intro">
        <p>
          Edit WhatsApp message text. Use placeholders like <code>{`{{customer_name}}`}</code> — they are
          replaced when a bill is sent.
        </p>
        {placeholders.length ?
          <p className="admin-muted message-templates-placeholders">
            Available: {placeholders.map((p) => `{{${p}}}`).join(", ")}
          </p>
        : null}
      </div>

      {templates.map((t) => (
        <section className="admin-card message-template-card" key={t.template_key}>
          <header>
            <h2>{t.label}</h2>
            <p className="admin-muted">
              Key: <code>{t.template_key}</code>
            </p>
          </header>
          <label className="message-template-field">
            <span className="admin-muted">Message body</span>
            <textarea
              rows={12}
              value={drafts[t.template_key] ?? ""}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [t.template_key]: e.target.value }))
              }
              spellCheck={false}
            />
          </label>
          <footer>
            <button
              type="button"
              className="admin-btn"
              disabled={busyKey === t.template_key}
              onClick={() => saveTemplate(t.template_key)}
            >
              {busyKey === t.template_key ? "Saving…" : "Save template"}
            </button>
          </footer>
        </section>
      ))}
    </div>
  );
}
