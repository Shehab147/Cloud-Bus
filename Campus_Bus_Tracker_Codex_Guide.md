# Campus Bus Tracker — Codex Implementation Specification

> **Purpose:** Implement the entire Group 11 Campus Bus Tracker project, frontend and backend, in working, tested increments. This is an instruction file for Codex, not a description-only proposal. Read the existing repository before changing code. Preserve working code, existing naming conventions, and any already-completed features.

## 1. Product and boundaries

Build a cloud-hosted, responsive campus shuttle information application for **visitors**, **registered students**, and **administrators**. It is a timetable and announcement system, **not GPS-based live bus tracking**. Never imply a bus's physical position is being tracked.

- Visitors: browse active routes, ordered stops, maps, timetables, next departures, and active announcements without signing in.
- Students: all public features, registration/login/logout, save/remove favorite stops, and see personalized upcoming departures and relevant notices.
- Administrators: manage routes, stops, route-stop ordering, timetables, departures, delays/cancellations, and inspect audit logs.
- Out of scope: driver accounts, live vehicle GPS, payments, ticketing, seat booking, external push/SMS/email, multi-campus routing, Kubernetes, and load balancing.
- Project service ownership: **Shehab** — routes/stops/map and deployment; **Aya** — timetables/departures/announcements, database and shared admin layout; **Shaza** — favorites/personalization, authentication and monitoring. Keep service boundaries obvious for contribution evidence.

**Source alignment:** Group 11 Phase 1 proposal. Where details are unspecified below, choose the simplest secure implementation, document the assumption, and keep it consistent across frontend, API, migrations, and tests. Do not silently expand the coursework scope.

## 2. Working rules for Codex

1. Inspect repository, package files, existing schema, routes, and environment first. Summarize what exists and identify missing pieces.
2. Implement complete vertical slices: database migration → backend validation/business logic → REST endpoint → frontend API client → page/forms/states → tests. Never leave a decorative or nonfunctional button.
3. Make the smallest understandable changes. Favor explicit functions and readable files over complex abstractions. Explain important business logic with concise comments.
4. Keep a checklist of completed work and outstanding tasks in `docs/implementation-progress.md`. Update it after each slice.
5. Run applicable lint, type-check, build, unit, integration and security tests. Fix failures; do not claim tests passed unless executed.
6. Never fake API data, successful mutations, authentication, or deployment status. Seeded demo data must be explicitly identified as demo data.
7. Ask for missing credentials or deployment access only when actually needed. Never commit secrets.
8. Use explicit transactions for multi-table writes, consistent error responses, safe pagination, and database constraints.
9. Preserve the requested scope; do not introduce unnecessary dependencies, microservices, AI, or advanced infrastructure.
10. Produce a short implementation summary after each slice: files changed, endpoints added, validation rules, tests run, unresolved issues.

## 3. Technology and repository

**Preferred stack matching the proposal:** React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Lucide icons, React Router, TanStack Query, React Hook Form + Zod; Node.js + Express + TypeScript REST API; PostgreSQL using `pg` with parameterized queries; server-side sessions in PostgreSQL; Jest + Supertest for API tests and React Testing Library for frontend tests. Leaflet + OpenStreetMap for maps. If the repo already uses Next.js, adapt the UI there instead of migrating needlessly. Confirm the chosen libraries are permitted by the course instructor, as required by the proposal.

Suggested layout:

```text
campus-bus-tracker/
  frontend/
    src/app/                 # router, providers, app shell
    src/components/ui/       # shadcn primitives
    src/components/shared/   # page header, dialogs, states, map
    src/features/routes/     # public + admin routes
    src/features/stops/
    src/features/timetables/
    src/features/announcements/
    src/features/favorites/
    src/features/auth/
    src/lib/api.ts           # typed fetch, credentials, errors
  backend/
    src/app.ts               # Express setup and middleware
    src/server.ts
    src/config/
    src/db/
    src/middleware/          # auth, roles, csrf, validation, errors
    src/modules/auth/
    src/modules/routes/
    src/modules/stops/
    src/modules/timetables/
    src/modules/departures/
    src/modules/announcements/
    src/modules/favorites/
    src/modules/audit/
    src/utils/
  database/migrations/
  database/seeds/
  infrastructure/nginx/
  infrastructure/deployment/
  tests/
  docs/
  .env.example
  README.md
```

