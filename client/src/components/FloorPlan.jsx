import { useState } from 'react';

const FLOOR_IMAGES = {
  ground: '/ground.png',
  first: '/first.png',
};

export default function FloorPlan({ floor, desks, onPick, selectedId }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="floor-wrap">
      <img className="floor-img" src={FLOOR_IMAGES[floor]} alt={`${floor} floor plan`} draggable={false} />
      {desks.map((d) => (
        <button
          key={d.id}
          className={`desk-marker ${d.state}${selectedId === d.id ? ' selected' : ''}`}
          style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
          onClick={() => onPick(d)}
          onMouseEnter={() => setHovered(d)}
          onMouseLeave={() => setHovered((h) => (h?.id === d.id ? null : h))}
          title={`${d.label} — ${d.state}`}
          aria-label={`Desk ${d.label}, ${d.state}`}
        />
      ))}
      {hovered && (
        <DeskTooltip desk={hovered} />
      )}
    </div>
  );
}

function DeskTooltip({ desk }) {
  const x = `${Math.min(desk.x * 100, 80)}%`;
  const y = `${desk.y * 100 + 2}%`;
  const attrs = desk.attributes || {};
  return (
    <div className="desk-tooltip" style={{ left: x, top: y }}>
      <strong>{desk.label} · {desk.zone}</strong>
      <div className="tip-attr">
        {attrs.dualMonitor && <span>Dual monitor · </span>}
        {attrs.nearWindow && <span>Window · </span>}
        {attrs.quietZone && <span>Quiet · </span>}
        {attrs.heightAdjustable && <span>Height-adj · </span>}
      </div>
      <div style={{ marginTop: 4 }}>
        State: <strong>{desk.state}</strong>
      </div>
      {desk.occupant && (
        <div className="tip-attr" style={{ marginTop: 4 }}>
          {desk.occupant.fullName} · {desk.occupant.startHour}:00–{desk.occupant.endHour}:00
        </div>
      )}
    </div>
  );
}
