import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import { useSentientClock, interpolateOccupancy, pickWellness } from './useSentientClock.js';
import HeatmapOverlay from '../../components/sentient/HeatmapOverlay.jsx';
import PresenceLayer from '../../components/sentient/PresenceLayer.jsx';
import NotificationFeed from '../../components/sentient/NotificationFeed.jsx';
import ColleagueRouteLayer from '../../components/sentient/ColleagueRouteLayer.jsx';
import NetworkZonesLayer from '../../components/sentient/NetworkZonesLayer.jsx';
import WellnessChips from '../../components/sentient/WellnessChips.jsx';
import TimelineControls from '../../components/sentient/TimelineControls.jsx';
import GhostBookingPanel from '../../components/sentient/GhostBookingPanel.jsx';

const FLOOR_IMAGES = {
  ground: '/ground.png',
  first: '/first.png',
};

export default function SentientPage() {
  const [scenario, setScenario] = useState(null);
  const [zones, setZones] = useState({ ground: [], first: [] });
  const [network, setNetwork] = useState({ ground: {}, first: {} });
  const [wellness, setWellness] = useState({ schedule: {} });
  const [bookings, setBookings] = useState([]);
  const [floor, setFloor] = useState('ground');
  const [layers, setLayers] = useState({ heatmap: true, presence: true, network: true, wellness: true, route: true });
  const [selectedColleagueId, setSelectedColleagueId] = useState(null);
  const [desks, setDesks] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, z, n, w, b, d] = await Promise.all([
          api.sentient.getScenario('weekday-default'),
          api.sentient.getZones(),
          api.sentient.getNetwork(),
          api.sentient.getWellness(),
          api.sentient.getBookings(),
          api.listDesks(new Date().toISOString().slice(0, 10)),
        ]);
        setScenario(s);
        setZones(z);
        setNetwork(n);
        setWellness(w);
        setBookings(b);
        setDesks(d);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const steps = scenario?.steps || [];
  const clock = useSentientClock(steps, { initialSpeed: 60 });

  const occupancy = useMemo(() => {
    if (!clock.current) return {};
    return interpolateOccupancy(clock.current, clock.next, clock.fraction, floor);
  }, [clock.current, clock.next, clock.fraction, floor]);

  const presentDeskIds = useMemo(() => {
    return new Set(clock.current?.presentDeskIds || []);
  }, [clock.current]);

  const wellnessNow = useMemo(() => {
    if (!wellness.schedule || Object.keys(wellness.schedule).length === 0) return { values: {} };
    return pickWellness(wellness, clock.clock);
  }, [wellness, clock.clock]);

  const floorZones = zones[floor] || [];
  const floorDesks = useMemo(() => desks.filter((d) => d.floor === floor), [desks, floor]);
  const floorNetwork = network[floor] || {};

  const refreshBookings = async () => {
    try {
      const b = await api.sentient.getBookings();
      setBookings(b);
    } catch (e) {
      setError(e.message);
    }
  };

  const releaseBooking = async (id) => {
    try {
      await api.sentient.releaseGhost(id);
      await refreshBookings();
    } catch (e) {
      setError(e.message);
    }
  };

  const resetReleases = async () => {
    try {
      await api.sentient.resetReleases();
      await refreshBookings();
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) {
    return <main className="main"><div className="panel error-panel">Error: {error}</div></main>;
  }
  if (!scenario) {
    return <main className="main"><div className="panel">Loading scenario…</div></main>;
  }

  // Active notifications: every event from steps at-or-before current time
  // that hasn't been replaced by a step after the current one. Simpler:
  // show events from the current step + the prior one for context.
  const activeEvents = [];
  for (let i = Math.max(0, clock.index - 1); i <= clock.index; i++) {
    for (const e of steps[i]?.events || []) activeEvents.push({ ...e, _step: steps[i].t });
  }

  // Compute ghost bookings: booked + has ghost flag + past startHour by ≥ 60 min + not released
  const simMinutes = clock.simMin;
  const ghostBookings = bookings.filter((b) => {
    if (b.released) return false;
    if (!b.ghost) return false;
    const startMin = b.startHour * 60;
    return simMinutes - startMin >= 60;
  });

  const selectedColleague = selectedColleagueId ? bookings.find((b) => b.user.id === selectedColleagueId) : null;

  return (
    <main className="main sentient-main">
      <section className="panel sentient-floor-panel">
        <div className="sentient-header">
          <div>
            <span className="sentient-badge">Cisco Spaces</span>
            <span className="sentient-badge">ThousandEyes</span>
            <span className="sentient-badge wellness">Wellness IoT</span>
          </div>
          <div className="sentient-scenario-label">
            <strong>{scenario.label}</strong>
            <small>{scenario.description}</small>
          </div>
        </div>

        <div className="floor-controls">
          <label>
            Floor{' '}
            <select value={floor} onChange={(e) => setFloor(e.target.value)}>
              <option value="ground">Ground</option>
              <option value="first">First</option>
            </select>
          </label>
          <div className="layer-toggles">
            {Object.keys(layers).map((k) => (
              <label key={k} className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layers[k]}
                  onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })}
                />
                {k}
              </label>
            ))}
          </div>
        </div>

        <div className="floor-wrap sentient-floor-wrap">
          <img className="floor-img" src={FLOOR_IMAGES[floor]} alt={`${floor} floor`} draggable={false} />
          {layers.heatmap && (
            <HeatmapOverlay zones={floorZones} occupancy={occupancy} />
          )}
          {layers.network && (
            <NetworkZonesLayer zones={floorZones} network={floorNetwork} />
          )}
          {layers.presence && (
            <PresenceLayer desks={floorDesks} presentDeskIds={presentDeskIds} bookings={bookings} />
          )}
          {layers.route && selectedColleague && (
            <ColleagueRouteLayer
              floorZones={zones[floor] || []}
              floorDesks={desks}
              targetDeskId={selectedColleague.deskId}
              targetFloor={selectedColleague.deskId?.startsWith('G') ? 'ground' : 'first'}
              currentFloor={floor}
            />
          )}
        </div>

        {layers.wellness && (
          <WellnessChips zones={floorZones} wellness={wellnessNow.values} stamp={wellnessNow.stamp} />
        )}

        <TimelineControls clock={clock} />
      </section>

      <aside className="sentient-side">
        <NotificationFeed events={activeEvents} clock={clock.clock} />
        <GhostBookingPanel
          ghosts={ghostBookings}
          onRelease={releaseBooking}
          onReset={resetReleases}
          totalBookings={bookings.length}
        />
        <ColleaguePicker
          bookings={bookings}
          presentDeskIds={presentDeskIds}
          selectedColleagueId={selectedColleagueId}
          onSelect={(id) => {
            setSelectedColleagueId(id);
            const b = bookings.find((bk) => bk.user.id === id);
            if (b?.deskId) setFloor(b.deskId.startsWith('G') ? 'ground' : 'first');
          }}
        />
      </aside>
    </main>
  );
}

function ColleaguePicker({ bookings, presentDeskIds, selectedColleagueId, onSelect }) {
  return (
    <div className="panel">
      <h2>Colleague visibility</h2>
      <p className="muted small">Click a teammate to highlight their desk + draw a route from the lobby.</p>
      <div className="colleague-list">
        {bookings.map((b) => {
          const present = presentDeskIds.has(b.deskId);
          const isSelected = b.user.id === selectedColleagueId;
          return (
            <button
              key={b.id}
              className={`colleague-row ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(b.user.id)}
            >
              <span className={`presence-dot ${present ? 'present' : 'absent'}`} />
              <span className="colleague-name">{b.user.fullName}</span>
              <span className="muted small">{b.user.team} · {b.deskId}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
