# REST API

Base path: `/api`. JSON is required for request bodies. Cookies are sent with credentials; all state-changing requests also send `X-CSRF-Token` from `GET /auth/csrf`.

Success:

```json
{"success":true,"data":{"id":12,"name":"Example"},"message":"Route created successfully"}
```

Failure:

```json
{"success":false,"error":{"code":"VALIDATION_ERROR","message":"Please correct the highlighted fields","fields":{"name":"Enter a route name (2–120 characters)."}},"requestId":"..."}
```

List responses add `pagination: {page, limit, total, totalPages}`. `204` responses have no body. Public list query parameters use `q`, `page`, `limit`, and documented filters. Unknown query/body fields are rejected.

## Authentication

| Method | Path | Access | Body / notes |
|---|---|---|---|
| GET | `/auth/csrf` | Public | Establish session and return `{csrfToken}`. |
| POST | `/auth/register` | Public | `{name,email,password}`; always creates `student`. |
| POST | `/auth/login` | Public | `{email,password}`; regenerates session and returns safe user + new CSRF token. |
| POST | `/auth/logout` | Auth | Invalidates the server session; `204`. |
| GET | `/auth/me` | Auth | Safe profile and CSRF token. |

## Routes and stops

| Method | Path | Access | Body / filters |
|---|---|---|---|
| GET | `/routes` | Public | `q,page,limit`; public always active. Admin may use `status`. |
| GET | `/routes/:id` | Public | Route and ordered active stops; admin may see inactive. |
| POST | `/routes` | Admin | `{name,description?,status?}`; initial active is rejected until stops exist. |
| PATCH | `/routes/:id` | Admin | Partial route fields; active requires 2+ active stops. |
| DELETE | `/routes/:id` | Admin | Soft-deactivate route and timetables. |
| PUT | `/routes/:id/stops` | Admin | `{stopIds:[3,8,2]}`; complete atomic replacement. |
| GET | `/stops` | Public | `q,page,limit`; public always active. Admin may use `status`. |
| GET | `/stops/:id` | Public | Stop and serving routes. |
| POST | `/stops` | Admin | `{name,latitude,longitude,status?}`. |
| PATCH | `/stops/:id` | Admin | Partial stop fields. Deactivation also deactivates affected routes. |
| DELETE | `/stops/:id` | Admin | Soft-deactivate; favorites remain. |

## Timetables and departures

`dayOfWeek` uses 0=Sunday through 6=Saturday. `departureTime` is strict `HH:mm` local Africa/Cairo time.

| Method | Path | Access | Body / filters |
|---|---|---|---|
| GET | `/timetables` | Public | `routeId,date,scheduleType,page,limit`; public active/effective records. |
| POST | `/timetables` | Admin | `{routeId,effectiveFrom,effectiveTo,status,scheduleType,departures?:[{stopId,departureTime,dayOfWeek}]}`. |
| PATCH | `/timetables/:id` | Admin | Partial timetable fields. |
| DELETE | `/timetables/:id` | Admin | Soft-deactivate. |
| GET | `/departures/next` | Public | Required `stopId`; optional `routeId,date,count` (1–20). Seven-day horizon. |
| POST | `/timetables/:id/departures` | Admin | `{stopId,departureTime,dayOfWeek}`. |
| PATCH | `/departures/:id` | Admin | Partial departure fields. |
| DELETE | `/departures/:id` | Admin | Permanently remove one departure row. |

## Announcements

Timestamps must be ISO 8601 with an offset. Global notices have both `routeId` and `stopId` null.

| Method | Path | Access | Body / filters |
|---|---|---|---|
| GET | `/announcements` | Public | `routeId,stopId,type,page,limit`; active only. Admin `history=true` includes expired. |
| POST | `/announcements` | Admin | `{routeId?,stopId?,type,message,startsAt,endsAt}`. |
| PATCH | `/announcements/:id` | Admin | Partial fields; scope is revalidated. |
| DELETE | `/announcements/:id` | Admin | Expire immediately and retain history. |

## Favorites, audit, operations

| Method | Path | Access | Body / filters |
|---|---|---|---|
| GET | `/favorites` | Student | Own saved stops, today's remaining departures, and deduplicated notices. |
| POST | `/favorites` | Student | `{stopId}`; user ID comes only from session. |
| DELETE | `/favorites/:stopId` | Student | Removes only the current student's record. |
| GET | `/audit-logs` | Admin | `resource,action,page,limit`; read-only. |
| GET | `/health` | Operational | Minimal DB-backed liveness. No secrets or diagnostics. |

## Status codes

- `200` read/update, `201` create, `204` delete/logout.
- `400` malformed JSON, content type, query/param/body validation.
- `401` missing/expired session, `403` role or CSRF rejection, `404` inaccessible/missing record.
- `409` duplicate/integrity/business conflict, `413` body too large, `429` rate limited.
- `500` safe unexpected error, `503` local storage unavailable.

## Example flow

```bash
# Preserve cookies and obtain CSRF
curl -c cookies.txt http://localhost:4000/api/auth/csrf

# Replace TOKEN with the JSON csrfToken
curl -b cookies.txt -c cookies.txt -H 'content-type: application/json' \
  -H 'x-csrf-token: TOKEN' -d '{"email":"student@example.edu","password":"a-very-long-password"}' \
  http://localhost:4000/api/auth/login

curl -b cookies.txt 'http://localhost:4000/api/departures/next?stopId=1&count=5'
```

The checked-in Postman collection automates CSRF-token capture and uses environment variables for IDs and credentials. It contains no passwords.
