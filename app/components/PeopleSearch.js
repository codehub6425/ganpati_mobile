"use client";

export default function PeopleSearch({ action, query = "", placeholder = "Search name or mobile" }) {
  return (
    <section className="admin-filters admin-people-search">
      <form className="admin-filter-search" action={action} method="get">
        <div className="admin-search-row">
          <label className="admin-search-wrap">
            <SearchIcon />
            <input name="q" type="search" defaultValue={query} placeholder={placeholder} />
          </label>
          <button className="admin-btn" type="submit">
            Search
          </button>
        </div>
      </form>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5Zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z"
      />
    </svg>
  );
}
