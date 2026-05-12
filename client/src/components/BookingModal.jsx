import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function BookingModal({ desk, date, onClose, onSubmit, error, me }) {
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [delegations, setDelegations] = useState([]);
  const [onBehalfOfId, setOnBehalfOfId] = useState(me?.id || null);

  const attrs = desk.attributes || {};
  const valid = endHour - startHour >= 1;

  useEffect(() => {
    if (!me?.id) return;
    api.listDelegations(me.id).then(setDelegations).catch(() => setDelegations([]));
    setOnBehalfOfId(me.id);
  }, [me?.id]);

  const showDelegation = delegations.length > 1;
  const targetIsSelf = !onBehalfOfId || onBehalfOfId === me?.id;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Book desk {desk.label}</h2>
        <div className="row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ color: 'var(--muted)' }}>
            {desk.zone} · Floor {desk.floor === 'ground' ? 'G' : '1'} · {desk.platform}
            {desk.hotDesk && <span style={{ marginLeft: 6 }}>· 🔥 Hot-desk</span>}
          </div>
          <div className="attrs" style={{ marginTop: 6 }}>
            <span className={`chip ${attrs.dualMonitor ? 'on' : ''}`}>Dual monitor</span>
            <span className={`chip ${attrs.nearWindow ? 'on' : ''}`}>Near window</span>
            <span className={`chip ${attrs.quietZone ? 'on' : ''}`}>Quiet zone</span>
            <span className={`chip ${attrs.heightAdjustable ? 'on' : ''}`}>Height adjustable / DSE</span>
            {attrs.wheelchairAccess && <span className="chip on">♿ Wheelchair</span>}
          </div>
        </div>
        <div className="row">
          <label>Date</label>
          <div>{date}</div>
        </div>
        {showDelegation && (
          <div className="row">
            <label>Booking for</label>
            <select value={onBehalfOfId || ''} onChange={(e) => setOnBehalfOfId(e.target.value)}>
              {delegations.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id === me.id ? 'Myself' : t.fullName}{t.id !== me.id ? ` — ${reasonLabel(t.reason)}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="row">
          <label>From</label>
          <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
            {hours(7, 20).map((h) => <option key={h} value={h}>{h}:00</option>)}
          </select>
          <label style={{ width: 30 }}>To</label>
          <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}>
            {hours(8, 22).map((h) => <option key={h} value={h}>{h}:00</option>)}
          </select>
        </div>
        {!valid && <div className="error">Minimum booking is 1 hour.</div>}
        {error && <div className="error">{error}</div>}
        <div className="actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            disabled={!valid}
            onClick={() => onSubmit({
              deskId: desk.id,
              startHour, endHour,
              userId: targetIsSelf ? undefined : onBehalfOfId,
            })}
          >
            {targetIsSelf ? 'Confirm booking' : 'Confirm (on behalf)'}
          </button>
        </div>
      </div>
    </div>
  );
}

function reasonLabel(reason) {
  switch (reason) {
    case 'direct-report': return 'direct report';
    case 'admin': return 'admin';
    case 'override': return 'granted';
    default: return reason;
  }
}

function hours(from, to) {
  const out = [];
  for (let h = from; h <= to; h++) out.push(h);
  return out;
}
