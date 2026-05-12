# Sentient Workplace — 60× Timeline Narration Script

A voice-over to play alongside the `/sentient` mockup with the timeline
control set to **60×**. At that speed, the scripted day (08:00 → 18:00)
takes ten real minutes to play through; this script targets that window.

## How to use

1. Open `http://localhost:5173/sentient`.
2. Set the speed selector to **60×** and click the **08:00** tick to seek
   to the start.
3. Press play on the narration audio (`ideas/sentient-demo-narration.wav`)
   and immediately let the timeline run — the first line lands at the
   start of the day.
4. Re-seek the timeline tick to the matching beat if you drift; each
   audio beat below maps to one simulated clock-time.

## Pacing reference

At 60× speed, **one real second equals one simulated minute**. The table
below lists each scenario beat, its real-seconds offset from playback
start, and the cue the narrator should land near.

| Sim clock | Real-seconds offset | Beat                  |
| --------- | ------------------- | --------------------- |
| 08:00     | 0                   | Doors open            |
| 09:00     | 60                  | Morning warm-up       |
| 11:00     | 180                 | Late morning peak     |
| 13:00     | 300                 | Lunch dip             |
| 15:00     | 420                 | Afternoon peak        |
| 16:00     | 480                 | Wind-down             |
| 18:00     | 600                 | End of day            |

Total runtime budget: ~10 minutes. The script below is paced for ~7
minutes of speech, leaving deliberate silent space where the visual
needs room to breathe.

---

## Narration script

> **Voice:** calm, mid-paced, mid-confidence. Think enterprise-product
> walkthrough, not advertisement. Pause one beat after every sentence.

### 0:00 — 08:00 · Doors open

> Welcome to Spacio. What you're seeing is a live operational view of a
> two-floor office, fused from three data sources: Cisco Spaces wifi
> presence, ThousandEyes network telemetry, and Wellness IoT sensors.
>
> It's eight in the morning. The lobby is the only zone with any
> meaningful traffic — three early arrivals across the building.
> Everything else reads green and quiet.

*(pause — ~10 seconds of silence to let the heatmap settle)*

### 1:00 — 09:00 · Morning warm-up

> Nine o'clock. Cisco Spaces is now reporting around forty percent
> occupancy in the Windows and Security neighbourhoods on the ground
> floor. The Engineering pods on the first floor are filling at a
> similar pace.
>
> Up in the right panel, you'll see two notifications fire. The first
> is a context-aware welcome — the system has matched the arriving
> user's team to the Windows neighbourhood and is inviting them to
> book a desk nearby. The second is more interesting: a ThousandEyes
> alert. The uplink serving the East Pods on the first floor has
> degraded. The map shows that zone in amber, and the chip reads
> "patchy". Anyone with a video meeting in the next hour gets a
> different recommendation.

*(pause — ~20 seconds, let the dots populate)*

### 3:00 — 11:00 · Late morning peak

> Eleven o'clock. We're at peak morning density. Notice the red glow
> over Support, ground floor — eighty percent occupancy. The Security
> zone is matching it.
>
> Here's where the system starts earning its keep. Two ghost bookings
> have just been flagged. G-031, booked by Daniel Reyes from Cyber
> Security; no presence sensed for ninety minutes. F-013, Sara Bennett,
> same story. The right-hand panel offers a one-click release for each,
> and an auto-release countdown is running. This is the "ghost booking"
> problem most desk-booking tools simply cannot see, because they only
> have booking data, not presence data.
>
> The notification feed also surfaces a quiet tip — Virtualisation is
> only fifty-five percent full, with five quiet-zone desks still free.
> That's a colleague-aware suggestion, not a static map filter.

*(pause — ~25 seconds, this is the big "wow" beat)*

### 5:00 — 13:00 · Lunch dip

> One PM. Lunch dip. Occupancy on the working floors has dropped to the
> mid-forties; the Breakout zone has spiked to seventy-five percent.
>
> One of the earlier ghost bookings has now auto-released. The system
> reclaimed that desk without human intervention. Trustworthy
> utilisation data — bookings reconciled with actual presence — flows
> straight into the analytics layer this view sits on top of.
>
> If you click any colleague on the right panel, the floor plan draws
> a route from the lobby to their desk. That's indoor wayfinding,
> ready to be backed by Bluetooth beacons or Cisco DNA spaces when the
> real signals are wired in.

*(pause — ~20 seconds)*

### 7:00 — 15:00 · Afternoon peak

> Three PM, second peak of the day. Support has hit ninety percent.
> Look at the wellness strip along the bottom — CO₂ in Support is over
> a thousand parts per million, and the air-quality chip has flipped
> to amber. The notification feed has already pinged facilities to
> step up the HVAC. That's a wellness signal informing real-time
> building operations.
>
> The earlier network alert has cleared. East Pods is back to good —
> safe for video again.

*(pause — ~10 seconds)*

### 8:00 — 16:00 · Wind-down

> Four o'clock. Occupancy is starting to taper, but not uniformly —
> the Data pods on the first floor are holding steady while the
> ground floor empties first. The heat-map captures that gradient in
> a way a table of bookings just cannot.

*(pause — ~15 seconds)*

### 10:00 — 18:00 · End of day

> Six PM. The building is at eight percent occupancy. The last
> notification of the day is a polite reminder to the three remaining
> users with active bookings — badge out, or the system will release
> the desk for tomorrow's first arrivals.
>
> That's a workday on Spacio. Cisco Spaces gave us the presence
> signal. ThousandEyes gave us the network signal. The Wellness IoT
> layer gave us the human signal. The desk-booking app stitched them
> into a single operational view, and the people working in the
> building barely noticed it was there.

*(end — let the timeline finish to 18:00 in silence)*

---

## Production notes

- The accompanying audio file `ideas/sentient-demo-narration.wav` was
  generated with the Windows SAPI voice (System.Speech.Synthesis). It
  is intentionally a deterministic, regenerable artefact — re-run the
  PowerShell snippet below after any script changes:

```powershell
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft Hazel Desktop")  # or any installed voice
$synth.Rate = 0
$synth.SetOutputToWaveFile("ideas/sentient-demo-narration.wav")
$synth.Speak((Get-Content "Prompt/SentientDemo-Narration-Script.txt" -Raw))
$synth.Dispose()
```

- Replace SAPI with a production voice (ElevenLabs / Azure Neural TTS)
  for any external-facing demo. Keep the timing cues unchanged.
- If the narration runs short, lengthen the silent pauses rather than
  padding the script — silence keeps attention on the visual.
