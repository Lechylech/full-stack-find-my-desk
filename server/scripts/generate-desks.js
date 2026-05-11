// Generates data/desks.json with desks for the ground and first floors.
// Coordinates are normalised (0..1) over the corresponding PNG in /floorplans.
//
// Image dimensions: 1448 × 1086 (both PNGs).
// A single desk icon on the plan is ~30 × 35 px → ~0.020 × 0.032 normalised.
// Desks are drawn as back-to-back pairs along a workstation bench, so adjacent
// desks within a pod sit at roughly DX ≈ 0.020, DY ≈ 0.028 apart.
//
// Layout model: each "pod" is a 2 × 2 grid of desks (one workstation, four
// people). Pod centres are hand-measured from the floor plan PNGs.
//
// Re-run with: node server/scripts/generate-desks.js

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../data/desks.json');

const DX = 0.020;
const DY = 0.028;

// ---------- Ground floor pods ----------
// Pod centres measured visually from floorplans/ground.png (1448×1086).
const groundPods = [
  // WINDOWS — 2 columns × 3 rows of pods inside the blue zone (x≈0.05-0.29, y≈0.05-0.26)
  { zone: 'Windows', platform: 'Engineering', nearWindow: true,           cx: 0.115, cy: 0.090, rows: 2, cols: 2 },
  { zone: 'Windows', platform: 'Engineering', nearWindow: true,           cx: 0.230, cy: 0.090, rows: 2, cols: 2 },
  { zone: 'Windows', platform: 'Engineering', nearWindow: true,           cx: 0.115, cy: 0.160, rows: 2, cols: 2 },
  { zone: 'Windows', platform: 'Engineering', nearWindow: true,           cx: 0.230, cy: 0.160, rows: 2, cols: 2 },
  { zone: 'Windows', platform: 'Engineering',                             cx: 0.115, cy: 0.225, rows: 2, cols: 2 },
  { zone: 'Windows', platform: 'Engineering',                             cx: 0.230, cy: 0.225, rows: 2, cols: 2 },

  // SECURITY — 3 columns × 3 rows of pods inside the right blue zone (x≈0.56-0.96, y≈0.05-0.26)
  { zone: 'Security', platform: 'Cyber Security', nearWindow: true,       cx: 0.640, cy: 0.090, rows: 2, cols: 2 },
  { zone: 'Security', platform: 'Cyber Security', nearWindow: true,       cx: 0.760, cy: 0.090, rows: 2, cols: 2 },
  { zone: 'Security', platform: 'Cyber Security', nearWindow: true,       cx: 0.880, cy: 0.090, rows: 2, cols: 2 },
  { zone: 'Security', platform: 'Cyber Security', nearWindow: true,       cx: 0.640, cy: 0.160, rows: 2, cols: 2 },
  { zone: 'Security', platform: 'Cyber Security', nearWindow: true,       cx: 0.760, cy: 0.160, rows: 2, cols: 2 },
  { zone: 'Security', platform: 'Cyber Security', nearWindow: true,       cx: 0.880, cy: 0.160, rows: 2, cols: 2 },
  { zone: 'Security', platform: 'Cyber Security',                         cx: 0.640, cy: 0.225, rows: 2, cols: 2 },
  { zone: 'Security', platform: 'Cyber Security',                         cx: 0.760, cy: 0.225, rows: 2, cols: 2 },
  { zone: 'Security', platform: 'Cyber Security',                         cx: 0.880, cy: 0.225, rows: 2, cols: 2 },

  // VIRTUALISATION — 2 columns × 3 rows in the peach zone on the left (x≈0.05-0.29, y≈0.32-0.60)
  { zone: 'Virtualisation', platform: 'Engineering', quietZone: true,     cx: 0.115, cy: 0.370, rows: 2, cols: 2 },
  { zone: 'Virtualisation', platform: 'Engineering', quietZone: true,     cx: 0.230, cy: 0.370, rows: 2, cols: 2 },
  { zone: 'Virtualisation', platform: 'Engineering', quietZone: true,     cx: 0.115, cy: 0.450, rows: 2, cols: 2 },
  { zone: 'Virtualisation', platform: 'Engineering', quietZone: true,     cx: 0.230, cy: 0.450, rows: 2, cols: 2 },
  { zone: 'Virtualisation', platform: 'Engineering', quietZone: true,     cx: 0.115, cy: 0.530, rows: 2, cols: 2 },
  { zone: 'Virtualisation', platform: 'Engineering', quietZone: true,     cx: 0.230, cy: 0.530, rows: 2, cols: 2 },

  // SUPPORT — 3 columns × 4 rows in the peach zone on the right, extending down (x≈0.56-0.96, y≈0.32-0.78)
  { zone: 'Support', platform: 'Operations',                              cx: 0.640, cy: 0.370, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.760, cy: 0.370, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.880, cy: 0.370, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.640, cy: 0.450, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.760, cy: 0.450, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.880, cy: 0.450, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.640, cy: 0.560, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.760, cy: 0.560, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.880, cy: 0.560, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.640, cy: 0.660, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.760, cy: 0.660, rows: 2, cols: 2 },
  { zone: 'Support', platform: 'Operations',                              cx: 0.880, cy: 0.660, rows: 2, cols: 2 },
];

