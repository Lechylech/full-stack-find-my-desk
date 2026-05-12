export default function GhostBookingPanel({ ghosts, onRelease, onReset, totalBookings }) {
  return (
    <div className="panel">
      <h2>Ghost bookings</h2>
      <p className="muted small">
        Booked desks with no presence sensed for 60+ minutes. Auto-release reclaims them.
        ({ghosts.length}/{totalBookings} flagged)
      </p>
      {ghosts.length === 0 && (
        <p className="muted small" style={{ marginTop: 8 }}>No ghost bookings at this time.</p>
      )}
      {ghosts.map((b) => (
        <div key={b.id} className="ghost-row">
          <div>
            <strong>{b.deskId}</strong>
            <div className="muted small">{b.user.fullName} · {b.user.team}</div>
            <div className="muted small">{b.startHour}:00–{b.endHour}:00</div>
          </div>
          <button className="primary" onClick={() => onRelease(b.id)}>Release</button>
        </div>
      ))}
      <button className="link-btn" onClick={onReset} style={{ marginTop: 8 }}>
        Reset all releases (demo)
      </button>
    </div>
  );
}
