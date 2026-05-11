export default function SuggestionsPanel({ suggestions, onPick }) {
  return (
    <div className="panel">
      <h2>Team-nearby suggestions</h2>
      {suggestions.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          No teammates booked yet for this date.
        </div>
      )}
      {suggestions.map((s) => (
        <div key={s.id} className="suggestion" onClick={() => onPick(s)}>
          <div className="sg-id">{s.label} · {s.zone} ({s.floor === 'ground' ? 'G' : '1'})</div>
          <div className="sg-reason">{s.reason}</div>
        </div>
      ))}
    </div>
  );
}
