# Fast-Follower Prompt — Additional Features Backlog

Act as a senior full-stack engineer planning incremental enhancements on top of the v1 desk-booking app.

This prompt enumerates every item from `Prompt/Next steps.txt` line 12 onwards. Each item is sized to be picked up as its own self-contained Claude Code session (or grouped into a small handful where dependencies make sense). The intent is that a fresh contributor can open this file and start work on any single item without re-reading the raw notes.

## Objective

Deliver the v1 → v1.x feature pipeline, prioritising items that strengthen the Microsoft/Teams story and the day-to-day booking experience. Implement items in the ordering below unless the team explicitly re-prioritises.

## App context (re-read before any session)

- React + Vite client at `client/`, Express server at `server/`, JSON data at `data/`.
- Key client modules: `BookingPage.jsx`, `ManagePage.jsx`, `FloorPlan.jsx`, `BookingModal.jsx`, `SuggestionsPanel.jsx`, `MyBookings.jsx`, `AutoReleaseManager.jsx`.
- Server endpoints in `server/src/index.js` cover users, me, desks, bookings CRUD + check-in/release, suggestions, privacy, health.
- Data shapes already include `lineManager` on each user, `team`/`platform`/`lab`, `deskPreferences`, `accessibilityNeeds`, `anchorDays`, `defaultWorkingPattern` — re-use rather than duplicate.

## In Scope (Build These — ordered by dependency)

### Foundation (do these first)

1. **Preferences to include accessibility.**
   Extend the user profile UI with editable `accessibilityNeeds` (existing field on `users.json`). Reuse the value when scoring suggestions in `server/src/index.js` `scoreByPrefs` and when rendering desk tooltips in `FloorPlan.jsx`. Add an `accessibility` desk attribute (e.g. `wheelchairAccess`) so matching can happen.

2. **Highlight team members on the map.**
   In `FloorPlan.jsx`, ring or recolour desks occupied by members of the viewer's `team` / `lab` / `platform`. Use a subtle border colour distinct from the existing `available / booked / active` palette. Toggle in the floor-controls legend.

3. **Table view alongside Map booking.**
   Add a tab (or split-pane) inside `BookingPage` that swaps the map for a sortable/filterable table of desks (label, floor, zone, state, attributes, occupant if visible). Reuses the same `desks` array already fetched.


### Delegation & permissions

5. **Delegate booking on behalf of someone else.**
   Add a "Book on behalf of…" picker in the BookingModal (visible only when the current user is allowed to delegate for the selected target). Server enforces the permission rules.

6. **Permission model for delegation (team member / line manager).**
   Permission rules: user can delegate to themselves; line managers can delegate for any direct report (lookup via `users.json` `lineManager.email`); admins can delegate for anyone. Surface a new endpoint `GET /api/users/:id/delegations` that lists who I can book for. Persist permission overrides in the new SQLite store.

### Fallbacks & smart suggestions

7. **No-desk fallback suggestions (hot-desk areas).**
   When `GET /api/suggestions` returns fewer than 3 desks (or none in the user's preferred zones), append hot-desk zone summaries (count of available desks per zone where any desk has `hotDesk: true`). UI: render below the existing suggestion cards.

8. **Meeting-room fallback when team desks unavailable.**
   Introduce `data/rooms.json` with a small set of bookable meeting rooms per floor. Add `GET /api/rooms?date=` and `POST /api/rooms/:id/book`. When suggestions are exhausted, show a "Or grab a meeting room" panel.


11. **AI/agent booking via chat prompts.**
    Add a chat side panel using the Anthropic SDK (`@anthropic-ai/sdk`, model `claude-sonnet-4-6`) with prompt caching enabled. System prompt: "Help the user book a desk. You have tools listDesks, getSuggestions, createBooking." Implement tool-use via the existing API endpoints. Keep the API key behind an env var, never check it in.

### Presence & auto-release evolution

12. **Auto-release based on away/presence simulation.**
    Generalise the client-side `AutoReleaseManager` into a `PresenceSimulator` module fed by a configurable signal source. Mock signal sources (in `client/src/presence/`): monitor-on, AP-connected, Bluetooth-proximity, Intune-managed. Add a debug panel to flip signals on/off during a demo.

13. **Presence signal simulation concepts (monitor/AP/Bluetooth/Intune).**
    Document the four signal sources in `docs/presence-signals.md`: where the real signal would come from in production (Intune device events, Cisco DNA/Meraki AP events, Bluetooth wayfinding, monitor display events), what's required to integrate, and how the simulator maps each. Include a per-signal toggle UX spec. Add this as admin configuration in the main app.

14. **Admin-configurable multi-step re-prompt flow (90 + 20 + 10 min pattern).**
    Move the timer constants out of `AutoReleaseManager.jsx` into `data/config.json`. Add a Manage-page section "Auto-release policy" with editable inputs that PATCH a new endpoint `PATCH /api/config/auto-release`.

### Admin & analytics

16. **Management/admin backend for occupancy insights.**
    Build a new `/manage/insights` route showing daily occupancy by zone, peak hours, hot-desk pickup rate, and average dwell time. Pull from the audit log (use the json as the data source for the demo).

17. **Usage analytics (booked vs actually used).**
    On `/manage/insights`, contrast `bookings.count` with bookings that ever transitioned to `active` (i.e. were checked-in). Highlight ghost-booking ratio. Export as CSV.

### Packaging & rationale

18. **Teams integration as an autoboot.**
    Add a Teams app manifest (`teams-app/manifest.json`) and a placeholder tab configuration that points at the deployed URL. Document the WebView2 packaging path. Do not publish to the Teams store in this fast-follower.


20. **Provide architecture rationale (why language/platform choice aligns with Microsoft/Teams).**
    Create `docs/architecture-rationale.md`: why React + Express, why JSON-then-SQLite, why this fits Teams embedding, where Microsoft Graph would slot in, where ThousandEyes/Intune fit. Two pages max.

### Delivery guardrail

21. **Ask follow-up questions at ~80% plan before final build.**
    For every item above, the implementing session must pause when ~80% of the implementation plan is defined and ask the team targeted follow-ups (e.g. "should hot-desk fallback show zones cross-floor?") before writing code. Capture decisions in the relevant doc.

22. **Admin Configuration**
	For any of the relavant features in this release, create a configuration item for the administrator

## Out of Scope

- Implementing any of the items inside this prompt itself — this is a brief, not code.
- Real Microsoft Graph integration (the Teams story stops at manifest + WebView2 compat for now).
- Real telemetry providers (Cisco Spaces, ThousandEyes) — those live in the Sentient Workplace mockup, not in main app fast-followers.
- Multi-tenant or multi-office data partitioning.

## Delivery Instructions

- Pick one item, branch from `main` as `feat/v1.<n>-<slug>`, open a PR per item.
- Each PR must update or create the relevant test in the Playwright suite (see `Prompt/FastFollower-E2ETestPlan.md`).
- Keep the JSON-to-SQLite migration backwards-compatible: server still reads/writes the same booking shape externally.
- Re-use the existing CSS theme tokens in `client/src/styles.css`; do not introduce a competing design system.

## Success Criteria

- Each item is independently shippable and demoable.
- The audit log captures every booking state change.
- The Manage Insights page shows ghost-booking ratio for any chosen date range.
- An `AI/agent booking` chat session can place a booking end-to-end via tools without manual UI clicks.
- A Teams embedding smoke test (open the app inside the Teams dev tool) renders without layout breakage.
