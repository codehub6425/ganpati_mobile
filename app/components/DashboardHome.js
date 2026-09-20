"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ADMIN_TIME_ZONE, adminHourNow, formatPhone, telHref } from "@/lib/format";

function CountUp({ value }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const end = Number(value) || 0;
    if (end === 0) {
      setShown(0);
      return undefined;
    }

    const start = performance.now();
    const duration = 800;
    let frame;

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(end * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return shown;
}

function greeting() {
  const hour = adminHourNow();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: ADMIN_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function DashboardHome({ stats, recent, userName = "Shubham" }) {
  const firstName = String(userName || "Shubham").split(" ")[0];
  return (
    <div className="admin-dash">
      <section className="admin-hero" style={{ "--delay": "0s" }}>
        <div>
          <p className="admin-hero-kicker">{todayLabel()}</p>
          <h1>
            {greeting()}, {firstName} Ji
          </h1>
          <p>Call new leads first. Verified people are saved as customer users.</p>
        </div>
        <Link className="admin-btn admin-hero-btn" href="/admin/leads?status=new">
          Open new leads
        </Link>
      </section>

      <div className="admin-stats">
        {stats.map((stat, index) => (
          <article
            className={`admin-stat is-${stat.id}${stat.value > 0 && stat.id === "new" ? " has-pulse" : ""}`}
            key={stat.id}
            style={{ "--delay": `${0.08 + index * 0.06}s` }}
          >
            <div className="admin-stat-top">
              <span className="admin-stat-icon">{stat.icon}</span>
              <span>{stat.label}</span>
            </div>
            <strong>
              <CountUp value={stat.value} />
            </strong>
            <small>{stat.hint}</small>
          </article>
        ))}
      </div>

      <div className="admin-dash-grid">
        <section className="admin-card" style={{ "--delay": "0.32s" }}>
          <div className="admin-card-head">
            <h2>Needs a call</h2>
            <Link href="/admin/leads?status=new">See all</Link>
          </div>
          {recent.length === 0 ? (
            <p className="admin-empty">No new leads waiting. Spam and verified leads are filtered out.</p>
          ) : (
            <ul className="admin-recent">
              {recent.map((lead, index) => (
                <li key={lead.id} style={{ "--delay": `${0.38 + index * 0.07}s` }}>
                  <div className="admin-person">
                    <span className="admin-avatar">{lead.initial}</span>
                    <div>
                      <strong>{lead.name}</strong>
                      <span>
                        {formatPhone(lead.phone)} · {lead.brand} · {lead.problem}
                        {lead.distance_km != null ? ` · ${lead.distance_km} km away` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="admin-recent-side">
                    <time>{lead.created_label}</time>
                    {telHref(lead.phone) ? (
                      <a className="admin-call-icon" href={telHref(lead.phone)} aria-label={`Call ${lead.name}`}>
                        <PhoneIcon />
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card admin-quick-card" style={{ "--delay": "0.4s" }}>
          <div className="admin-card-head">
            <h2>Quick actions</h2>
          </div>
          <div className="admin-quick">
            <Link href="/admin/leads">
              <i>☰</i>
              All leads
            </Link>
            <Link href="/admin/leads?status=new">
              <i>☎</i>
              Call queue
            </Link>
            <Link href="/admin/customers">
              <i>◉</i>
              Customers
            </Link>
            <a href="/" target="_blank" rel="noreferrer">
              <i>↗</i>
              View form
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.7 3 3.1 3.4 2.7 4 2.7h3.4c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.1 2.2Z"
      />
    </svg>
  );
}
