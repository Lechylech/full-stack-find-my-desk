import { useEffect, useMemo, useRef, useState } from 'react';

function parseHHMM(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function formatHHMM(mins) {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Drives a simulated workday clock across the scenario steps.
 * speed=0 pauses; 1 = real-time; 60 = 1 real-second per simulated minute.
 */
export function useSentientClock(steps, { initialSpeed = 60 } = {}) {
  const stepMinutes = useMemo(() => steps.map((s) => parseHHMM(s.t)), [steps]);
  const firstMin = stepMinutes[0] ?? 0;
  const lastMin = stepMinutes[stepMinutes.length - 1] ?? firstMin;

  const [speed, setSpeed] = useState(initialSpeed);
  const [simMin, setSimMin] = useState(firstMin);
  const lastTickRef = useRef(performance.now());
  const rafRef = useRef(0);

  useEffect(() => {
    function tick(now) {
      const dtSec = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (speed > 0) {
        setSimMin((prev) => {
          const next = prev + (dtSec * speed) / 60;
          if (next > lastMin) return firstMin;
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speed, firstMin, lastMin]);

  // Reset cursor to start when steps change identity (scenario swap)
  useEffect(() => {
    setSimMin(firstMin);
  }, [firstMin]);

  // Current step index = greatest step whose t <= simMin
  let index = 0;
  for (let i = 0; i < stepMinutes.length; i++) {
    if (stepMinutes[i] <= simMin) index = i;
    else break;
  }
  const nextIndex = Math.min(index + 1, stepMinutes.length - 1);
  const segMin = stepMinutes[nextIndex] - stepMinutes[index];
  const fraction = segMin > 0 ? Math.min(1, (simMin - stepMinutes[index]) / segMin) : 0;

  const current = steps[index];
  const next = steps[nextIndex];
  const clock = formatHHMM(simMin);

  function seek(stepIdx) {
    const m = stepMinutes[Math.max(0, Math.min(stepMinutes.length - 1, stepIdx))];
    setSimMin(m);
  }

  function jumpBy(deltaMin) {
    setSimMin((prev) => {
      const next = prev + deltaMin;
      if (next > lastMin) return firstMin;
      if (next < firstMin) return lastMin;
      return next;
    });
  }

  return {
    simMin,
    clock,
    index,
    fraction,
    current,
    next,
    speed,
    setSpeed,
    seek,
    jumpBy,
    steps,
  };
}

/** Interpolate per-zone occupancy between current and next step. */
export function interpolateOccupancy(current, next, fraction, floor) {
  const a = current?.zoneOccupancy?.[floor] || {};
  const b = next?.zoneOccupancy?.[floor] || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const result = {};
  for (const k of keys) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    result[k] = av + (bv - av) * fraction;
  }
  return result;
}

/** Pick the wellness snapshot for the nearest scheduled hour <= clock. */
export function pickWellness(wellness, clock) {
  const target = parseHHMM(clock);
  const keys = Object.keys(wellness.schedule).sort();
  let chosen = keys[0];
  for (const k of keys) {
    if (parseHHMM(k) <= target) chosen = k;
    else break;
  }
  return { stamp: chosen, values: wellness.schedule[chosen] };
}