Each backend module should have straightforward `routes.ts`, `controller.ts`, `service.ts`, `repository.ts`, and `schema.ts` where helpful. Controller handles HTTP; service handles rules; repository handles SQL. Do not create empty layers solely for architecture aesthetics.

## 4. UI design system — mandatory

**Design philosophy:** UI design must be simple, elegant, and productive. Things should look minimal at first glance, with richer details at closer look. It must feel professionally designed, never like a beginner project. **Priorities: bug-free → clean → elegant.** Reference the Developers Hub underline-tab design. Smooth, short transitions on interactive elements; never make the UI feel laggy. Support light/dark themes, responsive widths, keyboard access, visible focus rings, reduced-motion preference, and readable contrast.

- **Page structure:** `space-y-4`; title `text-2xl font-semibold tracking-tight`; subtitle `text-base text-muted-foreground`. Consistent content max-width and spacing.
- **Cards:** shadcn `Card` with `overflow-hidden`; header `px-5 py-5 sm:px-6`, icon tile `rounded-lg bg-muted p-2.5` with `h-5 w-5` icon in `text-primary` or `text-foreground`; `CardTitle className="text-base"`; one-line `CardDescription`; content `space-y-4 p-5 sm:p-6`.
- **Surfaces:** `rounded-lg border border-border/60 bg-muted/20` or `bg-card`; internal divisions `divide-y divide-border/50`. Avoid heavy borders and shadows.
- **Tabs:** underline tabs on `border-b-2 border-border/60`; triggers `px-5 py-2.5 text-base font-medium rounded-none`; active `text-primary` with 2px primary underline; inactive `text-muted-foreground hover:bg-muted/60`; content `mt-4`.
- **Lists:** `rounded-lg border border-border/60 overflow-hidden`; row `px-5 py-4 bg-muted/20 hover:bg-muted/40 transition-colors`; primary `text-base font-medium truncate`; secondary `text-sm text-muted-foreground`; ghost icon actions `p-1.5 text-muted-foreground/40` turning primary for view or destructive for delete on hover.
- **Forms:** `bg-muted/20` panel; labels `text-sm font-medium text-muted-foreground`; hints `text-xs text-muted-foreground/70`. If bulk input is applicable, use `font-mono text-sm` textarea and footer `border-t border-border/60 px-5 py-3` with hint left and primary small action right. Expand optional forms using `grid transition-all duration-300 ease-out`, without clipping focused content. Uploads, if needed, use dashed drop zones and accepted-format hint.
- **Capacity tiles:** `rounded-lg border px-4 py-2.5`, muted `text-xs` label and `text-sm font-semibold tabular-nums` value; at limit use `border-destructive/20 bg-destructive/5 text-destructive`. Do not invent quota limits for this project.
- **Alerts:** `role="status"`, `rounded-lg border border-destructive/20 bg-destructive/5 p-4`, small icon, `text-sm font-semibold` title, and helpful `text-sm text-muted-foreground` resolution text. Use proper `role="alert"` for urgent errors.
- **How it works:** `rounded-lg border border-border/60 bg-card`, 3 steps using `md:grid-cols-3`, desktop dividers, `h-8 w-8 rounded-md bg-primary/10 text-primary` tiles, `text-xs` step label, `text-sm font-semibold` title, `text-xs` description.
- **Loading:** restrained spinner + `Loading…`, skeletons where appropriate; never flash blank screens. **Empty:** subtle faded icon and friendly actionable message. **Busy buttons:** spinner and specific labels such as `Saving…` or `Adding…`; prevent double submission.
- **Pagination:** muted `text-sm` count left, outline Previous/Next with chevrons right, disabled at boundaries.
- **Previews:** `Dialog` with `p-0 overflow-hidden`; black media stage only for actual media previews, metadata below in `p-5`. For route/stop details, use an accessible map/detail dialog instead of forcing a black stage.
- Avoid excessive icons, gradients, uppercase text, motion, and decorative dashboards. Use icons only when they communicate an action or status. Use ~150–250ms transitions; respect `prefers-reduced-motion`.
- Every form needs inline field errors, retained input after failure, clear success feedback, cancel/reset, unsaved-changes handling where relevant, and mobile usability. Do not use browser `alert()` for normal application feedback.

