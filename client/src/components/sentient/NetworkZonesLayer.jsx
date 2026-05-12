const QUALITY_BORDER = {
  excellent: 'rgba(33, 150, 243, 0.8)',
  good:      'rgba(76, 175, 80, 0.7)',
  fair:      'rgba(255, 152, 0, 0.8)',
  poor:      'rgba(244, 67, 54, 0.85)',
};

export default function NetworkZonesLayer({ zones, network }) {
  return (
    <div className="network-overlay">
      {zones.map((z) => {
        const n = network[z.id];
        if (!n) return null;
        return (
          <div
            key={z.id}
            className={`network-zone quality-${n.quality}`}
            style={{
              left: `${z.x * 100}%`,
              top: `${(z.y + z.h - 0.025) * 100}%`,
              width: `${z.w * 100}%`,
              borderColor: QUALITY_BORDER[n.quality],
            }}
            title={`${z.label}: ${n.label} · ${n.mbps} Mbps · jitter ${n.jitterMs}ms · loss ${n.packetLossPct}%`}
          >
            <span className={`network-pill ${n.quality}`}>
              {n.quality === 'excellent' && 'High-perf video'}
              {n.quality === 'good' && 'Stable'}
              {n.quality === 'fair' && 'Patchy'}
              {n.quality === 'poor' && 'Degraded'}
              {' · '}{n.mbps} Mbps
            </span>
          </div>
        );
      })}
    </div>
  );
}
