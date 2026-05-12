const AIR_COLOR = {
  good: 'var(--air-good)',
  fair: 'var(--air-fair)',
  poor: 'var(--air-poor)',
};

export default function WellnessChips({ zones, wellness, stamp }) {
  return (
    <div className="wellness-strip">
      <span className="muted small">Wellness IoT · snapshot {stamp}:</span>
      {zones.map((z) => {
        const w = wellness[z.id];
        if (!w) return null;
        return (
          <span
            key={z.id}
            className="wellness-chip"
            style={{ borderColor: AIR_COLOR[w.air] }}
            title={`${z.label}: CO₂ ${w.co2}ppm · ${w.tempC}°C · ${w.humidity}% RH · air ${w.air}`}
          >
            <strong>{z.label}</strong>
            <span className="wellness-co2">{w.co2}ppm</span>
            <span className={`air-dot air-${w.air}`} />
          </span>
        );
      })}
    </div>
  );
}
