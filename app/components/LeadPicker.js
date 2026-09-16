"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";

export default function LeadPicker({ value, onChange, disabled = false }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(apiUrl(`/api/admin/leads?q=${encodeURIComponent(String(value))}`));
      const data = await res.json();
      if (cancelled || !data.ok) return;
      const match = data.leads.find((l) => l.id === value);
      if (match) setSelected(match);
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(apiUrl(`/api/admin/leads?q=${encodeURIComponent(query.trim())}`));
        const data = await res.json();
        setResults(data.ok ? data.leads : []);
        setOpen(true);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(lead) {
    setSelected(lead);
    onChange(lead.id, lead);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    onChange(null, null);
  }

  return (
    <div className="ledger-lead-picker">
      <span className="ledger-field-label">Link lead (optional)</span>
      {selected ? (
        <div className="ledger-lead-selected">
          <div>
            <strong>{selected.name}</strong>
            <small>
              {selected.phone} · {selected.brand}
            </small>
          </div>
          {!disabled ? (
            <button type="button" className="ledger-link-btn" onClick={clear}>
              Clear
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <input
            type="search"
            placeholder="Search name or mobile"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled}
          />
          {busy ? <p className="ledger-hint">Searching...</p> : null}
          {open && results.length > 0 ? (
            <ul className="ledger-lead-list">
              {results.map((lead) => (
                <li key={lead.id}>
                  <button type="button" onClick={() => pick(lead)}>
                    <strong>{lead.name}</strong>
                    <span>
                      {lead.phone} · {lead.brand}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
