# Find My Desk — MVP

Desk-booking skeleton for a Microsoft-first team. React + Vite frontend, Express backend, JSON-file persistence. Built to demonstrate the core booking journey end-to-end, with mocked services in place of real Teams / Graph / sensor integrations.

## Stack

- **Frontend:** React 18 + Vite + react-router (`client/`)
- **Backend:** Node + Express (`server/`)
- **Data:** `data/users.json` (150 mock users) + `data/desks.json` (156 desks across 2 floors) + `data/bookings.json` (created at runtime, gitignored)
- **Floor plans:** PNGs in `floorplans/`, served by Vite at `/ground.png` and `/first.png`

## Setup

```bash
npm install
npm install --prefix server
npm install --prefix client
```

Or in one shot:

```bash
npm run install:all
```

## Run

```bash
npm run dev
```

This starts:
- Server on http://localhost:4000
- Vite dev server on http://localhost:5173 (proxies `/api/*` to the server)

Open http://localhost:5173 in a browser.

To run them separately:

```bash
npm run dev:server
npm run dev:client
```

## Features

### Booking flow
1. Pick a date (defaults to today) and floor (Ground / First).
2. Click an available (green) desk on the floor plan.
3. Choose start/end hours (minimum 1 hour, maximum whole day, 7–22 range).
4. Confirm. Desk turns yellow ("booked"). Check in to turn it blue ("active").

### Simulated auto-release
Once you're checked in (active), the demo timer kicks off:
- **30s idle** → first "still here?" prompt
- **15s no response** → second prompt with **10s countdown**
- **No confirmation** → desk auto-released back to available

Real-world timings would be 90/20/10 minutes; compressed for live demos. Constants live in `client/src/components/AutoReleaseManager.jsx`.

### Team-nearby suggestions
For the chosen date, the side panel surfaces up to 3 available desks closest (by floor + coordinates) to a teammate who has already booked that day. "Teammate" means same `team`, `lab`, or `platform`. If no teammates are booked yet, falls back to top desks matching your `deskPreferences`.

### Privacy toggle
In the header. When enabled, other non-admin users see your booking as "Private booking" with the user hidden. Admins (first three users in `users.json`) always see full info.

### Current-user simulator
Top-right dropdown switches the active user — no real auth in MVP. Setting persists to localStorage.

### Manage page
`/manage` lists every booking for the chosen date with a force-release action, plus occupancy summary cards per floor. Lightweight admin view, intentionally placeholder.

## Backend API

| Method | Path                              | Notes                                                   |
|--------|-----------------------------------|---------------------------------------------------------|
| GET    | `/api/health`                     | Sanity check + counts                                   |
| GET    | `/api/users`                      | All users (public projection)                           |
| GET    | `/api/users/:id`                  | One user                                                |
| PATCH  | `/api/users/:id/privacy`          | `{ privacy: bool }`                                     |
| GET    | `/api/me`                         | Current simulated user                                  |
| POST   | `/api/me`                         | `{ id }` — switch user                                  |
| GET    | `/api/desks?date=YYYY-MM-DD`      | Desks + computed state for the date                     |
| GET    | `/api/bookings?date=&userId=`     | Filtered bookings                                       |
| POST   | `/api/bookings`                   | Create booking                                          |
| POST   | `/api/bookings/:id/checkin`       | Mark active                                             |
| POST   | `/api/bookings/:id/release`       | Release                                                 |
| DELETE | `/api/bookings/:id`               | Cancel                                                  |
| GET    | `/api/suggestions?userId=&date=`  | Team-nearby suggestions                                 |

## Regenerating desks.json

```bash
node server/scripts/generate-desks.js
```

Desk positions are normalised (0..1) over each floor PNG. Edit the zone tables at the top of that script to change layout, attribute mix, or pod size.

## Out of scope (per the MVP prompt)

- Real Microsoft Teams packaging / store deployment
- Real Microsoft Graph integration
- Real telemetry (ThousandEyes / Bluetooth / Intune / monitor events)
- Full enterprise admin suite, analytics pipeline, advanced approval workflows
- AI agent orchestration beyond the mocked nearby-suggestion logic

## Notes

- Admins are the first three records in `users.json`. They can see private bookings and have access to "Force release" in the Manage view.
- Privacy and admin flags are kept in server memory (intentionally not persisted to `users.json` so the seed data stays clean). Restarting the server resets them.
- The data folder is intentionally left at 150 users — even though the MVP prompt asks for 100 more, that ask was overridden during scoping.