// ---------- First floor pods ----------
// First floor has six perimeter clusters around the central meeting-room column.
const firstPods = [
  // North-West (top-left) — 2 cols × 3 rows
  { zone: 'North-West Pods', platform: 'Engineering', nearWindow: true,   cx: 0.105, cy: 0.080, rows: 2, cols: 2 },
  { zone: 'North-West Pods', platform: 'Engineering', nearWindow: true,   cx: 0.220, cy: 0.080, rows: 2, cols: 2 },
  { zone: 'North-West Pods', platform: 'Engineering', nearWindow: true,   cx: 0.105, cy: 0.155, rows: 2, cols: 2 },
  { zone: 'North-West Pods', platform: 'Engineering', nearWindow: true,   cx: 0.220, cy: 0.155, rows: 2, cols: 2 },
  { zone: 'North-West Pods', platform: 'Engineering',                     cx: 0.105, cy: 0.230, rows: 2, cols: 2 },
  { zone: 'North-West Pods', platform: 'Engineering',                     cx: 0.220, cy: 0.230, rows: 2, cols: 2 },

  // North-East (top-right) — 3 cols × 3 rows
  { zone: 'North-East Pods', platform: 'Data', nearWindow: true,          cx: 0.625, cy: 0.080, rows: 2, cols: 2 },
  { zone: 'North-East Pods', platform: 'Data', nearWindow: true,          cx: 0.745, cy: 0.080, rows: 2, cols: 2 },
  { zone: 'North-East Pods', platform: 'Data', nearWindow: true,          cx: 0.865, cy: 0.080, rows: 2, cols: 2 },
  { zone: 'North-East Pods', platform: 'Data', nearWindow: true,          cx: 0.625, cy: 0.155, rows: 2, cols: 2 },
  { zone: 'North-East Pods', platform: 'Data', nearWindow: true,          cx: 0.745, cy: 0.155, rows: 2, cols: 2 },
  { zone: 'North-East Pods', platform: 'Data', nearWindow: true,          cx: 0.865, cy: 0.155, rows: 2, cols: 2 },
  { zone: 'North-East Pods', platform: 'Data',                            cx: 0.625, cy: 0.230, rows: 2, cols: 2 },
  { zone: 'North-East Pods', platform: 'Data',                            cx: 0.745, cy: 0.230, rows: 2, cols: 2 },
  { zone: 'North-East Pods', platform: 'Data',                            cx: 0.865, cy: 0.230, rows: 2, cols: 2 },

  // West (mid-left) — 2 cols × 2 rows
  { zone: 'West Pods', platform: 'Engineering', quietZone: true,          cx: 0.105, cy: 0.400, rows: 2, cols: 2 },
  { zone: 'West Pods', platform: 'Engineering', quietZone: true,          cx: 0.220, cy: 0.400, rows: 2, cols: 2 },
  { zone: 'West Pods', platform: 'Engineering', quietZone: true,          cx: 0.105, cy: 0.480, rows: 2, cols: 2 },
  { zone: 'West Pods', platform: 'Engineering', quietZone: true,          cx: 0.220, cy: 0.480, rows: 2, cols: 2 },

  // East (mid-right) — 3 cols × 2 rows
  { zone: 'East Pods', platform: 'Data',                                  cx: 0.625, cy: 0.400, rows: 2, cols: 2 },
  { zone: 'East Pods', platform: 'Data',                                  cx: 0.745, cy: 0.400, rows: 2, cols: 2 },
  { zone: 'East Pods', platform: 'Data',                                  cx: 0.865, cy: 0.400, rows: 2, cols: 2 },
  { zone: 'East Pods', platform: 'Data',                                  cx: 0.625, cy: 0.480, rows: 2, cols: 2 },
  { zone: 'East Pods', platform: 'Data',                                  cx: 0.745, cy: 0.480, rows: 2, cols: 2 },
  { zone: 'East Pods', platform: 'Data',                                  cx: 0.865, cy: 0.480, rows: 2, cols: 2 },

  // South-West (bottom-left) — 2 cols × 3 rows
  { zone: 'South-West Pods', platform: 'Product',                         cx: 0.105, cy: 0.600, rows: 2, cols: 2 },
  { zone: 'South-West Pods', platform: 'Product',                         cx: 0.220, cy: 0.600, rows: 2, cols: 2 },
  { zone: 'South-West Pods', platform: 'Product',                         cx: 0.105, cy: 0.685, rows: 2, cols: 2 },
  { zone: 'South-West Pods', platform: 'Product',                         cx: 0.220, cy: 0.685, rows: 2, cols: 2 },
  { zone: 'South-West Pods', platform: 'Product',                         cx: 0.105, cy: 0.765, rows: 2, cols: 2 },
  { zone: 'South-West Pods', platform: 'Product',                         cx: 0.220, cy: 0.765, rows: 2, cols: 2 },

  // South-East (bottom-right) — 3 cols × 3 rows
  { zone: 'South-East Pods', platform: 'Product',                         cx: 0.625, cy: 0.600, rows: 2, cols: 2 },
  { zone: 'South-East Pods', platform: 'Product',                         cx: 0.745, cy: 0.600, rows: 2, cols: 2 },
  { zone: 'South-East Pods', platform: 'Product',                         cx: 0.865, cy: 0.600, rows: 2, cols: 2 },
  { zone: 'South-East Pods', platform: 'Product',                         cx: 0.625, cy: 0.685, rows: 2, cols: 2 },
  { zone: 'South-East Pods', platform: 'Product',                         cx: 0.745, cy: 0.685, rows: 2, cols: 2 },
  { zone: 'South-East Pods', platform: 'Product',                         cx: 0.865, cy: 0.685, rows: 2, cols: 2 },
  { zone: 'South-East Pods', platform: 'Product',                         cx: 0.625, cy: 0.765, rows: 2, cols: 2 },
  { zone: 'South-East Pods', platform: 'Product',                         cx: 0.745, cy: 0.765, rows: 2, cols: 2 },
  { zone: 'South-East Pods', platform: 'Product',                         cx: 0.865, cy: 0.765, rows: 2, cols: 2 },
];

