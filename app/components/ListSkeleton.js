function Sk({ className = "", style }) {
  return <span className={`inv-skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

function CardRows({ rows, withThumb = true }) {
  return (
    <ul className="inv-product-cards inv-mobile-only inv-skeleton-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="inv-skeleton-card">
          {withThumb ?
            <Sk className="inv-skeleton-thumb" />
          : null}
          <span className="inv-skeleton-stack">
            <Sk className="inv-skeleton-line w75" />
            <Sk className="inv-skeleton-line w50" />
            <Sk className="inv-skeleton-line w35" />
          </span>
          <Sk className="inv-skeleton-pill" />
        </li>
      ))}
    </ul>
  );
}

function TableRows({ rows, withThumb = false, desktopOnly = true }) {
  return (
    <div
      className={`inv-table-wrap inv-skeleton-table-wrap${desktopOnly ? " inv-desktop-only" : ""}`}
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="inv-skeleton-table" role="presentation">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="inv-skeleton-table-row">
            {withThumb ?
              <Sk className="inv-skeleton-thumb sm" />
            : null}
            <Sk className="inv-skeleton-line w70 flex1" />
            <Sk className="inv-skeleton-line w45 hide-narrow" />
            <Sk className="inv-skeleton-line w40 hide-narrow" />
            <Sk className="inv-skeleton-line w35 hide-narrow" />
            <Sk className="inv-skeleton-pill hide-narrow" />
            <Sk className="inv-skeleton-icon" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** @param {{ variant?: string, rows?: number, className?: string }} props */
export default function ListSkeleton({ variant = "product", rows = 6, className = "" }) {
  const wrap = className ? ` ${className}` : "";

  if (variant === "dashboard") {
    return (
      <div className={`inv-skeleton-dash${wrap}`} aria-busy="true" aria-label="Loading">
        <div className="inv-stat-grid inv-kpi-row--six inv-dash-kpi-primary">
          {Array.from({ length: 6 }, (_, i) => (
            <Sk key={i} className="inv-skeleton-stat-card" />
          ))}
        </div>
        <div className="inv-skeleton-module-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <Sk key={i} className="inv-skeleton-module-card" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "wa-log") {
    return (
      <div className={`inv-skeleton-table-only${wrap}`} aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="inv-skeleton-wa-row">
            <Sk className="inv-skeleton-line w25" />
            <Sk className="inv-skeleton-line w35" />
            <Sk className="inv-skeleton-line w20" />
            <Sk className="inv-skeleton-line w60" />
            <Sk className="inv-skeleton-line w40" />
            <Sk className="inv-skeleton-line w25" />
            <Sk className="inv-skeleton-line w15" />
            <Sk className="inv-skeleton-line w30" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "catalog") {
    return (
      <div className={wrap.trim() || undefined}>
        <CardRows rows={rows} withThumb />
        <TableRows rows={rows} withThumb />
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={wrap.trim() || undefined}>
        <TableRows rows={rows} withThumb={false} desktopOnly={false} />
      </div>
    );
  }

  if (variant === "rows") {
    return (
      <div className={`inv-skeleton-rows${wrap}`} aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="inv-skeleton-row-block">
            <Sk className="inv-skeleton-line w60" />
            <Sk className="inv-skeleton-line w40" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "ledger-summary") {
    return (
      <section className="ledger-summary-grid" aria-busy="true" aria-label="Loading totals">
        {Array.from({ length: 7 }, (_, i) => (
          <Sk key={i} className="inv-skeleton-ledger-card" />
        ))}
      </section>
    );
  }

  if (variant === "ledger-entries") {
    return (
      <div className={`inv-skeleton-ledger-entries${wrap}`} aria-busy="true" aria-label="Loading entries">
        <ul className="ledger-entry-cards">
          {Array.from({ length: Math.min(rows, 6) }, (_, i) => (
            <li key={i} className="inv-skeleton-ledger-entry-card">
              <div className="inv-skeleton-ledger-entry-top">
                <Sk className="inv-skeleton-pill" />
                <Sk className="inv-skeleton-line w25" />
              </div>
              <Sk className="inv-skeleton-line w85" />
              <Sk className="inv-skeleton-line w55" />
            </li>
          ))}
        </ul>
        <div className="ledger-table-wrap">
          <div className="inv-skeleton-table" role="presentation">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="inv-skeleton-table-row inv-skeleton-ledger-row">
                <Sk className="inv-skeleton-line w15" />
                <Sk className="inv-skeleton-line w20" />
                <Sk className="inv-skeleton-pill" />
                <Sk className="inv-skeleton-line w70 flex1" />
                <Sk className="inv-skeleton-line w25" />
                <Sk className="inv-skeleton-line w45 hide-narrow" />
                <Sk className="inv-skeleton-line w35 hide-narrow" />
                <Sk className="inv-skeleton-icon" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={wrap.trim() || undefined}>
      <CardRows rows={rows} withThumb />
      <TableRows rows={rows} withThumb />
    </div>
  );
}