## 5. Pages and navigation

| Route | Audience | Required functionality |
|---|---|---|
| `/` | Public | Product overview, upcoming service information, links to routes, schedules, login; avoid fake real-time data |
| `/routes` | Public | Search, status-aware route list, loading/empty/error states, pagination |
| `/routes/:id` | Public | Route name/description, ordered stops, map polyline, schedules and notices relevant to route |
| `/stops` | Public | Search stops, map/list switch, coordinates, routes serving stop, next departures |
| `/stops/:id` | Public | Stop detail, associated routes, next departures, favorite toggle for students |
| `/timetables` | Public | Filter route/date, weekday/weekend/seasonal schedule, upcoming departures, active notices |
| `/announcements` | Public | Active delay/cancellation/info notices with dates and affected stops/routes |
| `/login`, `/register` | Public | Validated forms, safe redirects, generic auth errors |
| `/favorites` | Student | Saved stops, search/add/remove, next departures and relevant notices |
| `/admin` | Admin | Compact overview of routes, stops, schedules and active announcements |
| `/admin/routes` | Admin | CRUD, activate/deactivate, route-stop reorder |
| `/admin/stops` | Admin | CRUD, map coordinate picker, affected-route warnings |
| `/admin/timetables` | Admin | Manage effective dates, weekdays, departure rows and status |
| `/admin/announcements` | Admin | Create/edit/expire/cancel notices |
| `/admin/audit-logs` | Admin | Read-only filtered/paginated audit history |
| `*` | All | Helpful 404 page |

Navigation must adapt to role but **backend authorization is authoritative**. Public views must exclude inactive records unless admin requests them. Make deep links and browser refresh work via Nginx SPA fallback.

## 6. Database schema and integrity

Create numbered, reversible where feasible, SQL migrations with primary keys, timestamps, appropriate foreign keys and indexes:

- `users(id, name, email UNIQUE, password_hash, role CHECK(student/admin), created_at)`.
- `sessions`: server-side session store with expiry, indexed expiration, and invalidation on logout.
- `routes(id, name, description, status, created_at, updated_at)`; define status as active/inactive.
- `stops(id, name, latitude, longitude, status, created_at, updated_at)`; latitude between -90 and 90, longitude between -180 and 180.
- `route_stops(id, route_id, stop_id, stop_order)` with `UNIQUE(route_id, stop_order)` and `UNIQUE(route_id, stop_id)`; foreign keys and stable ordering.
- `timetables(id, route_id, effective_from, effective_to, status, schedule_type)`; types weekday/weekend/seasonal, date interval valid.
- `departures(id, timetable_id, stop_id, departure_time, day_of_week)`; enforce day-of-week convention (0=Sunday through 6=Saturday) and time format; departure stop must belong to the timetable route, checked transactionally in service logic.
- `announcements(id, route_id NULL, stop_id NULL, type, message, starts_at, ends_at, created_at, updated_at)`; type delay/cancellation/info; enforce valid time range; define whether global notices are allowed and how route/stop scope is resolved.
- `favorites(id, user_id, stop_id, created_at)` with `UNIQUE(user_id, stop_id)`.
- `audit_logs(id, user_id, action, resource, resource_id, metadata, timestamp)`; never include credentials or session tokens.

Use UTC timestamps in storage and `Africa/Cairo` as the explicit campus display/scheduling timezone. For departure times use local `TIME` + effective dates and day-of-week; document daylight-saving behavior and test DST boundaries. Add indexes for search, route-stop ordering, timetable date filtering, departures by stop, active announcements, and favorites by user. Choose clear `ON DELETE` policies: prefer soft-deactivation of routes/stops referenced by schedules or favorites; prevent destructive deletes that would corrupt dependent records. Route-stop reorder must be atomic and validate unique stop IDs and positions. Do not silently cascade-delete students' favorites.

