"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { parseBookDate } from "@/lib/ledger";
import { formatAdminDateFromIso, formatAdminDateTimeMedium } from "@/lib/format";
import { todayDateString } from "@/lib/ledger";
import DateRangeFilter from "./DateRangeFilter";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n) || 0);
}

function categoryBadge(category) {
  if (category === "repair") return "Repair";
  return "Acc.";
}

export default function WhatsappBillLogApp({ initialFrom, initialTo }) {
  const searchParams = useSearchParams();
  const today = todayDateString();
  const fromQuery = parseBookDate(searchParams.get("from"));
  const toQuery = parseBookDate(searchParams.get("to"));
  const [dateFrom, setDateFrom] = useState(fromQuery || initialFrom || today);
  const [dateTo, setDateTo] = useState(toQuery || initialTo || fromQuery || today);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ from: dateFrom, to: dateTo, limit: "500" });
      const res = await fetch(apiUrl(`/api/admin/whatsapp/bill-log?${qs}`), {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Could not load log.");
        setEvents([]);
        return;
      }
      setEvents(data.events || []);
    } catch {
      setError("Network error.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="wa-bill-log-page">
      <header className="wa-bill-log-head">
        <div>
          <p className="wa-bill-log-kicker">
            <Link href="/admin/accounting" className="ledger-inline-link">
              ← Daily Accounts
            </Link>
          </p>
          <h1>WhatsApp bill log</h1>
          <p className="admin-muted">
            Every accessory and repair bill sent on WhatsApp — date, time, customer, and send count per
            entry.
          </p>
        </div>
      </header>

      <section className="admin-card wa-bill-log-filters">
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
          }}
        />
        <p className="admin-muted wa-bill-log-summary">
          {loading ?
            "Loading…"
          : `${events.length} send${events.length === 1 ? "" : "s"} in this range`}
        </p>
      </section>

      {error ?
        <p className="wa-bill-log-error" role="alert">
          {error}
        </p>
      : null}

      <section className="admin-card wa-bill-log-table-wrap">
        {loading ?
          <p className="admin-muted">Loading send log…</p>
        : events.length === 0 ?
          <p className="admin-muted">No WhatsApp bills sent in this date range.</p>
        : <div className="admin-table-scroll">
            <table className="admin-table wa-bill-log-table">
              <thead>
                <tr>
                  <th>Book date</th>
                  <th>Sent at</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Send</th>
                  <th>Sent by</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      {ev.book_date ?
                        formatAdminDateFromIso(ev.book_date, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                    </td>
                    <td>{formatAdminDateTimeMedium(ev.sent_at)}</td>
                    <td>
                      <span
                        className={`ledger-type-badge is-${ev.category === "repair" ? "repair" : "accessory"}`}
                      >
                        {categoryBadge(ev.category)}
                      </span>
                    </td>
                    <td>{ev.item}</td>
                    <td>
                      {ev.customer_name || "—"}
                      {ev.customer_phone ?
                        <small className="wa-bill-log-phone"> · {ev.customer_phone}</small>
                      : null}
                    </td>
                    <td>₹{formatMoney(ev.amount)}</td>
                    <td>
                      {ev.send_number}/{ev.send_total}
                    </td>
                    <td>{ev.sent_by_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  );
}
