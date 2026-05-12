export default function SuggestionsPanel({ suggestions, hotDeskFallback, onPick, onPickZone }) {
  const list = Array.isArray(suggestions) ? suggestions : [];
  const fallback = Array.isArray(hotDeskFallback) ? hotDeskFallback : [];
  return (
    <div className="panel">
      <h2>Team-nearby suggestions</h2>
      {list.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          No teammates booked yet for this date.
        </div>
      )}
      {list.map((s) => (
        <div key={s.id} className="suggestion" onClick={() => onPick(s)}>
          <div className="sg-id">
            {s.label} · {s.zone} ({s.floor === 'ground' ? 'G' : '1'})
            {s.hotDesk && <span className="hot-pill" title="Hot-desk"> · 🔥</span>}
          </div>
          <div className="sg-reason">{s.reason}</div>
        </div>
      ))}

      {fallback.length > 0 && (
        <>
          <h3 style={{ marginTop: 16, fontSize: 14 }}>Or try a hot-desk zone</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fallback.map((b) => (
              <button
                key={`${b.floor}::${b.zone}`}
                className="hot-zone-row"
                onClick={() => onPickZone && onPickZone(b)}
              >
                <span>
                  <strong>{b.zone}</strong>
                  <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                    Floor {b.floor === 'ground' ? 'G' : '1'}
                  </span>
                </span>
                <span className="hot-zone-count">{b.available}/{b.total} free</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
