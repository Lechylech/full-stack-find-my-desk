# Initial Ask Prompt (MVP Scope)

Act as a senior full-stack engineer.

We are building an initial desk-booking web app for our team in a Microsoft-first environment. This is an MVP to validate fit, not a full production build.

## Objective

Create a skeleton framework for a desk-booking application that demonstrates the core user journey and can be extended later for Teams integration.

## In Scope (Build These)

1. **Skeleton web app structure**
   - Build a responsive web app foundation.
   - Keep architecture compatible with future Teams embedding, but do not complete Teams packaging now.

2. **Expanded `users.json` data**
   - Use `users.json` as the initial database.
   - Add 100 additional realistic mock users.

3. **Three-layer org model**
   - Every user must include:
     - `platform`
     - `lab`
     - `team`

4. **Interactive floor plan**
   - Provide a visual point-and-click desk map.
   - Show desk states: available, booked, active.

5. **Manual booking flow**
   - Allow users to select a desk and book it directly from the map.

6. **Desk attributes**
   - Include desk metadata:
     - Dual Monitor
     - Near Window
     - Quiet Zone
     - Height Adjustable / DSE

7. **Team-nearby suggestions (mocked logic)**
   - Suggest desks near colleagues using mocked org relationship logic based on the dataset.

8. **Privacy toggle (basic)**
   - Add a simple setting to hide booking visibility from other non-admin users.

9. **Simulated auto-release behavior**
   - Implement simulated away/release logic using timers and prompts only.
   - Do not integrate with real external telemetry or device signals.

10. **Visible Manage link**
    - Include a clear **Manage** link in the UI.
    - It can route to a lightweight management view or placeholder page in MVP.

11. **MVP guardrails**
    - Keep implementation deliberately lightweight and modular.
    - Prioritize working flows over full enterprise depth.

## Out of Scope (Do Not Build in MVP)

- Full Microsoft Teams packaging and store-ready deployment.
- Real Microsoft Graph integration.
- Real sensor/telemetry integrations (ThousandEyes, Bluetooth, Intune, monitor events).
- Full enterprise admin suite, complex analytics pipeline, or advanced role/approval workflows.
- Complex AI agent orchestration beyond basic mocked suggestion logic.

## Delivery Instructions

- Build in small, clear steps and keep code easy to extend.
- Use mocked services/adapters where future integrations are expected.
- Provide concise setup/run instructions.
- When the implementation plan is ~80% defined, stop and ask targeted follow-up questions before finalizing.

## Success Criteria

- App runs locally and demonstrates end-to-end desk booking via floor plan.
- `users.json` is expanded with 100 mock users and includes `platform`, `lab`, and `team` on each record.
- Desk states and metadata are visible and usable.
- Basic privacy and simulated auto-release behavior work.
- Manage link is visible and navigable.
