export default function PresenceLayer({ desks, presentDeskIds, bookings }) {
  const bookedByDeskId = new Map(bookings.filter((b) => !b.released).map((b) => [b.deskId, b]));
  return (
    <div className="presence-layer">
      {desks.map((d) => {
        const isBooked = bookedByDeskId.has(d.id);
        const isPresent = presentDeskIds.has(d.id);
        let state = 'idle';
        if (isBooked && isPresent) state = 'sensed-present';
        else if (isBooked && !isPresent) state = 'ghost';
        else if (!isBooked && isPresent) state = 'walk-up';

        return (
          <span
            key={d.id}
            className={`presence-dot-marker ${state}`}
            style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
            title={`${d.label} · ${state.replace('-', ' ')}`}
          />
        );
      })}
    </div>
  );
}
