# Sentient Workplace — Demo Quickstart

A two-minute setup to run the narrated `/sentient` demo.

## 1. Start the app

From the repo root:

```bash
npm run install:all   # first time only
npm run dev
```

Wait for both lines to appear:

```
[server] Find My Desk server listening on http://localhost:4000
[client]   VITE v5  ready in ... ms  -> http://localhost:5173/
```

## 2. Open the Sentient page

Browse to <http://localhost:5173/sentient>.

You should see the floor plan with coloured zone heat-map, presence
dots, a notification feed on the right, and the timeline controls at
the bottom of the floor panel.

## 3. Run the narrated demo

1. Open `ideas/sentient-demo-narration.mp3` in your media player but
   **don't press play yet**.
2. On the page, click the **`08:00`** tick on the timeline bar.
3. Click the **`60×`** speed button.
4. Hit play on the MP3 at the same moment the timeline starts moving.

The MP3 is a continuous ~4-minute narration covering every beat from
doors-open through end-of-day. The 60× timeline runs for ~10 minutes,
so the audio will finish before the visual does — that's intentional,
the closing shots run silently to let viewers absorb the end-of-day
state. If you'd like to keep them in sync, drop the timeline to **10×**
or **30×**.

Voice: **Microsoft Ryan Neural (en-GB)**, served via the same public
Edge Read-Aloud endpoint Microsoft Edge itself uses — no API key.

## 4. Things to point out during the demo

- **11:00 beat** — two ghost bookings appear in the right panel; click
  **Release** on either to reclaim the desk.
- **15:00 beat** — wellness chips along the bottom flip to amber as
  CO₂ rises in Support.
- **Any time** — click a colleague in the right panel to draw a
  wayfinding route from the lobby to their desk; the floor auto-swaps
  if they sit on the other floor.
- **Layer toggles** above the map — turn heatmap / presence / network
  / wellness on and off to show each data source independently.

## 5. Reset the demo state

Either:

- Click **Reset all releases (demo)** at the bottom of the Ghost
  bookings panel, or
- Restart the server (`Ctrl-C` then `npm run dev`).

## 6. Regenerate the narration

After editing the script body, regenerate the MP3:

```bash
node scripts/generate-narration.mjs
```

Uses the `msedge-tts` package (already in `devDependencies`) to call
the public Edge Read-Aloud endpoint. Internet required. Try a
different voice with `--voice=en-GB-SoniaNeural` (female, UK), or any
other neural shortname.

### Offline fallback

