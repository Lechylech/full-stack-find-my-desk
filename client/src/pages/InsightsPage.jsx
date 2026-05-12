import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

function defaultFrom() {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function defaultTo() {
  const d = new Date(); d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default function InsightsPage({ me }) {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.admin.insights(me.id, from, to);
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [me.id, from, to]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!me.admin) {
    return (
      <main className="main"><div className="panel" style={{ maxWidth: 520 }}>
        <h2>Admins only</h2>
        <p style={{ color: 'var(--muted)' }}>Sign in as an admin to view occupancy insights.</p>
      </div></main>
    );
  }

  const csvUrl = api.admin.insightsCsvUrl(me.id, from, to);

  return (
    <main className="main" style={{ gridTemplateColumns: '1fr' }}>
      <section className="panel">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/manage" style={{ fontSize: 13 }}>← Back to Manage</Link>
          <h2 style={{ margin: 0 }}>Occupancy Insights</h2>
          <span style={{ flex: 1 }} />
          <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button onClick={refresh}>Refresh</button>
          <a className="btn" href={csvUrl} download style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6 }}>
            Export CSV
          </a>
        </div>

        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {loading && !data && <div style={{ marginTop: 12, color: 'var(--muted)' }}>Loading…</div>}

        {data && (
          <>
            <div className="summary-grid" style={{ marginTop: 16 }}>
              <Stat label="Total bookings"      value={data.totals.totalBookings} />
              <Stat label="Ever checked-in"     value={data.totals.everCheckedIn} />
              <Stat label="Cancelled"           value={data.totals.cancelled} />
              <Stat label="Released (auto)"     value={data.totals.released} />
              <Stat label="Ghost ratio"         value={`${data.totals.ghostRatioPct}%`} hi={data.totals.ghostRatioPct > 15} />
              <Stat label="Hot-desk pickup"     value={`${data.hotDesk.pickupRatePct}%`} />
              <Stat label="Avg dwell (min)"     value={data.avgDwellMinutes} />
            </div>

            <h3 style={{ marginTop: 24 }}>Occupancy by zone</h3>
            <ZoneTable rows={data.occupancyByZone} />

            <h3 style={{ marginTop: 24 }}>Peak hours</h3>
            <HourBars rows={data.peakHours} />
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, hi }) {
  return (
    <div className="summary-card">
      <div className="label">{label}</div>
      <div className="value" style={hi ? { color: 'var(--danger)' } : undefined}>{value}</div>
    </div>
  );
}

function ZoneTable({ rows }) {
  const max = rows.reduce((m, r) => Math.max(m, r.bookings), 0) || 1;
  return (
    <table className="manage-table">
      <thead><tr><th>Floor</th><th>Zone</th><th>Bookings</th><th></th></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan="4" style={{ color: 'var(--muted)' }}>No bookings in range.</td></tr>}
        {rows.map((r) => (
          <tr key={`${r.floor}-${r.zone}`}>
            <td>{r.floor === 'ground' ? 'Ground' : 'First'}</td>
            <td>{r.zone}</td>
            <td>{r.bookings}</td>
            <td style={{ width: '40%' }}>
              <div className="bar-wrap"><div className="bar" style={{ width: `${(r.bookings / max) * 100}%` }} /></div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HourBars({ rows }) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <div className="hour-bars">
      {rows.map((r) => (
        <div key={r.hour} className="hour-bar">
          <div className="hour-bar-fill" style={{ height: `${(r.count / max) * 100}%` }} />
          <div className="hour-bar-label">{String(r.hour).padStart(2, '0')}</div>
        </div>
      ))}
      {rows.length === 0 && <div style={{ color: 'var(--muted)' }}>No bookings in range.</div>}
    </div>
  );
}
