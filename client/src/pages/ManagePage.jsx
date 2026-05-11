import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

function Stat({ label, value }) {
  return (
    <div className="summary-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
