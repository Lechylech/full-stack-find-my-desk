export default function MyBookings({ bookings, desks, onCheckIn, onRelease, onCancel }) {
  const active = bookings.filter((b) => b.status === 'booked' || b.status === 'active');
  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h2>My bookings (today)</h2>
      {active.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>No bookings yet for this date.</div>
      )}
      {active.map((b) => {
        const desk = desks.find((d) => d.id === b.deskId);
        return (
          <div key={b.id} className="booking-item">
            <div className="b-head">
              <span><strong>{desk?.label || b.deskId}</strong> · {desk?.zone || ''}</span>
              <span className={`status-badge status-${b.status}`}>{b.status}</span>
            </div>
            <div className="b-meta">
              {b.startHour}:00–{b.endHour}:00 · Floor {desk?.floor === 'ground' ? 'G' : '1'}
            </div>
            <div className="b-actions">
              {b.status === 'booked' && (
                <button className="primary" onClick={() => onCheckIn(b.id)}>Check in</button>
              )}
              {b.status === 'active' && (
                <button onClick={() => onRelease(b.id)}>Release</button>
              )}
              {b.status === 'booked' && (
                <button className="danger" onClick={() => onCancel(b.id)}>Cancel</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
