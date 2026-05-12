# Spacio — Live Demo Cribsheet

Companion to the Sentient mockup narration. This sheet covers **only the live app demo** (the 5–7 min slot after the 5 min mockup). Total deck: **12–15 min** → 2 intro + 5 mockup + 5–7 demo + buffer.

> The goal of the live demo is to prove the app is real and usable, *not* to show every feature. Pick the spine, stick to it, skip the rest if time slips.

---

## Pre-flight (do this BEFORE the call goes live)

1. **Start the app.** From repo root in PowerShell:
   ```powershell
   npm run dev
   ```
   Wait for both lines: `Server listening on 4000` and Vite `Local: http://localhost:5173`.

2. **Open two browser tabs side-by-side:**
   - **Tab A → `http://localhost:5173/`** — leave on the Book page. This is your "everyday user" tab.
   - **Tab B → `http://localhost:5173/manage`** — your admin tab. (Switch user to one of the first three in the dropdown — they're flagged admin.)

3. **Pick your demo identities up front** (top-right "You are:" dropdown):
   - **User A (standard, line manager with reports):** pick someone whose team has direct reports — e.g. a Lead in *Windows* or *Virtualisation* (so the "Book for my team" panel appears on `/my-team` and Suggestions has colleagues to anchor to).
   - **User B (admin):** any of the first three users in the dropdown — labelled `(admin)`.

4. **Reset state if you've been rehearsing:**
   - Cancel any leftover bookings from your demo user via **My bookings → Cancel**.
   - If the floorplan looks chaotic, restart the server — `data/bookings.json` survives restarts, the in-memory bits don't.

5. **Confirm the AI chat is live** (bottom-right purple ✦ button). If it's missing, the `ANTHROPIC_API_KEY` env var isn't set on the server — skip the chat beat.

6. **Compress timers if you want to show auto-release live:** auto-release defaults are short already (30s / 15s / 10s). Don't touch them.

7. **Zoom the browser to ~110–125%** so the floor plan is readable on a shared screen.

---

## The 5–7 min demo — beat sheet

Each beat lists: **what to do · what to say (one line) · why it matters**. Times are cumulative.

### Beat 1 — "Here's the app" (0:00 → 0:30)

- **Do:** Land on **Book** page (Tab A) with today's date selected, ground floor.
- **Say:** "This is the everyday user view. Pick a date, pick a floor, click a green desk."
- **Show:** The legend (Available / Booked / Active), the date picker, the floor dropdown.

### Beat 2 — Book a desk (0:30 → 1:15)

- **Do:** Click any **green** desk near a clustered pod. In the modal, leave 09:00 → 17:00, click **Confirm**.
- **Say:** "One desk per person per time slot. Standard users can book up to 14 days ahead; admins can go further."
- **Show:** Desk flips **yellow**. Right panel: **My bookings** now shows the entry with **Check in / Release / Cancel**.

### Beat 3 — Team-aware suggestions (1:15 → 2:00)

- **Do:** Look at the **Suggestions** panel on the right. Hover one entry — reason reads e.g. *"Near 2 teammates already booked"*.
- **Click** one suggestion → the modal opens pre-targeted on that desk. **Cancel** out of the modal (don't book; we just want to show the suggestion logic).
- **Say:** "Suggestions aren't a static filter. They score available desks against where your colleagues are *already* booked for that date — same team, lab, or platform — and fall back to your saved preferences if no one's in yet."
- **Show (optional, only if time):** Tick **Highlight my team** above the floor plan. Teammate desks get a pink ring.

### Beat 4 — Check-in and the ghost-booking problem (2:00 → 3:00)

- **Do:** In **My bookings**, click **Check in** on the booking from Beat 2. Desk flips **blue (active)**.
- **Say:** "Once you're checked in, the system knows you're really at the desk. If presence falls away…"
- **Wait ~30s** (or just talk through it — the timer fires after 30s idle in demo mode):
  - First prompt appears: *"Still at your desk?"* — **Click "I'm still here"** to dismiss, OR ignore it.
  - If you ignore it, the 10s countdown auto-releases the desk back to **green**.
- **Say:** "Real-world thresholds are 90 / 20 / 10 minutes. We compressed them to seconds for live demos. This is the 'ghost booking' problem — desks booked but unused — that booking-only systems can't see."

> **If you're tight on time, skip the wait** — just say "and if you walk away, the desk auto-releases after a configurable idle window. Admins set the thresholds on the Manage page."

### Beat 5 — Book on behalf of a direct report (3:00 → 4:00)

- **Do:** Navigate to **My Team** (header link). The **Book for my team** panel lists your direct reports.
- Tick 2–3 reports. Leave 09:00–17:00. Click **Book N desks**.
- **Say:** "Line managers can book for their reports in one click. Each desk is picked using *that person's* preferences and accessibility needs — not the manager's."
- **Show:** Result list shows which desk was assigned to whom, with zone and floor.

> **Fallback:** If your current user has no direct reports, the panel is hidden. Switch user (top-right) to someone who manages people. The Sentient hierarchy commit (`8457015`) put real managers in place.

### Beat 6 — AI chat assistant (4:00 → 5:00)

- **Do:** Click the purple **✦** in the bottom-right.
- **Type:** `Find a quiet window desk for tomorrow afternoon` (or `What's available in Virtualisation today?`).
- **Say:** "This is Claude, wired into the same booking APIs the UI uses. It's not a chatbot pretending to know — it actually queries desks, suggestions, and bookings as tools."
- **Show:** Open the **tool calls** disclosure under the reply — viewers can see `listDesks`, `getSuggestions`, etc. firing.
- **Optionally:** follow up with `Book me into that one` — the agent will create the booking and the desk flips yellow on the floor plan behind it.

> **If chat is disabled (no API key), skip this entire beat.** Replace with one extra minute on Beat 7 admin tools.

### Beat 7 — Admin view & insights (5:00 → 6:30)

- **Do:** Switch to **Tab B** (admin user, `/manage`).
- **Point at:** the four occupancy stats, the bookings table, **Force release** action.
- **Click → 📊 Occupancy Insights** at the top.
- **Say:** "Admins get the operational view. Ghost ratio, hot-desk pickup rate, peak hours, zone breakdown — all exportable as CSV."
- **Show:** The peak-hour bar chart and zone bars. Point at **Ghost ratio %** — tie it back to Beat 4.
- **Click → Back to Manage**, scroll to **Booking Reminders** → click **Send reminder to Teams**. The Teams card preview renders.
- **Say:** "One click sends a reminder to anyone who hasn't booked for a target date. The Teams card is the message they receive."

### Beat 8 — Close (6:30 → 7:00)

- **Say:** "Everything you've just seen runs on mock data today, but every panel is a real call to a real API. The Sentient mockup we showed earlier is the next step — same UI shell, sensor signals replacing simulated ones."
- **Land on** the Book page so the next speaker has a neutral starting screen.

---

## Beats you can cut if time is tight (5 min path)

In order of cuttability — drop these first:
1. **Beat 7's Reminders panel** (save 30s) — Insights is the higher-impact admin beat.
2. **Beat 3's "Highlight my team" toggle** (save 15s).
3. **Beat 4's live wait for auto-release** (save 30s) — narrate it instead.
4. **Beat 6 (AI chat)** (save 60s) — biggest single saving, but also the biggest "wow", so only cut if forced.

A clean 5-minute version = Beats 1, 2, 3, 4 (narrated), 5, 7 (Insights only).

---

## Things to mention in passing (one-liners, no clicks)

If a question comes up or you have 10s of slack, drop one of these:

- **Privacy:** *"Top-right toggle hides your booking from other standard users. Admins always see everything."*
- **Profile / accessibility:** *"Each user can flag accessibility needs — wheelchair, ergonomic chair, hearing loop. Those strongly bias suggestions and surface on the desk tooltip."*
- **Theming:** *"Three themes including a high-contrast WCAG-leaning palette. Per-device."*
- **Map vs Table view:** *"Map is great for spatial people, table is faster for screen-reader users and sorting by attribute."*
- **Delegation overrides:** *"Admins can grant 'book on behalf' rights beyond the default (self / line manager / admin) rules — useful for EAs."*

---

## Failure mode quick fixes

| Problem | Fix |
|---|---|
| Vite opened on port 5176, not 5173 | That's fine — use whatever port the terminal prints. Update both tabs. |
| Server won't start, `EADDRINUSE :4000` | Task Manager → kill `node.exe` processes → re-run `npm run dev`. |
| Floor plan is blank | Hard-refresh (Ctrl+F5). The `floorplans/*.png` files serve from `client/public`. |
| Desk you wanted is already yellow | Pick a different one — the side panel **Suggestions** is your shortcut to a good neighbour. |
| AI chat says "0 tool calls" or refuses | API key not set, or rate limit. Skip Beat 6. |
| "Booking for" dropdown not appearing in modal | Current user has no delegations beyond themselves. Switch to a line manager. |
| Live auto-release didn't fire | Idle timer resets on any mouse/keyboard activity — don't wiggle the mouse. |

---

## What NOT to demo

These exist in the app but distract from the spine — skip unless asked directly:

- **Admin configuration panel** (auto-release timings, presence signal toggles) — operational, not interesting in a 5-min slot.
- **Delegation overrides table** — niche.
- **Meeting rooms quick-hold panel** — only renders when hot-desk fallback is showing, and the 9–10 hardcode looks janky live.
- **Desk position edit mode** — internal calibration tool, not user-facing.
- **Sentient page (`/sentient`)** — that's the *mockup* slot, not the live demo. Don't open it twice.
