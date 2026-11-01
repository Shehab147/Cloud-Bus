# Implementation progress

Last updated: 2026-10-31

## Phase 0 — audit

- [x] Read the complete implementation specification.
- [x] Audited the repository: no pre-existing application, API, persistence layer, or tests were present.
- [x] Audited the supplied Tailwind v4 CSS template and created `docs/template-style-map.md`.
- [x] Selected the lab stack: React/Vite, Express with local JSON persistence, in-memory server sessions, Leaflet/OpenStreetMap.
- [x] Recorded assumptions and service ownership in the architecture documentation.

## Implementation slices

- [x] Foundation: workspace, environment validation, JSON storage, API conventions, design system and app shell.
- [x] Authentication: student registration, login/logout/me, sessions, CSRF, role guards, UI and tests.
- [x] Routes/stops: public/admin APIs, atomic ordering, search/detail/map UI and tests.
- [x] Timetables/departures/announcements: scheduling rules, admin/public UI and tests.
- [x] Favorites/personalization: ownership-safe API, UI and tests.
- [x] Integration: admin overview, audit viewer, end-to-end route wiring, accessibility states and responsive layouts.
- [x] Security/deployment implementation: application controls, Nginx/systemd/CloudWatch templates, AWS/Cloudflare and restore runbook.
- [x] Evidence/handover: API docs, Postman collection, test matrix, security observations, contribution log, demo script.

External environment verification remains open and is not presented as complete: full browser/manual accessibility matrix, authorized end-to-end/load tests, deployment, TLS/origin-bypass checks, and an actual JSON backup restore drill.

## Assumptions

- Route names and stop names are case-insensitively unique to produce actionable 409 conflicts.
- A route may be created inactive without stops, but it cannot be activated until at least two active ordered stops are assigned.
- Global announcements are allowed when both route and stop are null. If both are supplied, the stop must belong to the route.
- Seasonal timetables override weekday/weekend timetables for the same route and local date. Overlapping active seasonal windows for one route are rejected.
- Next-departure search uses a bounded seven-day horizon and treats displayed times as scheduled estimates.
- Campus schedule time is `Africa/Cairo`; the JSON store uses ISO 8601 absolute timestamps and local `HH:mm` departure values separately.
- Soft deactivation is the default for routes, stops, and timetables; favorites are preserved when a stop becomes inactive.

## Slice summaries

### Foundation

- Files: root workspaces/environment, backend data store/config/middleware, supplied-style wrappers, app shell.
- Rules: strict JSON/100 KB, request IDs, stable errors, safe pagination, unknown-field rejection.
- Verification: strict TypeScript and production build.

### Authentication

- Endpoints: CSRF, register, login, logout, me.
- Rules: students only from public registration; bcrypt cost 12; regenerated in-memory Express sessions; role middleware.
- Verification: CSRF, unauthorized admin, generic-login, malformed-body integration tests.

### Routes and stops

- Endpoints: public/admin route-stop CRUD plus atomic ordered assignment.
- Rules: public active-only, case-insensitive uniqueness, 2-stop activation, soft deactivation, validated coordinates.
- UI: search/pagination/details, accessible list fallback, Leaflet maps/polyline, coordinate picker, admin ordering.

### Schedules and announcements

- Endpoints: timetable/departure CRUD, next departures, announcement CRUD/history.
- Rules: route membership, weekday/weekend convention, seasonal priority/no overlap, seven-day Cairo horizon, scoped active notices.
- Verification: schedule validation/priority and real Cairo DST offset tests.

### Favorites and integration

- Endpoints: session-owned add/list/remove and read-only audit history.
- Rules: unique favorites, inactive favorite preservation, safe audit summaries, no user ID from request.
- UI: personalized departures/notices, admin overview/audit viewer, loading/empty/error/success/busy states.

### Security, deployment, and handover

- Files: Nginx, systemd, CloudWatch template, runbook, API/Postman/test/security/contribution/demo docs.
- Verification: 16 backend tests and 6 frontend tests passed after the storage change; strict type-checks and production builds also passed. Infrastructure-only tests remain explicitly `Not run`.

