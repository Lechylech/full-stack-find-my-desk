function heatColor(density) {
  const d = Math.max(0, Math.min(1, density));
  if (d < 0.25) return 'rgba(76, 175, 80, 0.30)';
  if (d < 0.5)  return 'rgba(255, 193, 7, 0.35)';
  if (d < 0.75) return 'rgba(255, 138, 0, 0.45)';
  return 'rgba(244, 67, 54, 0.55)';
}

export default function HeatmapOverlay({ zones, occupancy }) {
  return (
    <div className="heatmap-overlay">
      {zones.map((z) => {
        const density = occupancy[z.id] ?? 0;
        return (
          <div
            key={z.id}
            className="heat-zone"
            style={{
              left: `${z.x * 100}%`,
              top: `${z.y * 100}%`,
              width: `${z.w * 100}%`,
              height: `${z.h * 100}%`,
              background: heatColor(density),
              borderColor: density > 0.6 ? 'rgba(244, 67, 54, 0.6)' : 'rgba(0,0,0,0.15)',
            }}
            title={`${z.label} · ${Math.round(density * 100)}% occupancy`}
          >
            <span className="heat-label">{z.label}</span>
            <span className="heat-count">{Math.round(density * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}