Provide demo seeds with clearly fictional routes/stops/schedules and a separate secure admin bootstrap command. No known default admin password in Git. Idempotent seed and migration commands.

## 7. API conventions

Base path `/api`. All responses JSON except `204 No Content`. Use predictable shapes:

```json
{"success":true,"data":{"id":12,"name":"Example"},"message":"Route created successfully"}
```

```json
{"success":false,"error":{"code":"VALIDATION_ERROR","message":"Please correct the highlighted fields","fields":{"name":"Route name is required","latitude":"Latitude must be between -90 and 90"}},"requestId":"..."}
```

List response: `{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }`. Validation uses stable field names that frontend maps to inputs. Never return SQL messages, stack traces, hashes or internal details. Consistent HTTP codes: 200 read/update, 201 create, 204 delete/logout, 400 malformed/validation, 401 unauthenticated, 403 unauthorized, 404 missing/inaccessible, 409 duplicate/conflict, 413 oversized payload, 429 rate limited, 500 unexpected failure, 503 unavailable dependency. If a session is expired, return 401 and guide the user to log in again. Use request IDs and server-side logs.

**Endpoints from the proposal:**

| Method | Endpoint | Access | Behavior |
|---|---|---|---|
| POST | `/auth/register` | Public | Create student only |
| POST | `/auth/login` | Public | Authenticate and establish session |
| POST | `/auth/logout` | Auth | Invalidate session; 204 |
| GET | `/auth/me` | Auth | Current safe user profile (supporting endpoint) |
| GET | `/routes` | Public | Search/filter/paginate active routes |
| GET | `/routes/:id` | Public | Route details and ordered stops |
| POST | `/routes` | Admin | Create route |
| PATCH | `/routes/:id` | Admin | Edit or change status |
| DELETE | `/routes/:id` | Admin | Soft-deactivate by default; 204 |
| PUT | `/routes/:id/stops` | Admin | Atomic ordered stop assignments (supporting endpoint) |
| GET | `/stops` | Public | Search/filter/paginate stops |
| GET | `/stops/:id` | Public | Stop details (supporting endpoint) |
| POST | `/stops` | Admin | Create stop |
| PATCH | `/stops/:id` | Admin | Edit stop |
| DELETE | `/stops/:id` | Admin | Deactivate safely; 204 |
| GET | `/timetables` | Public | Filter by route/date, active/effective schedules |
| POST | `/timetables` | Admin | Create timetable and optional departure rows transactionally |
| PATCH | `/timetables/:id` | Admin | Edit timetable |
| DELETE | `/timetables/:id` | Admin | Deactivate/delete safely; 204 |
| GET | `/departures/next` | Public | Next departures for a stop and optional route/date/count |
| POST | `/timetables/:id/departures` | Admin | Add departure (supporting endpoint) |
| PATCH | `/departures/:id` | Admin | Edit departure (supporting endpoint) |
| DELETE | `/departures/:id` | Admin | Delete departure (supporting endpoint) |
| GET | `/announcements` | Public | Active relevant notices |
| POST | `/announcements` | Admin | Publish notice |
| PATCH | `/announcements/:id` | Admin | Edit/expire notice (supporting endpoint) |
| DELETE | `/announcements/:id` | Admin | Remove/expire notice (supporting endpoint) |
| GET | `/favorites` | Student | Own stops, departures and relevant notices |
| POST | `/favorites` | Student | Add stop to own favorites |
| DELETE | `/favorites/:stopId` | Student | Remove own favorite |
| GET | `/audit-logs` | Admin | Read-only paginated audit logs (supporting endpoint) |
| GET | `/health` | Operational | Minimal liveness, no secret diagnostics |

All paths above are relative to `/api`. The extra endpoints are implementation necessities, not changes to the three core services. Document them in `docs/api.md` and a Postman collection. Use `?q=`, `?page=`, `?limit=`, `?status=` consistently. Whitelist sort fields and filter values. Never accept a `user_id` from a favorites request; derive it from the session.

## 8. Field validation and sanitization

