# Architecture and business assumptions

## Runtime

```text
Browser on http://localhost:5173
  -> React/Vite
  -> /api proxy
  -> Express on http://localhost:4000
  -> backend/data/campus-bus.json
```

The monorepo has two npm workspaces. `frontend` is a React/Vite SPA using the supplied Tailwind v4 template and Leaflet/OpenStreetMap. `backend` is one Express API. Express owns durable application records in a local JSON file and holds sessions in memory.

The storage module caches reads, serializes mutations, clones data before a mutation, and persists a completed mutation by renaming a temporary file. This gives a failed mutation rollback behavior and prevents partially written JSON in one Node process. The design deliberately supports one API process only; it does not provide multi-process locking or horizontal scaling.

## Service ownership boundaries

- Shehab: routes, stops, reusable map, Nginx/deployment.
- Aya: timetables, departures, announcements, local data seed, shared administration layout.
- Shaza: authentication, sessions/CSRF, favorites/personalization, health/monitoring.

These are contribution boundaries, not independently deployed services.

## Scheduling policy

- `day_of_week` uses the JavaScript convention: 0 Sunday through 6 Saturday.
- Departure values represent local wall time in `Africa/Cairo`. Luxon combines the service date and time with that IANA timezone, including daylight-saving rules.
- Search starts at current campus-local time, then scans a bounded seven-day horizon.
- Seasonal schedules win over weekday/weekend schedules for a route/date. Overlapping active seasonal ranges for one route are rejected.
- Cancellations label matching departures. Delay text is informational and does not alter a scheduled time.

## Integrity policy

- User email, route name, and stop name are case-insensitively unique.
- An inactive route may be incomplete; an active route needs at least two active stops.
- Route-stop ordering is replaced inside one serialized mutation after all IDs are validated as unique and active.
- Route, stop, and timetable deletion soft-deactivates records and preserves history/favorites.
- Global notices are allowed. A route+stop notice requires the stop to belong to the route.
- Public reads hide inactive records even when a caller submits `status=inactive`.

## Security boundary

The frontend role only controls navigation; Express middleware is authoritative. Mutations require a session-bound CSRF token, strict Zod schemas reject unknown fields, auth/write rate limits apply in-process, session IDs regenerate on login, and passwords use bcrypt cost 12. Cookies are HttpOnly and SameSite=Lax, and are Secure in production. Because sessions are in memory, an API restart invalidates them.
