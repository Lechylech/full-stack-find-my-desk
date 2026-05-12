const SPEEDS = [
  { label: 'Pause', value: 0 },
  { label: '1×', value: 1 },
  { label: '10×', value: 10 },
  { label: '60×', value: 60 },
  { label: '300×', value: 300 },
];

export default function TimelineControls({ clock }) {
  return (
    <div className="timeline-controls">
      <div className="timeline-clock">
        <span className="clock-time">{clock.clock}</span>
        <span className="clock-label">{clock.current?.label || ''}</span>
      </div>
      <div className="timeline-speeds">
        {SPEEDS.map((s) => (
          <button
            key={s.label}
            className={`speed-btn ${clock.speed === s.value ? 'active' : ''}`}
            onClick={() => clock.setSpeed(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="timeline-bar">
        {clock.steps.map((s, i) => (
          <button
            key={s.t}
            className={`timeline-tick ${clock.index === i ? 'active' : ''}`}
            onClick={() => clock.seek(i)}
            title={`${s.t} — ${s.label}`}
          >
            <span className="tick-time">{s.t}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
