# Fast-Follower Prompt — End-to-End Test Plan & v1 Report

Act as a senior QA engineer comfortable with Playwright, Node/Express, and React/Vite stacks.

The Find My Desk v1 app is feature-complete enough to demo but has no automated tests. We need a documented E2E test plan, a runnable suite, and a baseline pass/fail report committed alongside.

## Objective

Produce (a) a Markdown test plan covering every user flow and API endpoint v1 ships with, (b) a Playwright test project that executes the plan against `npm run dev`, and (c) a generated report stored in `test/` showing the v1 baseline.

## App under test — quick reference

- Client: React + Vite (`client/`) on `http://localhost:5173`. Routes: `/` (BookingPage), `/manage` (ManagePage).
- Server: Express (`server/`) on `http://localhost:4000`, proxied as `/api/*` from the client.
- Data: `data/users.json`, `data/desks.json`, runtime `data/bookings.json` (created on first booking).
- Run the whole thing with `npm run install:all && npm run dev` from the repo root.

## In Scope (Build These)

### 1. Test plan document

Create `test/test-plan.md` covering:

**1.1 API contract tests** (one section per endpoint, defined in `server/src/index.js`):
- `GET /api/users` — shape, privacy field, admin field correctness
- `GET /api/users/:id` — 200 + 404
- `PATCH /api/users/:id/privacy` — toggles, persists for the in-memory session
- `GET /api/me` — returns current user
- `POST /api/me` — accepts known id, rejects unknown (400)
- `GET /api/desks?date=...&viewerId=...` — desk shape, `state` ∈ {available, booked, active}, occupant info respects privacy + admin
- `GET /api/bookings?date=&userId=` — filter combinations
- `POST /api/bookings` — happy path, missing fields (400), bad hours (400), overlap (409 + `conflictingBookingId`), unknown desk/user (404)
- `POST /api/bookings/:id/checkin` — flips state to active, 404 if booking missing, 409 if already released/cancelled
- `POST /api/bookings/:id/release` — sets status released + `releasedAt`
- `DELETE /api/bookings/:id` — sets status cancelled
- `GET /api/suggestions?userId=&date=` — teammate-aware path + preference fallback path
- `GET /api/health` — counts match data files

**1.2 BookingPage flows:**
- Date picker changes desk list (polling refresh 4s).
- Floor switch ground ↔ first preserves date.
- Click an available desk → BookingModal opens with desk meta + min-1-hour validation.
- Submit booking → desk turns booked, MyBookings shows new entry, AutoReleaseManager begins watching.
- Conflict path: try to book the same desk same window → modal shows server 409 message.
- Suggestions panel: clicking a suggestion auto-selects desk and jumps to that floor.
- Privacy toggle in the header — booking shows as "Private booking" for non-admin viewers.

**1.3 ManagePage flows:**
- Admin user sees full bookings table + occupancy stats (counts per floor).
- Non-admin sees read-only stub.
- Admin "Force release" button calls `POST /api/bookings/:id/release` and updates the table.

**1.4 AutoReleaseManager sequence:**
- After check-in, the timer enters idle after 30s.
- Idle → prompt1 (15s).
- prompt1 → prompt2 (10s countdown).
- prompt2 expiry → auto-release of the booking.
- Each prompt is dismissible and resets the timer.
- (Use Playwright's `page.clock` API or the test-only time-scaling escape hatch — propose one if not present.)

**1.5 Responsive UI:**
- ≥901px: grid 1fr + 320px sidebar.
- ≤900px: single column.
- Header items remain reachable at 600px.

### 2. Playwright project

- Add `e2e/` at repo root (parallel to `client/`, `server/`).
- `e2e/package.json` with Playwright + `@playwright/test`. Don't pull Playwright into the existing `client/` or `server/` package.
- Add an npm script at the root `package.json`: `"test:e2e": "npm test --prefix e2e"`.
- Use Playwright's webserver config to spawn `npm run dev` and wait for both ports.
- Use a **dedicated test users.json/bookings.json** under `e2e/fixtures/` and copy them into `data/` before the run; restore the originals in a global teardown so live demos aren't disturbed.
- Group tests into `e2e/tests/api.spec.ts`, `e2e/tests/booking.spec.ts`, `e2e/tests/manage.spec.ts`, `e2e/tests/auto-release.spec.ts`, `e2e/tests/responsive.spec.ts`.

### 3. Report generation

- Use Playwright's HTML reporter, plus a small post-run script that converts results into `test/v1-baseline-report.md` with a table of suites + pass/fail counts and links to screenshots/videos.
- Commit the report and a fresh full-page screenshot of `/` (ground floor) and `/manage` (admin view) for the v1 baseline.

## Out of Scope

- Unit tests for individual React components or server functions.
- Performance, load, or accessibility audits beyond keyboard-tab order spot checks.
- CI wiring (GitHub Actions, etc.) — the suite must run locally; CI is a follow-up.
- Visual regression comparisons of the floor-plan PNGs.

## Delivery Instructions

- Keep the test plan and the Playwright code in sync — section headings in `test-plan.md` should map 1:1 to spec files.
- Pre-flight check: before writing tests, confirm the in-memory server state quirks (`currentUserId`, `userPrefs` Map, `bookings` synced to disk) so tests do their own setup and don't depend on prior runs.
- Don't introduce new server endpoints purely for testing — use existing ones plus fixture file swapping.
- Where a Playwright pattern is unfamiliar, prefer the simpler approach and leave a TODO.

## Success Criteria

- `test/test-plan.md` reads like a checklist a new engineer could execute manually if needed.
- `npm run test:e2e` runs from a fresh clone after `npm run install:all` and completes locally.
- `test/v1-baseline-report.md` exists with the date, environment summary, and per-suite results.
- No production code change other than minimal hooks needed to make tests deterministic (e.g. an env-gated `?testClockOffset=` query param if absolutely required; flag any such hook in the report).