If you're on a network without internet, run the legacy SAPI script
which uses local Windows voices:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-narration-offline.ps1
```

It writes a WAV (not MP3) using Microsoft George — noticeably less
natural than Ryan-Neural, but works fully offline.

---

## What's behind `/sentient`

Everything you see is local. There is no real Cisco Spaces feed, no
real ThousandEyes account, no real IoT sensor. The page is a
clock-driven projection of mock JSON files over the existing floor
plan.

### Architecture at a glance

```
[ React client (Vite, :5173) ]            [ Express server (:4000) ]
  /sentient route                            /api/sentient/*
    SentientPage.jsx                           ├── /scenarios
      useSentientClock.js  ──drives──┐         ├── /scenarios/:name
      HeatmapOverlay                 │         ├── /zones
      PresenceLayer                  │         ├── /network
      NetworkZonesLayer              │         ├── /wellness
      WellnessChips                  │         ├── /bookings
      NotificationFeed     ──reads──>│ JSON ──>├── /release
      ColleagueRouteLayer            │         └── /reset-releases
      GhostBookingPanel              │
      TimelineControls               │
                                     │
                                     └── data/sentient/{
                                            timeline.json
                                            zones.json
                                            network-quality.json
                                            wellness.json
                                            bookings.json
                                          }
```

### What each piece does

| Piece                                | Job                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `useSentientClock` hook              | Ticks a simulated clock 08:00 → 18:00 at 1× / 10× / 60× / 300× / pause                              |
| `data/sentient/timeline.json`        | 7 scripted steps with per-zone occupancy %, present-desk IDs, and notification events              |
| `data/sentient/zones.json`           | Floor regions (x/y/w/h in 0..1 space) used by every overlay layer                                   |
| `data/sentient/network-quality.json` | Per-zone Mbps / jitter / loss — drives the ThousandEyes-style bands                                 |
| `data/sentient/wellness.json`        | Per-zone CO₂ / temp / humidity / air-quality snapshots at 09:00 / 11:00 / 13:00 / 15:00 / 17:00     |
| `data/sentient/bookings.json`        | 20 synthetic bookings, 3 flagged `ghost: true` to demo auto-release                                 |
| `server/src/sentient.js`             | Express router that serves the JSON and tracks in-memory release state                              |
| `HeatmapOverlay`                     | Renders zone rectangles, colours them by interpolated occupancy                                     |
| `PresenceLayer`                      | Renders one dot per desk (sensed / ghost / walk-up / idle states)                                   |
| `NetworkZonesLayer`                  | Network-quality pill per zone                                                                       |
| `WellnessChips`                      | CO₂ / air-quality chip row under the map                                                            |
| `NotificationFeed`                   | Toast-like stack of events from the current and previous scenario step                              |
| `ColleagueRouteLayer`                | SVG polyline from the lobby anchor to a selected colleague's desk                                   |
| `GhostBookingPanel`                  | Lists `ghost: true` bookings past their start-hour by ≥ 60 sim-minutes, with a Release button       |
| `TimelineControls`                   | Pause / 1× / 10× / 60× / 300× and step-seek                                                         |

### Why it looks "live"

The clock hook runs on `requestAnimationFrame`. Every frame it
advances a simulated-minutes cursor by `(dtSec × speed) / 60`. The
heatmap and presence layers re-read the current step's occupancy and
linearly interpolate toward the next step's values, so the colours
morph smoothly between scripted moments. **Nothing on the server is
ticking** — the server only serves static JSON plus a tiny in-memory
release set.

This means the demo is **completely deterministic**: clicking 08:00
and pressing 60× gives the same visual every time. Great for reliable
recordings; not what you'd want if you needed "real" telemetry.

---

## Making it portable

"Portable" covers four common needs, ranked by effort:

### Level 1 — share the repo (lowest effort)

Anyone with Node 18+ and the repo can run:

```bash
git clone https://github.com/Lechylech/full-stack-find-my-desk
cd full-stack-find-my-desk
git checkout feat/sentient-and-fast-followers
npm run install:all
npm run dev
```

…and open <http://localhost:5173/sentient>. No databases, no API
keys, no `.env`. The narration MP3 is already in `ideas/`. Best path
for showing a colleague at their own machine.

### Level 2 — single-folder distribution

Build the client and have the server serve it as static files:

```bash
npm run build         # produces client/dist/
```

Then add a small tweak to `server/src/index.js`:

```js
import express from 'express';
import { resolve } from 'node:path';
// ...
app.use(express.static(resolve(__dirname, '../../client/dist')));
app.get('*', (_req, res) =>
  res.sendFile(resolve(__dirname, '../../client/dist/index.html'))
);
```

Zip up these directories:

```
server/                    Node + express
client/dist/               Built React bundle
data/                      JSON files (sentient/, desks.json, users.json)
floorplans/                PNGs
ideas/sentient-demo-narration.mp3
package.json + package-lock.json
```

Drop the folder on any Windows / Mac / Linux box with Node 18+ and
run `node server/src/index.js`. One port (4000), one process. Hand
this to a stakeholder.

### Level 3 — Docker image

Add a `Dockerfile` at the repo root:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm run install:all
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["node", "server/src/index.js"]
```

Build and run:

```bash
docker build -t sentient-workplace .
docker run -p 4000:4000 sentient-workplace
```

Open <http://localhost:4000/sentient>. Best for shared infra or CI.

### Level 4 — public URL

| Host                          | Notes                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| **Render / Railway / Fly.io** | Push the repo, point at the Dockerfile, set port to 4000. ~10 min, free tiers.              |
| **Azure App Service**         | Node 20 stack. Microsoft-aligned. `npm start` → `node server/src/index.js`.                 |
| **Vercel / Netlify**          | Frontend-only — would need to split the server into serverless functions. More work.        |

For a Microsoft / Teams-aligned demo, Azure App Service is the
shortest path. Once deployed, the public URL can be wrapped in a
Teams tab manifest (see `Prompt/FastFollower-AdditionalFeatures.md`
item 18) and the same `/sentient` page runs inside Teams.

### Gotchas

- In Levels 2-4, copy `ideas/sentient-demo-narration.mp3` alongside
  the bundle and serve it from `/ideas/...` if you want it reachable
  from the deployed page. Otherwise just play it from a local media
  player as steps 1-3 above describe.
- `data/bookings.json` is created on first booking by the original
  Find My Desk flow — the sentient mockup doesn't write to it. Safe
  to omit from the bundle if you only need `/sentient`.
- In-memory ghost-release state resets when the server restarts. The
  demo always boots clean — intentional.
- No environment variables required by `/sentient`. The main app may
  consume `TEAMS_WEBHOOK_URL` on other branches; this one does not.
