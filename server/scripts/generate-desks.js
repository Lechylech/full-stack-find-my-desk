// Generates data/desks.json with desks for the ground and first floors.
// Coordinates are normalised (0..1) over the corresponding PNG in /floorplans.
// Re-run with: node server/scripts/generate-desks.js

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../data/desks.json');

// Each zone: cluster of pods. Each pod is a small grid of desks.
// Coords roughly mirror the labelled zones visible in floorplans/ground.png
// and the perimeter pods visible in floorplans/first.png.
// Layout maths: dx=0.035 keeps a pod of 3 cols at 0.105 wide; with podGap=0.03,
// 3 pods span 3*0.105 + 2*0.03 = 0.375 — fits between x=0.60 and x=0.975.
const DX = 0.035;
const DY = 0.045;
const POD_GAP_X = 0.03;

const groundZones = [
  // Top row
  { zone: 'Windows',         platform: 'Engineering',    pods: gridPods(0.04, 0.08, 2, 2, 3, POD_GAP_X, DX, DY), nearWindow: true },
  { zone: 'Security',        platform: 'Cyber Security', pods: gridPods(0.68, 0.08, 3, 2, 3, 0.01, DX, DY), nearWindow: true },
  // Middle row (left/right of meeting rooms)
  { zone: 'Virtualisation',  platform: 'Engineering',    pods: gridPods(0.04, 0.38, 2, 2, 3, POD_GAP_X, DX, DY), quietZone: true },
  { zone: 'Support',         platform: 'Operations',     pods: gridPods(0.68, 0.38, 3, 2, 3, 0.01, DX, DY) },
  // Bottom row
  { zone: 'Breakout',        platform: 'Shared',         pods: gridPods(0.18, 0.78, 2, 2, 2, POD_GAP_X, DX, DY), hotDesk: true },
  { zone: 'Reception Pods',  platform: 'Shared',         pods: gridPods(0.62, 0.78, 2, 2, 2, POD_GAP_X, DX, DY) },
];

const firstZones = [
  { zone: 'North-West Pods', platform: 'Engineering',    pods: gridPods(0.04, 0.08, 2, 2, 3, POD_GAP_X, DX, DY), nearWindow: true },
  { zone: 'North-East Pods', platform: 'Data',           pods: gridPods(0.68, 0.08, 3, 2, 3, 0.01, DX, DY), nearWindow: true },
  { zone: 'West Pods',       platform: 'Engineering',    pods: gridPods(0.04, 0.40, 2, 2, 3, POD_GAP_X, DX, DY), quietZone: true },
  { zone: 'East Pods',       platform: 'Data',           pods: gridPods(0.68, 0.40, 3, 2, 3, 0.01, DX, DY) },
  { zone: 'South-West Pods', platform: 'Product',        pods: gridPods(0.04, 0.74, 2, 2, 2, POD_GAP_X, DX, DY) },
  { zone: 'South-East Pods', platform: 'Product',        pods: gridPods(0.68, 0.74, 3, 2, 2, 0.01, DX, DY) },
];

function gridPods(x0, y0, pods, rows, cols, podGapX, dx, dy) {
  // Returns desk coords for `pods` adjacent pod blocks of `rows` x `cols`.
  const coords = [];
  for (let p = 0; p < pods; p++) {
    const px = x0 + p * (cols * dx + podGapX);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        coords.push({ x: round(px + c * dx), y: round(y0 + r * dy) });
      }
    }
  }
  return coords;
}

function round(n) { return Math.round(n * 1000) / 1000; }

function buildDesks(floor, zones, prefix) {
  const desks = [];
  let n = 1;
  for (const z of zones) {
    let idx = 0;
    for (const c of z.pods) {
      const dualMonitor = idx % 2 === 0;
      const heightAdjustable = idx % 3 === 0;
      const quietZone = z.quietZone === true || (idx % 5 === 0 && z.zone !== 'Breakout');
      const nearWindow = z.nearWindow === true && idx < Math.ceil(z.pods.length / 2);
      desks.push({
        id: `${prefix}-${String(n).padStart(3, '0')}`,
        label: `${prefix}${String(n).padStart(3, '0')}`,
        floor,
        zone: z.zone,
        platform: z.platform,
        hotDesk: z.hotDesk === true,
        x: c.x,
        y: c.y,
        attributes: {
          dualMonitor,
          nearWindow,
          quietZone,
          heightAdjustable,
        },
      });
      n++;
      idx++;
    }
  }
  return desks;
}

const ground = buildDesks('ground', groundZones, 'G');
const first  = buildDesks('first',  firstZones,  'F');
const all = [...ground, ...first];

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(all, null, 2));
console.log(`Wrote ${all.length} desks → ${OUT} (ground: ${ground.length}, first: ${first.length})`);
