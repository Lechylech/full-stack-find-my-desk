import { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function BulkBookPanel({ me }) {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [date, setDate] = useState(todayIso());
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listDelegations(me.id).then((list) => {
      // Only the people the viewer line-manages — admin reach is handled via single-booking modal.
      const directs = list.filter((t) => t.reason === 'direct-report');
      setReports(directs);
    }).catch(() => setReports([]));
  }, [me.id]);

  const allSelected = reports.length > 0 && reports.every((r) => selected.has(r.id));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(reports.map((r) => r.id)));
  }

  async function book() {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await api.bulkBook({
        actorId: me.id,
        userIds: [...selected],
        date, startHour, endHour,
      });
      setResult(r);
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (reports.length === 0) return null;

  return (
    <section className="panel">
      <h2>Book for my team</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px' }}>
        Select direct reports, pick a date and time, and one click books a matching desk for each.
        Choices honour each person's preferences and accessibility needs.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <label>Date <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} /></label>
        <label>From <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
          {hours(7, 20).map((h) => <option key={h} value={h}>{h}:00</option>)}
        </select></label>
        <label>To <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}>
          {hours(8, 22).map((h) => <option key={h} value={h}>{h}:00</option>)}
        </select></label>
        <span style={{ flex: 1 }} />
        <button onClick={toggleAll}>{allSelected ? 'Deselect all' : 'Select all'}</button>
        <button className="primary" disabled={busy || selected.size === 0 || endHour - startHour < 1} onClick={book}>
          {busy ? 'Booking…' : `Book ${selected.size} desk${selected.size === 1 ? '' : 's'}`}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="bulk-report-list">
        {reports.map((r) => (
          <label key={r.id} className={`bulk-report-row${selected.has(r.id) ? ' selected' : ''}`}>
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 500 }}>{r.fullName}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.team} · {r.role}</span>
            </div>
          </label>
        ))}
      </div>

      {result && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {result.succeeded} of {result.requested} succeeded
          </div>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
            {result.results.map((r) => (
              <li key={r.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: 4,
                  background: r.status === 'success' ? 'var(--success)' : 'var(--danger)',
                }} />
                <span>{r.fullName || r.userId}</span>
                {r.status === 'success'
                  ? <span style={{ color: 'var(--muted)' }}>→ {r.deskLabel} ({r.zone}, floor {r.floor === 'ground' ? 'G' : '1'})</span>
                  : <span style={{ color: 'var(--danger)' }}>· {r.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function hours(from, to) {
  const out = [];
  for (let h = from; h <= to; h++) out.push(h);
  return out;
}