**One source of truth per endpoint:** Zod schemas on backend. Frontend may share the same schema package or mirror it for immediate feedback, but backend always revalidates. Return field errors in the API shape above. Normalize input carefully, do not indiscriminately HTML-escape data before database storage (React escapes rendered text). Use parameterized SQL, safe rendering, and no raw HTML injection.

| Field | Validation | User-facing feedback |
|---|---|---|
| Name (user) | Trim; 2–100 chars; reject empty/control chars | `Enter your name (2–100 characters).` |
| Email | Trim/lowercase; valid email; max 254 chars; unique | `Enter a valid email address.` / `This email is already registered.` |
| Password | 12–128 chars; hash with Argon2id or bcrypt; never trim silently | `Use at least 12 characters.` |
| Route name | Trim; 2–120 chars; uniqueness policy documented | `Enter a route name (2–120 characters).` |
| Route description | Optional; trim; max 1000 chars | `Description must be 1000 characters or less.` |
| Stop name | Trim; 2–120 chars | `Enter a stop name (2–120 characters).` |
| Latitude/longitude | Required finite numbers in valid ranges; reject NaN and strings with junk | `Enter valid map coordinates.` |
| Route stop IDs | Nonempty ordered list; existing active stops; no duplicates | `Select at least one valid stop without duplicates.` |
| Status | Only documented enum values | `Choose a valid status.` |
| Timetable dates | Strict ISO dates, start <= end, valid effective period | `End date must not be before start date.` |
| Schedule type | `weekday`, `weekend`, `seasonal` | `Select a timetable type.` |
| Departure time | Strict `HH:mm` 24-hour local time | `Enter a valid departure time.` |
| Day of week | Integer 0–6; validate consistency with schedule type | `Choose a valid day of the week.` |
| Announcement type | `delay`, `cancellation`, `info` | `Choose a valid announcement type.` |
| Announcement message | Trim; 5–1000 chars; plain text | `Enter a message (5–1000 characters).` |
| Announcement period | Valid timezone-aware timestamps; starts < ends | `End time must be after start time.` |
| Favorite stop ID | Valid positive integer; existing active stop; unique per user | `Stop not found.` / `This stop is already in favorites.` |
| IDs / pagination | Positive safe integers; page >=1; limit 1–100 | `Invalid page or record identifier.` |
| Search | Trim; max 100 chars; safely parameterized; debounce client-side | `Search must be 100 characters or less.` |

Reject unknown mutation fields rather than silently persisting them. Validate query params, URL params and JSON bodies. Limit JSON body size; reject invalid content types. Use accessible inline error text and `aria-describedby`; focus the first invalid field. Keep server messages concise and actionable.

## 9. Core business logic and edge cases

### Routes and stops

- Show stops in `stop_order` ascending; map marker popups include stop name and a link to details.
- Route creation may start without stops only if UI clearly labels it incomplete; route cannot be publicly active until it has a valid stop sequence (choose and document policy).
- On reorder, validate every ID and use a transaction to avoid unique-order collisions; rollback on error.
- Deactivating a stop or route must immediately remove it from public results and prevent it being newly favorited or scheduled; admin sees status and dependency warning.
- Search should handle case differences, whitespace, no matches, punctuation, and pagination. Return 404 for nonexistent IDs; no accidental leakage of inactive data.
- Duplicate names and near-duplicate stops: choose a clear policy, use DB constraints where possible, and show 409 conflicts rather than a generic 500.

### Timetables and next departures

- For a given stop, find eligible **active** route, stop, timetable and departure rows for the requested campus-local date/time. Respect effective date range, day of week, schedule type, and seasonal overrides.
- Define priority when seasonal and ordinary schedules overlap: seasonal overrides ordinary for the same route and effective date. Prevent ambiguous overlapping seasonal schedules or reject conflicts at write time.
- Sort upcoming departures chronologically. Search forward into the next days as necessary, with a documented bounded horizon (e.g., 7 days), and show a clear empty state beyond the horizon.
- Treat departures as scheduled estimates. A `delay` announcement does not alter time automatically unless an explicit structured delay-minutes field is introduced with matching migration/API/UI/tests. A cancellation must clearly mark or exclude affected departures; show the reason where available. Do not claim a bus is on time based only on schedule data.
- Validate departures belong to stops on the timetable's route. Reject orphaned stops, conflicting rows, inactive routes, invalid date/time, and invalid timetable windows.
- Use campus timezone explicitly; test midnight crossover, Sunday/Monday transitions, end dates, seasonal overlap, daylight saving changes, no timetable, and expired timetable.

