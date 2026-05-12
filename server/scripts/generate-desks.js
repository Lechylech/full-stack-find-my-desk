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
