# Campus Bus Tracker

Group 11's campus shuttle timetable and announcement application. It helps visitors, students, and administrators work with published routes, ordered stops, schedules, upcoming departures, favorites, and service notices. It does **not** claim to track live vehicle GPS.

## Stack

- React, TypeScript, Vite, Tailwind CSS, Leaflet, and OpenStreetMap in `frontend/`.
- Express and TypeScript in `backend/`.
- MongoDB for durable application records; Mongo Express can inspect and administer its collections.
- In-memory Express sessions, CSRF protection, bcrypt passwords, rate limits, secure headers, role authorization, request IDs, and Zod validation.

MongoDB is the only durable application-data store. The API keeps a serialized in-process mutation queue so its draft-and-commit operations are applied consistently.

## Run frontend and backend together

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. That one command starts:

- Express API: `http://localhost:4000`
- React frontend: `http://localhost:5173`

Vite proxies browser requests from `/api` to Express. The backend stores records in MongoDB; set `MONGODB_URI` in `.env` or `backend/.env` (for example, `mongodb://127.0.0.1:27017/mydatabase`). Mongo Express can inspect and edit those collections.

To run the servers in separate terminals:

```bash
npm run dev -w backend
```

```bash
npm run dev -w frontend
```

## Demo data and administrator

Reset the configured MongoDB database to the fictional demonstration records:

```bash
npm run data:reset
```

The reset intentionally removes locally registered users and admin accounts. Create or update an administrator without committing credentials:

```bash
read -r ADMIN_EMAIL
read -r ADMIN_NAME
read -rs ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
npm run admin:bootstrap
unset ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Express and Vite together. |
| `npm run dev -w backend` | Start only Express on port 4000. |
| `npm run dev -w frontend` | Start only Vite on port 5173. |
| `npm run data:reset` | Replace MongoDB records with fictional demo records. |
| `npm run admin:bootstrap` | Create or update an admin from environment values. |
| `npm run typecheck` | Strict TypeScript checks for both workspaces. |
| `npm test` | Run backend and frontend automated tests. |
| `npm run build` | Compile the API and build the production SPA. |

## Important behavior

- The MongoDB connection is configured with `MONGODB_URI`. The app uses collections named `users`, `routes`, `stops`, `routeStops`, `timetables`, `departures`, `announcements`, `favorites`, `auditLogs`, and `notificationLogs`.
- Sessions are held in the Express process, so restarting the backend signs users out. Records remain in MongoDB.
- Campus-local schedules use `Africa/Cairo`; absolute timestamps are ISO 8601 values and schedule times are local wall times.
- Next-departure lookup searches seven days. Seasonal schedules override weekday/weekend schedules for the same route and date.
- Route, stop, and timetable deletion endpoints soft-deactivate records. Favorites remain when a stop becomes inactive.
- Route lines connect stops in order and are not road-navigation geometry.

## Documentation

- [Architecture and assumptions](docs/architecture.md)
- [API reference](docs/api.md)
- [Implementation progress](docs/implementation-progress.md)
- [Test case matrix](tests/test-cases.md)
- [Controlled security observations](docs/security-observations.md)
- [Deployment](infrastructure/deployment/README.md)
- [Demonstration script](docs/demo-script.md)
- [Postman collection](postman/Campus_Bus_Tracker.postman_collection.json)

Type-checks, tests, and builds are local and require no external service. Browser accessibility checks, deployment checks, backup restoration, and authorized load testing remain environment-specific verification work.
