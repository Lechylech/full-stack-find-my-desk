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

1. Open `ideas/sentient-demo-narration.wav` in your media player but
   **don't press play yet**.
2. On the page, click the **`08:00`** tick on the timeline bar.
3. Click the **`60×`** speed button.
4. Hit play on the WAV at the same moment the timeline starts moving.

The narration is paced for 60× — 10 real minutes covers a full
simulated workday (08:00 → 18:00). Beat-by-beat cues are in
[`Prompt/SentientDemo-Narration.md`](./Prompt/SentientDemo-Narration.md).

If you drift out of sync, click the matching tick (`09:00`, `11:00`,
…) to re-anchor.

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

After editing the script, regenerate the WAV with:

```powershell
powershell -File scripts/generate-narration.ps1
```

Uses Windows SAPI (Microsoft Hazel voice). For an external demo, swap
in a neural TTS — the SSML in the script is portable.