### Announcements

- Active when `starts_at <= now < ends_at`; expired announcements disappear from public active listings but remain accessible to admin history.
- Scope to route, stop, or global only if explicitly allowed. Reject inconsistent stop/route pairs.
- Differentiate delay, cancellation and information visually using text labels and restrained colors; never depend on color alone.
- A student with multiple saved stops should not see duplicate announcements.

### Favorites

- Require a student session; use authenticated `user.id` only. Admin access to student favorites is not implicit.
- Duplicate favorite returns 409 and a friendly message; concurrent adds must be protected by database unique constraint.
- Removing a favorite must target only the authenticated student's record; attempts to remove another user's favorite must not succeed.
- Favorite lists survive logout/relogin and browser refresh. Each card shows stop name, relevant next departures, route, and notices; if none, explain why and offer a link to schedules.
- Handle stale favorites when a stop becomes inactive: preserve integrity, label unavailable or omit from public results with an explanatory state; do not silently delete data.

## 10. Authentication, security and audit

- Public registration always creates `student`; no public admin registration or role override. Seed/bootstrap admin securely.
- Hash passwords securely; use constant-time verification where applicable. Generic invalid-login response prevents account enumeration.
- Store sessions server-side in PostgreSQL; session cookie `HttpOnly`, `Secure` in production, `SameSite=Lax` or stricter, scoped path, appropriate expiry. Regenerate session on login; invalidate on logout; clean expired sessions.
- Enforce CSRF protection for cookie-authenticated state-changing requests (token or verified same-origin strategy with appropriate headers); test it. Configure trusted proxy carefully behind Cloudflare/Nginx.
- `requireAuth`, `requireStudent`, `requireAdmin` middleware; never trust frontend role flags. Audit admin writes with actor, action, resource, timestamp, and safe before/after summaries.
- Helmet/security headers, strict allowed-origin CORS (or same-origin deployment), safe rate limits for auth and writes, request size caps, parameterized SQL, structured errors, and safe logs. No sensitive values in client bundles, URLs, audit metadata, or logs.
- Protect against SQL injection, XSS, CSRF, IDOR, brute force, session fixation, privilege escalation, and mass assignment. Ensure security works even if Cloudflare WAF is bypassed.
- Never rely on the WAF alone; block direct-origin access via security groups/firewall and Cloudflare IP allowlisting for HTTPS, with a carefully restricted maintenance access path.

## 11. Maps integration

**Default: Leaflet + OpenStreetMap** as documented in the proposal. Use the public OSM tile service responsibly: visible attribution, no bulk tile prefetching, and compliance with usage policy. Use client-only loading where SSR requires it. Reuse one typed map component across routes, stops and favorites. Support marker popups, fit-to-bounds, route stop-order polyline (a straight connection of stop coordinates, **not actual road navigation**), marker selection, and graceful tile/network failure. Validate all coordinates before rendering; no map should crash because of malformed data. Provide a list alternative for accessibility.

**Optional Google Maps adapter:** Only switch after explicit instructor/project approval because it differs from the proposal. Use `VITE_GOOGLE_MAPS_API_KEY` for a browser key if React/Vite is selected, restrict it by exact allowed HTTP referrers and Google Maps APIs, enforce billing quotas, and document any cost. A browser maps key is public by design, **not a backend secret**. Never paste the user-provided key into source, docs, screenshots or `.env.example`. Since the key was shared in chat, recommend rotating/restricting it before use. Keep a separate backend key only if server-side Maps APIs are genuinely needed; do not expose that key to the browser.

## 12. Frontend behavior and request lifecycle

