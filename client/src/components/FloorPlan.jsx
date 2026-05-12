import { useState, useRef } from 'react';

const FLOOR_IMAGES = {
  ground: '/ground.png',
  first: '/first.png',
};

export default function FloorPlan({
  floor, desks, onPick, selectedId, editMode, positionOverrides, onDeskMoved,
  viewer, highlightTeam = false,
}) {
  const [hovered, setHovered] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const wrapRef = useRef(null);

  function getPosFromEvent(e) {
    const rect = wrapRef.current.getBoundingClientRect();
    return {
      x: Math.round(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * 1000) / 1000,
      y: Math.round(Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) * 1000) / 1000,
    };
  }

  function handleMarkerMouseDown(e, desk) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(desk.id);
    setHovered(null);
  }

  function handleMouseMove(e) {
    if (!draggingId) return;
    onDeskMoved(draggingId, getPosFromEvent(e));
  }

  function handleMouseUp() {
    setDraggingId(null);
  }

  function getDeskXY(d) {
    const override = positionOverrides?.[d.id];
    return override || { x: d.x, y: d.y };
  }

  function isTeamMate(desk) {
    if (!highlightTeam || !viewer || !desk.occupant) return false;
    const occ = desk.occupant;
    if (!occ.team && !occ.lab && !occ.platform) return false;
    if (occ.userId === viewer.id) return false;
    return (
      (viewer.team && occ.team === viewer.team) ||
      (viewer.lab && occ.lab === viewer.lab) ||
      (viewer.platform && occ.platform === viewer.platform)
    );
  }

  return (
    <div
      className={`floor-wrap${editMode ? ' edit-mode' : ''}`}
      ref={wrapRef}
      onMouseMove={editMode ? handleMouseMove : undefined}
      onMouseUp={editMode ? handleMouseUp : undefined}
      onMouseLeave={editMode ? handleMouseUp : undefined}
    >
      <img
        className="floor-img"
        src={FLOOR_IMAGES[floor]}
        alt={`${floor} floor plan`}
        draggable={false}
      />
      {desks.map((d) => {
        const { x, y } = getDeskXY(d);
        const isMoved = !!positionOverrides?.[d.id];
        const isDragging = draggingId === d.id;
        const teammate = isTeamMate(d);
        const accessible = d.attributes?.wheelchairAccess;
        return (
          <button
            key={d.id}
            className={[
              'desk-marker',
              editMode ? 'edit-marker' : d.state,
              selectedId === d.id ? 'selected' : '',
              isMoved ? 'moved' : '',
              isDragging ? 'dragging' : '',
              teammate ? 'teammate-ring' : '',
              accessible ? 'accessible' : '',
              d.hotDesk ? 'hot-desk' : '',
            ].filter(Boolean).join(' ')}
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
            }}
            onMouseDown={editMode ? (e) => handleMarkerMouseDown(e, d) : undefined}
            onClick={!editMode ? () => onPick(d) : undefined}
            onMouseEnter={!editMode ? () => setHovered(d) : undefined}
            onMouseLeave={!editMode ? () => setHovered((h) => (h?.id === d.id ? null : h)) : undefined}
            title={editMode ? `${d.label} — drag to reposition` : `${d.label} — ${d.state}`}
            aria-label={`Desk ${d.label}${editMode ? ', drag to reposition' : `, ${d.state}`}`}
          />
        );
      })}
      {!editMode && hovered && <DeskTooltip desk={hovered} />}
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
        {attrs.wheelchairAccess && <span>♿ Wheelchair · </span>}
        {desk.hotDesk && <span>Hot-desk · </span>}
      </div>
      <div style={{ marginTop: 4 }}>
        State: <strong>{desk.state}</strong>
      </div>
      {desk.occupant && (
        <div className="tip-attr" style={{ marginTop: 4 }}>
          {desk.occupant.fullName} · {desk.occupant.startHour}:00–{desk.occupant.endHour}:00
          {desk.occupant.team && <span> · {desk.occupant.team}</span>}
        </div>
      )}
    </div>
  );
}
