import { useEffect, useState } from 'react';
import { api } from '../api.js';

const PREF_OPTIONS = [
  { key: 'dual-monitor',  label: 'Dual monitor',           help: 'Boost suggestion score for desks with dual-monitor setup.' },
  { key: 'near-window',   label: 'Near a window',          help: 'Prefer window-bank desks.' },
  { key: 'quiet-area',    label: 'Quiet zone',             help: 'Prefer quiet-zone desks.' },
  { key: 'standing-desk', label: 'Height adjustable / DSE', help: 'Prefer height-adjustable or DSE desks.' },
];

const ACCESSIBILITY_OPTIONS = [
  { key: 'wheelchair',      label: 'Wheelchair access',     help: 'Strongly prefer wheelchair-accessible desks; ramps and clear approach.' },
  { key: 'ergonomic-chair', label: 'Ergonomic chair',       help: 'Desk reservation includes an ergonomic / DSE-assessed chair.' },
  { key: 'large-display',   label: 'Large display',         help: 'Larger or higher-DPI monitor for low-vision needs.' },
  { key: 'low-light',       label: 'Low-light area',        help: 'Lower-lit zones away from harsh overhead lighting.' },
  { key: 'sit-stand',       label: 'Sit-stand desk',        help: 'Height-adjustable required (not just preferred).' },
  { key: 'hearing-loop',    label: 'Hearing loop',          help: 'Hearing-loop coverage required.' },
];

function asArray(needs) {
  if (Array.isArray(needs)) return needs;
  if (typeof needs === 'string' && needs) return [needs];
  return [];
}

export default function ProfilePage({ me, onSaved }) {
  const [selected, setSelected] = useState(me.deskPreferences || []);
  const [needs, setNeeds] = useState(asArray(me.accessibilityNeeds));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSelected(me.deskPreferences || []);
    setNeeds(asArray(me.accessibilityNeeds));
  }, [me.id, me.deskPreferences, me.accessibilityNeeds]);

  function togglePref(key) {
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }
  function toggleNeed(key) {
    setNeeds((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.setPreferences(me.id, { deskPreferences: selected, accessibilityNeeds: needs });
      setSavedAt(new Date());
      if (onSaved) await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const sortedSel = JSON.stringify([...selected].sort());
  const sortedNeeds = JSON.stringify([...needs].sort());
  const baseSel = JSON.stringify([...(me.deskPreferences || [])].sort());
  const baseNeeds = JSON.stringify([...asArray(me.accessibilityNeeds)].sort());
  const dirty = sortedSel !== baseSel || sortedNeeds !== baseNeeds;

  return (
    <main className="main" style={{ gridTemplateColumns: '1fr' }}>
      <section className="panel" style={{ maxWidth: 720 }}>
        <h2>Your profile</h2>
        <div className="summary-grid">
          <Stat label="Name"     value={me.fullName} />
          <Stat label="Team"     value={me.team} />
          <Stat label="Lab"      value={me.lab || '—'} />
          <Stat label="Platform" value={me.platform || '—'} />
          <Stat label="Role"     value={me.role || '—'} />
          <Stat label="Location" value={me.location || '—'} />
        </div>

        <h3>Desk booking preferences</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: 13 }}>
          Suggestions will favour desks that match these.
        </p>
        {PREF_OPTIONS.map((opt) => (
          <label key={opt.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <input
              type="checkbox"
              checked={selected.includes(opt.key)}
              onChange={() => togglePref(opt.key)}
              style={{ marginTop: 3 }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>{opt.label}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{opt.help}</div>
            </div>
          </label>
        ))}

        <h3 style={{ marginTop: 24 }}>Accessibility needs</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: 13 }}>
          Accessibility needs strongly bias suggestions and are surfaced on the desk tooltip.
        </p>
        {ACCESSIBILITY_OPTIONS.map((opt) => (
          <label key={opt.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <input
              type="checkbox"
              checked={needs.includes(opt.key)}
              onChange={() => toggleNeed(opt.key)}
              style={{ marginTop: 3 }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>{opt.label}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{opt.help}</div>
            </div>
          </label>
        ))}

        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="primary" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save preferences'}
          </button>
          {savedAt && !dirty && (
            <span style={{ color: 'var(--success)', fontSize: 13 }}>
              Saved at {savedAt.toLocaleTimeString()}
            </span>
          )}
          {error && <span className="error">{error}</span>}
        </div>

        <p style={{ marginTop: 24, color: 'var(--muted)', fontSize: 12 }}>
          Preferences are kept in server memory for this MVP and reset when the server restarts.
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="summary-card">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: 16, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
