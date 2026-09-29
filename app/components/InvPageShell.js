export default function InvPageShell({ title, subtitle, action = null, children }) {
  return (
    <div className="inventory-app inv-page-shell">
      <header className="inv-hub-header">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