function expandPod(pod) {
  const out = [];
  const { cx, cy, rows, cols } = pod;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cx + (c - (cols - 1) / 2) * DX;
      const y = cy + (r - (rows - 1) / 2) * DY;
      out.push({ x: round(x), y: round(y) });
    }
  }
  return out;
}

function round(n) { return Math.round(n * 1000) / 1000; }

function buildDesks(floor, pods, prefix) {
  const desks = [];
  let n = 1;
  for (const pod of pods) {
    const coords = expandPod(pod);
    coords.forEach((c, i) => {
      const dualMonitor      = i % 2 === 0;
      const heightAdjustable = i % 3 === 0;
      const quietZone        = pod.quietZone === true || i % 5 === 0;
      const nearWindow       = pod.nearWindow === true;
      desks.push({
        id: `${prefix}-${String(n).padStart(3, '0')}`,
        label: `${prefix}${String(n).padStart(3, '0')}`,
        floor,
        zone: pod.zone,
        platform: pod.platform,
        hotDesk: pod.hotDesk === true,
        x: c.x,
        y: c.y,
        attributes: { dualMonitor, nearWindow, quietZone, heightAdjustable },
      });
      n++;
    });
  }
  return desks;
}

const ground = buildDesks('ground', groundPods, 'G');
const first  = buildDesks('first',  firstPods,  'F');
const all = [...ground, ...first];

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(all, null, 2));
console.log(`Wrote ${all.length} desks → ${OUT} (ground: ${ground.length}, first: ${first.length})`);
