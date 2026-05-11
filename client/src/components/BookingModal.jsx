import { useState } from 'react';

export default function BookingModal({ desk, date, onClose, onSubmit, error }) {
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);

  const attrs = desk.attributes || {};
  const valid = endHour - startHour >= 1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Book desk {desk.label}</h2>
        <div className="row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ color: 'var(--muted)' }}>
            {desk.zone} · Floor {desk.floor === 'ground' ? 'G' : '1'} · {desk.platform}
          </div>
          <div className="attrs" style={{ marginTop: 6 }}>
            <span className={`chip ${attrs.dualMonitor ? 'on' : ''}`}>Dual monitor</span>
            <span className={`chip ${attrs.nearWindow ? 'on' : ''}`}>Near window</span>
            <span className={`chip ${attrs.quietZone ? 'on' : ''}`}>Quiet zone</span>
            <span className={`chip ${attrs.heightAdjustable ? 'on' : ''}`}>Height adjustable / DSE</span>
          </div>
        </div>
        <div className="row">
          <label>Date</label>
          <div>{date}</div>
        </div>
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
            onClick={() => onSubmit({ deskId: desk.id, startHour, endHour })}
          >
            Confirm booking
          </button>
        </div>
      </div>
    </div>
  );
}

function hours(from, to) {
  const out = [];
  for (let h = from; h <= to; h++) out.push(h);
  return out;
}