- Central `apiClient` with `credentials: 'include'`, JSON parsing, typed error handling, request timeout/abort, and `AbortController` for stale searches. Never retry non-idempotent mutations automatically.
- Use TanStack Query cache keys for list filters and entity IDs. Invalidate relevant caches after successful writes: routes, stops, timetables, departures, announcements, favorites and admin summaries as appropriate.
- Debounce searches (~250–350ms); preserve filters in URL query parameters. Cancel stale requests when filters change.
- Distinguish initial loading, background refresh, empty result, validation failure, 401, 403, 404, 409, 429, offline, timeout, and 500. Offer Retry only where appropriate.
- On 401, clear client auth state and show a friendly login prompt; preserve safe intended destination. On 403, show an access-denied page; never redirect in an infinite loop.
- Disable submit during mutation and display progressive label. Keep entered values and server field errors on failure. Confirm destructive actions and explain dependencies. For optimistic favorite toggles, rollback on failure and prevent rapid duplicate clicks.
- Do not show fake data while API loads. Use accessible toast/status messages for successful operations and specific error feedback for failures.
- Use semantic headings, real labels, keyboard-operable dialogs, focus restoration, sensible tab order, touch-friendly targets and accessible map fallback.

## 13. Cloud deployment and operations

Target architecture: browser → custom domain → Cloudflare proxied DNS/WAF/TLS → Nginx on AWS EC2 → React static build + reverse-proxied Express API → PostgreSQL on private AWS RDS (or documented EC2-local fallback). Logs/metrics via CloudWatch where configured. Avoid unnecessary load balancers and multi-server infrastructure.

- Ubuntu EC2 with least-privilege IAM role; SSH restricted to approved IPs or use SSM; only required ports exposed.
- Nginx serves frontend and proxies `/api` to localhost Node service; enable SPA fallback, secure headers, request size limits, and proper forwarded IP handling.
- Cloudflare Full (Strict) TLS with valid origin certificate; never use Flexible SSL. Configure WAF and rate limits, particularly auth paths.
- PostgreSQL private network access only from application; DB credentials from environment or AWS Parameter Store, never Git.
- Use systemd or PM2 with startup recovery; structured app and Nginx logs, CloudWatch alarms, health checks and documented restart steps.
- Automated DB backups/snapshots, tested restoration, migrations before release, and a rollback plan. Configure AWS Budgets alerts and document costs/credit assumptions.
- Include `.env.example` with placeholders only: `NODE_ENV`, `PORT`, `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN`, `CAMPUS_TIMEZONE=Africa/Cairo`, optional `VITE_GOOGLE_MAPS_API_KEY`, and relevant CloudWatch settings.
- Provide `infrastructure/deployment/README.md` with local setup, production deployment, DNS, Cloudflare, Nginx, database migrations, health check, backup/restore and troubleshooting.

## 14. Test plan and acceptance criteria

For each feature, test: **functional, unit, integration, regression, security, negative, UI/UX, role/permissions, input validation, error handling**, and **performance/load where applicable**. Maintain cases in `tests/test-cases.md` with columns:

`Test Case ID | Related Task | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Notes`

Minimum automated coverage:

1. Public route/stop search, ordered stop detail, map coordinate validity, inactive filtering, pagination.
2. Admin route/stop create/update/deactivate, duplicate conflicts, reorder transaction rollback, missing IDs.
3. Timetable weekday/weekend/seasonal eligibility, next departure calculations, date boundaries, timezone and DST, expired/inactive records.
4. Announcement activation/expiry, scoped notices, cancellation behavior and duplicate suppression.
5. Favorites add/list/remove, unique constraint, persistence, cross-user IDOR attempts, inactive stops.
6. Registration/login/logout, wrong credentials, rate limiting, session expiry, CSRF, unauthorized/forbidden admin access.
7. SQLi/XSS payloads, oversized bodies, malformed JSON, invalid types, unexpected fields, concurrency and database unavailability.
8. Full user flow: admin creates route → adds ordered stops → adds timetable/departures → student registers → saves stop → sees next departure → admin publishes delay/cancellation → student sees update.
9. Frontend responsive layout, keyboard navigation, form validation, slow network, API failures, empty states, dark mode, reduced motion.
10. Deployment smoke tests, origin bypass controls, TLS, logs, backup and **actual restore test**.

