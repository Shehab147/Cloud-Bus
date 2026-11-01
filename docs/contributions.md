# Contribution boundaries

| Team member | Primary evidence area | Key paths |
|---|---|---|
| Shehab | Routes, stops, maps, deployment | `backend/src/modules/routes`, `backend/src/modules/stops`, `frontend/src/components/MapView.tsx`, public/admin route-stop pages, `infrastructure/` |
| Aya | Timetables, departures, announcements, local data seed, shared admin layout | `backend/src/modules/timetables`, `backend/src/modules/announcements`, `backend/src/data/`, timetable/announcement admin pages |
| Shaza | Authentication, favorites, monitoring | `backend/src/modules/auth`, `backend/src/modules/favorites`, auth/favorites pages, session/CSRF middleware, `/api/health` |

Shared review areas: validation/error conventions, accessibility, API client/cache invalidation, test matrix, security observations, and release verification. Git history should be used as the authoritative individual contribution record; this file records intended ownership only.
