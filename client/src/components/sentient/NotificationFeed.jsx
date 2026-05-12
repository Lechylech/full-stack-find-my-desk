export default function NotificationFeed({ events, clock }) {
  return (
    <div className="panel">
      <h2>Live notifications</h2>
      <p className="muted small">Contextual alerts from Cisco Spaces presence + ThousandEyes network. Simulated time: {clock}.</p>
      {events.length === 0 && <p className="muted small" style={{ marginTop: 8 }}>No live alerts at this time.</p>}
      <ul className="notification-list">
        {events.map((e) => (
          <li key={e.id} className={`notification-item ${e.severity}`}>
            <div className="notification-head">
              <strong>{e.title}</strong>
              <span className="notification-stamp">{e._step}</span>
            </div>
            <div className="notification-body">{e.body}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