Include Postman collection and example requests/responses. Record at least eight controlled security findings or test observations with evidence for coursework; do not fabricate vulnerabilities or results. Never run intrusive security testing against infrastructure without authorization.

**Definition of done for each slice:** migration applies; endpoint has authorization and validation; frontend uses real API; all relevant loading/empty/error/success states work; tests pass; documentation updated; no credentials committed; mobile and keyboard usage verified.

## 15. Execution order for Codex

- [ ] **Phase 0 — Audit:** inspect repository and proposal, choose permitted stack, establish implementation checklist, identify existing code to preserve.
- [ ] **Phase 1 — Foundation:** initialize monorepo structure, env examples, PostgreSQL connection, migrations, common API errors, shared validation, frontend design system and layout.
- [ ] **Phase 2 — Authentication:** register/login/logout/me, secure sessions, role middleware, CSRF, login/register UI, tests.
- [ ] **Phase 3 — Service 1:** routes and stops schema/API/admin CRUD, ordered route-stop assignment, public browse/search/details, Leaflet map, tests.
- [ ] **Phase 4 — Service 2:** timetables/departures schema/API, date and seasonal logic, admin forms, next departures UI, announcements, tests.
- [ ] **Phase 5 — Service 3:** favorites schema/API, saved-stop UI, personalized upcoming departures and notices, ownership tests.
- [ ] **Phase 6 — Integration:** admin overview, audit log viewer, end-to-end workflows, edge cases, accessibility and responsive QA.
- [ ] **Phase 7 — Security and deployment:** Cloudflare, AWS EC2, Nginx, PostgreSQL/RDS, monitoring, backups, deployment docs and smoke tests.
- [ ] **Phase 8 — Evidence and handover:** Postman collection, test case matrix, security observations, architecture docs, contribution log, final README and demo script.

**Start immediately with Phase 0 and Phase 1, then continue sequentially in manageable working increments.** Do not replace the implementation with a plan-only response. If blocked by credentials or external provisioning, implement and test all local functionality first, clearly record the blocker, and request only the missing information.

---

## Mandatory: Existing CSS Template First

The developer will add a CSS template to this repository. **Its existing CSS classes are the authoritative styling system**. This requirement supersedes earlier recommendations for Tailwind/shadcn classes whenever they conflict with the template.

1. Before writing or changing frontend UI, locate and read the provided CSS files, any supporting assets, and template examples. Do not assume class names or invent them.
2. Create `docs/template-style-map.md` mapping actual template classes to layout, typography, cards, buttons, inputs, tables, tabs, navigation, dialogs, alerts, pagination, loading states, and responsive utilities. Document classes that are unavailable.
3. Use existing classes directly in React `className` attributes. Build reusable React wrappers around the template's styles without copying its CSS rules.
4. Keep the template CSS intact whenever possible. If a necessary style is missing, add the smallest scoped override to a separate `custom.css`, with a comment explaining why; avoid `!important`, inline styles, duplicate definitions, and introducing another styling framework.
5. If template JavaScript depends on direct DOM manipulation or jQuery, do not blindly run it inside React. Reimplement its behavior using React state and accessible components while retaining the existing template CSS classes.
6. Preserve responsive behavior, keyboard navigation, focus indicators, reduced-motion preferences, and smooth but lightweight transitions. Avoid layout shifts and lag.
7. Connect every styled control to real frontend state and backend endpoints. Render API field-validation errors under their corresponding inputs; implement loading, empty, success, error, and disabled states.
8. Do not invent a new visual system. If a prior design instruction specifies a shadcn/Tailwind class absent from the template, reproduce the intended clean, professional UX with available template classes rather than installing a new framework.
9. For each page, verify that the classes used actually exist, check mobile and desktop layout, and test its working interactions.

**Styling precedence:** Provided CSS template → existing compatible template assets/components → reusable React components using template classes → minimal scoped custom CSS only where necessary.

**Codex first action:** Inspect the template, produce the style map, and only then implement or restyle frontend pages. If the template has not yet been supplied, complete backend or planning work first and wait before finalizing the frontend styling.
