import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function MeetingRoomsPanel({ me, date }) {
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = () => {
    api.listRooms(date)
      .then(setRooms)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function book(roomId) {
    setBusyId(roomId);
    setError(null);
    try {
      await api.bookRoom(roomId, { userId: me.id, date, startHour: 9, endHour: 10 });
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="panel">
      <h2>Or grab a meeting room</h2>
      <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 6 }}>
        Quick 9:00–10:00 hold. Adjust later in your calendar.
      </div>
      {error && <div className="error">{error}</div>}
      {rooms.length === 0 && <div style={{ color: 'var(--muted)' }}>Loading rooms…</div>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rooms.map((r) => {
          const ninetoten = (r.bookings || []).find((b) => b.startHour <= 9 && b.endHour > 9);
          return (
            <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <span>
                <strong>{r.label}</strong>
                <span style={{ color: 'var(--muted)', marginLeft: 6, fontSize: 12 }}>
                  · cap {r.capacity}
                  {r.av?.length > 0 && ` · ${r.av.join(', ')}`}
                </span>
              </span>
              {ninetoten
                ? <span style={{ color: 'var(--muted)', fontSize: 12 }}>9–10 taken</span>
                : <button disabled={busyId === r.id} onClick={() => book(r.id)}>{busyId === r.id ? '…' : 'Hold 9–10'}</button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
