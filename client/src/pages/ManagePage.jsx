import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function twoWeeksIso() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default function ManagePage({ me }) {
  const [date, setDate] = useState(todayIso());
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [desks, setDesks] = useState([]);

  const refresh = useCallback(async () => {
    const [b, u, d] = await Promise.all([
      api.listBookings({ date }),
      api.listUsers(),
      api.listDesks(date, me.id),
    ]);
    setBookings(b);
    setUsers(u);
    setDesks(d);
  }, [date, me.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const active = bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'released');
  const byFloor = {
    ground: desks.filter((d) => d.floor === 'ground'),
    first: desks.filter((d) => d.floor === 'first'),
  };
  const occupied = {
    ground: byFloor.ground.filter((d) => d.state !== 'available').length,
    first: byFloor.first.filter((d) => d.state !== 'available').length,
  };

  async function forceRelease(id) {
    await api.release(id);
    await refresh();
  }

  return (
    <main className="main" style={{ gridTemplateColumns: '1fr' }}>
      {me.admin && (
        <ReminderPanel me={me} />
      )}

      <section className="panel">
        <div className="floor-controls">
          <label>
            Date{' '}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {!me.admin && (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              (You're not an admin — this view is read-only in production.)
            </div>
          )}
        </div>

        <div className="summary-grid">
          <Stat label="Bookings" value={active.length} />
          <Stat label="Active check-ins" value={active.filter((b) => b.status === 'active').length} />
          <Stat label="Ground occupancy" value={`${occupied.ground}/${byFloor.ground.length}`} />
          <Stat label="First occupancy" value={`${occupied.first}/${byFloor.first.length}`} />
        </div>

        <h2>All bookings ({date})</h2>
        <table className="manage-table">
          <thead>
            <tr>
              <th>Desk</th>
              <th>User</th>
              <th>Team</th>
              <th>Time</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr><td colSpan="6" style={{ color: 'var(--muted)' }}>No bookings for this date.</td></tr>
            )}
            {bookings.map((b) => {
              const u = users.find((x) => x.id === b.userId);
              const d = desks.find((x) => x.id === b.deskId);
              return (
                <tr key={b.id}>
                  <td>{d?.label || b.deskId} <span style={{ color: 'var(--muted)' }}>({d?.zone || ''})</span></td>
                  <td>{u?.fullName || '—'}</td>
                  <td>{u?.team || '—'}</td>
                  <td>{b.startHour}:00–{b.endHour}:00</td>
                  <td><span className={`status-badge status-${b.status}`}>{b.status}</span></td>
                  <td>
                    {(b.status === 'booked' || b.status === 'active') && (
                      <button onClick={() => forceRelease(b.id)}>Force release</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function ReminderPanel({ me }) {
  const [reminderDate, setReminderDate] = useState(twoWeeksIso());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function send() {
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const r = await api.sendReminder(me.id, reminderDate);
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="panel reminder-panel-section">
      <h2>Booking Reminders</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 14px' }}>
        Send a message to the Teams channel asking staff to book a desk for a chosen date.
        Defaults to 2 weeks from today.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Reminder date
          <input
            type="date"
            value={reminderDate}
            min={todayIso()}
            onChange={(e) => { setReminderDate(e.target.value); setResult(null); setError(null); }}
          />
        </label>
        <button className="primary" onClick={send} disabled={sending}>
          {sending ? 'Sending…' : 'Send reminder to Teams'}
        </button>
      </div>

      {error && (
        <div className="reminder-error">
          {error}
        </div>
      )}

      {result && <TeamsCardPreview result={result} />}
    </section>
  );
}

function TeamsCardPreview({ result }) {
  const formatted = new Date(`${result.date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="teams-preview-wrap">
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
        Reminder sent — Teams channel preview:
      </div>
      <div className="teams-card">
        <div className="teams-card-header">
          <div className="teams-card-logo">S</div>
          <div>
            <div className="teams-card-app">Spacio</div>
            <div className="teams-card-subtitle">Desk Booking Reminder</div>
          </div>
        </div>
        <div className="teams-card-title">
          Book your desk for {formatted}
        </div>
        <div className="teams-card-body">
          {result.reminder_sent_to} of your colleagues haven't booked a desk yet.
          Secure your spot now — spaces are limited.
        </div>
        <div className="teams-card-stats">
          <div className="teams-stat">
            <span className="teams-stat-value">{result.total_users}</span>
            <span className="teams-stat-label">Total staff</span>
          </div>
          <div className="teams-stat">
            <span className="teams-stat-value" style={{ color: 'var(--available)' }}>{result.already_booked}</span>
            <span className="teams-stat-label">Already booked</span>
          </div>
          <div className="teams-stat">
            <span className="teams-stat-value" style={{ color: 'var(--warning)' }}>{result.reminder_sent_to}</span>
            <span className="teams-stat-label">Yet to book</span>
          </div>
        </div>
        <a
          className="teams-card-cta"
          href={`${result.booking_url}?date=${result.date}`}
          target="_blank"
          rel="noreferrer"
        >
          Book your desk →
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="summary-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
