"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import DateRangeFilter from "./DateRangeFilter";

const STATUSES = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "follow", label: "Follow-up" },
  { id: "verified", label: "Verified" },
  { id: "spam", label: "Spam" },
];

const DISTANCES = [
  { id: "", label: "Any distance" },
  { id: "1", label: "Within 1 km" },
  { id: "2", label: "Within 2 km" },
  { id: "5", label: "Within 5 km" },
  { id: "10", label: "Within 10 km" },
  { id: "far", label: "More than 10 km" },
  { id: "none", label: "No location" },
];

export default function LeadsFilters({ brands, problems, current, counts }) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [from, setFrom] = useState(current.from || "");
  const [to, setTo] = useState(current.to || "");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setFrom(current.from || "");
    setTo(current.to || "");
  }, [current.from, current.to]);

  function go(next) {
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });
    const query = params.toString();
    router.push(query ? `/admin/leads?${query}` : "/admin/leads");
  }

  function filtersFrom(extra = {}) {
    return {
      status: current.status,
      q: current.q,
      brand: current.brand,
      problem: current.problem,
      distance: current.distance,
      from,
      to,
      ...extra,
    };
  }

  function onSearch(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    go(
      filtersFrom({
        q: String(data.get("q") || "").trim(),
      })
    );
  }

  function onDesktopFilter(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    go(
      filtersFrom({
        q: String(data.get("q") || "").trim(),
        brand: String(data.get("brand") || ""),
        problem: String(data.get("problem") || ""),
        distance: String(data.get("distance") || ""),
        from,
        to,
      })
    );
  }

  function applySheet(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    go(
      filtersFrom({
        brand: String(data.get("brand") || ""),
        problem: String(data.get("problem") || ""),
        distance: String(data.get("distance") || ""),
        from,
        to,
      })
    );
    setSheetOpen(false);
  }

  function resetAll() {
    setFrom("");
    setTo("");
    setSheetOpen(false);
    router.push("/admin/leads");
  }

  const extraCount = [current.brand, current.problem, current.distance, current.from, current.to].filter(Boolean)
    .length;
  const hasFilters = Boolean(
    extraCount || current.q || (current.status && current.status !== "all")
  );

  const sheet =
    mounted && sheetOpen
      ? createPortal(
          <>
            <button className="admin-sheet-backdrop" type="button" onClick={() => setSheetOpen(false)} />
            <form className="admin-sheet" onSubmit={applySheet}>
              <div className="admin-sheet-handle" />
              <div className="admin-sheet-head">
                <h3>Advance filter</h3>
                <button className="admin-sheet-reset" type="button" onClick={resetAll}>
                  <ResetIcon />
                  Reset
                </button>
              </div>
              <div className="admin-sheet-body">
                <FilterFields brands={brands} problems={problems} current={current} />
                <label className="admin-sheet-label">Date range</label>
                <DateRangeFilter
                  from={from}
                  to={to}
                  onChange={({ from: nextFrom, to: nextTo }) => {
                    setFrom(nextFrom || "");
                    setTo(nextTo || "");
                  }}
                />
                <p className="admin-sheet-hint">Tap Apply filters to update the list.</p>
              </div>
              <div className="admin-sheet-foot">
                <button className="admin-btn admin-sheet-apply" type="submit">
                  <FilterIcon />
                  Apply filters
                </button>
              </div>
            </form>
          </>,
          document.body
        )
      : null;

  return (
    <section className="admin-filters">
      <div className="admin-filter-tabs">
        {STATUSES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`admin-filter-tab${current.status === item.id ? " is-active" : ""}`}
            onClick={() => go(filtersFrom({ status: item.id }))}
          >
            {item.label}
            <em>{counts[item.id] || 0}</em>
          </button>
        ))}
      </div>

      <form className="admin-filter-search" onSubmit={onSearch}>
        <div className="admin-search-row">
          <label className="admin-search-wrap">
            <SearchIcon />
            <input
              name="q"
              type="search"
              defaultValue={current.q}
              placeholder="Search name or mobile"
              aria-label="Search name or mobile"
            />
          </label>
          <button className="admin-btn admin-search-btn" type="submit">
            <SearchIcon />
            Search
          </button>
        </div>
        <div className="admin-filter-tools">
          <button
            className={`admin-filter-toggle${extraCount ? " is-active" : ""}`}
            type="button"
            onClick={() => setSheetOpen(true)}
          >
            <FilterIcon />
            Advance filter
            {extraCount ? <em>{extraCount}</em> : null}
          </button>
          <button className="admin-filter-reset" type="button" onClick={resetAll} disabled={!hasFilters}>
            <ResetIcon />
            Reset
          </button>
        </div>
      </form>

      <form className="admin-filter-form" onSubmit={onDesktopFilter}>
        <label className="admin-search-wrap">
          <SearchIcon />
          <input
            name="q"
            type="search"
            defaultValue={current.q}
            placeholder="Search name or mobile"
            aria-label="Search name or mobile"
          />
        </label>
        <FilterFields brands={brands} problems={problems} current={current} />
        <DateRangeFilter
          from={from}
          to={to}
          onChange={({ from: nextFrom, to: nextTo }) => {
            setFrom(nextFrom || "");
            setTo(nextTo || "");
          }}
        />
        <button className="admin-btn" type="submit">
          <SearchIcon />
          Search
        </button>
        <button className="admin-filter-reset" type="button" onClick={resetAll} disabled={!hasFilters}>
          <ResetIcon />
          Reset
        </button>
      </form>

      {sheet}
    </section>
  );
}

function FilterFields({ brands, problems, current }) {
  return (
    <>
      <select name="brand" defaultValue={current.brand} aria-label="Brand">
        <option value="">All brands</option>
        {brands.map((brand) => (
          <option key={brand} value={brand}>
            {brand}
          </option>
        ))}
      </select>
      <select name="problem" defaultValue={current.problem} aria-label="Problem">
        <option value="">All problems</option>
        {problems.map((problem) => (
          <option key={problem} value={problem}>
            {problem}
          </option>
        ))}
      </select>
      <select name="distance" defaultValue={current.distance} aria-label="Distance">
        {DISTANCES.map((item) => (
          <option key={item.id || "any"} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.2 4.2-1.4 1.4-4.2-4.2A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M3 5h18v2l-7 8v5l-4-2v-3L3 7V5Z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z"
      />
    </svg>
  );
}
