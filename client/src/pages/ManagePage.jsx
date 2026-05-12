import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
    await api.release(id, me.id);
    await refresh();
  }

  return (
    <main className="main" style={{ gridTemplateColumns: '1fr' }}>
      {me.admin && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 4px' }}>
          <Link to="/manage/insights" className="btn-link">📊 Occupancy Insights</Link>
        </div>
      )}
      {me.admin && (
        <ReminderPanel me={me} />
      )}
      {me.admin && (
        <AdminConfigPanel me={me} />
      )}
      {me.admin && (
        <DelegationsAdminPanel me={me} />
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

function AdminConfigPanel({ me }) {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [savedKey, setSavedKey] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setConfig(await api.config.get(me.id));
    } catch (e) {
      setError(e.message);
    }
  }, [me.id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!config) return null;

  async function save(key, value) {
    setError(null);
    try {
      await api.config.set(key, me.id, value);
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="panel">
      <h2>Admin configuration</h2>
      {error && <div className="error">{error}</div>}

      <h3 style={{ fontSize: 14, marginTop: 12 }}>Auto-release policy</h3>
      <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
        Minutes after check-in window opens, before successive prompts and a final auto-release fire.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <NumberField
          label="First warn (min)"
          value={config.autoRelease.warn1Min}
          onChange={(v) => save('autoRelease', { ...config.autoRelease, warn1Min: v })}
        />
        <NumberField
          label="Second warn (min)"
          value={config.autoRelease.warn2Min}
          onChange={(v) => save('autoRelease', { ...config.autoRelease, warn2Min: v })}
        />
        <NumberField
          label="Auto-release after (min)"
          value={config.autoRelease.autoReleaseMin}
          onChange={(v) => save('autoRelease', { ...config.autoRelease, autoReleaseMin: v })}
        />
        {savedKey === 'autoRelease' && <span style={{ color: 'var(--success)', fontSize: 12 }}>Saved</span>}
      </div>

      <h3 style={{ fontSize: 14, marginTop: 16 }}>Hot-desk fallback threshold</h3>
      <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
        Show hot-desk zone summary when the regular suggestion count is below this.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <NumberField
          label="Min suggestions"
          value={config.hotDeskFallbackThreshold}
          onChange={(v) => save('hotDeskFallbackThreshold', v)}
        />
        {savedKey === 'hotDeskFallbackThreshold' && <span style={{ color: 'var(--success)', fontSize: 12 }}>Saved</span>}
      </div>

      <h3 style={{ fontSize: 14, marginTop: 16 }}>Presence signal sources</h3>
      <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
        Which signals the presence simulator consumes. Real-world sources documented in <code>docs/presence-signals.md</code>.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {Object.entries(config.presenceSignals).map(([k, v]) => (
          <label key={k} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={!!v}
              onChange={(e) => save('presenceSignals', { ...config.presenceSignals, [k]: e.target.checked })}
            />
            {k}
          </label>
        ))}
        {savedKey === 'presenceSignals' && <span style={{ color: 'var(--success)', fontSize: 12 }}>Saved</span>}
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <input
        type="number"
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onBlur={() => { if (local !== value) onChange(local); }}
        style={{ width: 80 }}
      />
    </label>
  );
}

function DelegationsAdminPanel({ me }) {
  const [overrides, setOverrides] = useState([]);
  const [users, setUsers] = useState([]);
  const [delegator, setDelegator] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [d, u] = await Promise.all([api.admin.listDelegations(me.id), api.listUsers()]);
      setOverrides(d);
      setUsers(u);
    } catch (e) {
      setError(e.message);
    }
  }, [me.id]);

  useEffect(() => { refresh(); }, [refresh]);

  async function add() {
    setError(null);
    if (!delegator || !target) { setError('Pick both users'); return; }
    try {
      await api.admin.addDelegation(me.id, delegator, target);
      setDelegator(''); setTarget('');
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove(o) {
    try {
      await api.admin.removeDelegation(me.id, o.delegatorId, o.onBehalfOfId);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="panel">
      <h2>Delegation overrides</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 10px' }}>
        Grant explicit "book on behalf of" rights beyond the default (self / line manager / admin) rules.
      </p>
      {error && <div className="error">{error}</div>}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={delegator} onChange={(e) => setDelegator(e.target.value)}>
          <option value="">— delegator (can book) —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
        <span style={{ color: 'var(--muted)' }}>can book for</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">— target —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
        <button className="primary" onClick={add}>Grant</button>
      </div>

      <table className="manage-table" style={{ marginTop: 12 }}>
        <thead>
          <tr><th>Delegator</th><th>On behalf of</th><th>Granted by</th><th>Granted at</th><th></th></tr>
        </thead>
        <tbody>
          {overrides.length === 0 && <tr><td colSpan="5" style={{ color: 'var(--muted)' }}>No explicit overrides yet.</td></tr>}
          {overrides.map((o) => (
            <tr key={`${o.delegatorId}::${o.onBehalfOfId}`}>
              <td>{o.delegatorName}</td>
              <td>{o.onBehalfOfName}</td>
              <td>{users.find((u) => u.id === o.grantedBy)?.fullName || o.grantedBy}</td>
              <td style={{ fontSize: 12 }}>{new Date(o.grantedAt).toLocaleString()}</td>
              <td><button onClick={() => remove(o)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
