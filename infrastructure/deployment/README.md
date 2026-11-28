# Single-server deployment runbook

Target: Cloudflare proxied DNS/TLS → one Ubuntu server → Nginx → one Express process, the React static build, and MongoDB. Mongo Express is optional and can inspect the same MongoDB collections.

The API uses MongoDB for durable records. Keep one API process until its in-process mutation strategy is redesigned for concurrent writers.

## 1. Server paths

Create a `campus-bus` system user and these protected locations:

- `/var/www/campus-bus/releases` and `/var/www/campus-bus/current` for application releases.
- `/etc/campus-bus/backend.env` owned by root, mode `0600`, for configuration.
- `/var/log/campus-bus` if file-based logs are enabled; journald is sufficient by default.

Back up the MongoDB database before each deployment that changes data behavior.

## 2. Environment

Create `/etc/campus-bus/backend.env`:

```text
NODE_ENV=production
PORT=4000
SESSION_SECRET=AT_LEAST_32_RANDOM_CHARACTERS
APP_ORIGIN=https://a2cloud.online
CAMPUS_TIMEZONE=Africa/Cairo
MONGODB_URI=mongodb://127.0.0.1:27017/mydatabase
TRUST_PROXY=1
LOG_LEVEL=info
TURNSTILE_SECRET=SET_IN_YOUR_SECRET_STORE
TURNSTILE_HOSTNAMES=a2cloud.online
```

Do not store the session secret, Turnstile secret, or admin password in Git. `TURNSTILE_HOSTNAMES` is the comma-separated list of frontend hostnames for this deployment; do not include `localhost` in production. Sessions are intentionally in memory; a service restart signs users out but does not affect saved application records.

## 3. Build and release

Run in CI or a clean release workspace:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Copy the build and required runtime files into a timestamped release. Install production dependencies with the lockfile. For a new installation, use `npm run data:reset` only when intentionally creating demo records; do not run it against a populated production database.

Install the reviewed systemd and Nginx templates, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now campus-bus-api
sudo nginx -t
sudo systemctl reload nginx
curl --fail --silent https://a2cloud.online/api/health
```

The systemd unit does not require a writable application-data directory. The Nginx template serves the SPA, proxies `/api` to `127.0.0.1:4000`, and applies request/security controls.

## 4. Cloudflare and TLS

1. Point the hostname to the server and enable the Cloudflare proxy.
2. Use Full (Strict) TLS and a valid public or Cloudflare Origin certificate.
3. Enable managed WAF rules and appropriate auth/write rate rules.
4. Restrict the server firewall to current Cloudflare HTTPS ranges plus a narrowly controlled maintenance path. Never expose port 4000 publicly.
5. Replace placeholder hostnames and certificate paths in the Nginx template before deployment.

## 5. Backup and restore drill

Back up MongoDB with a consistent database dump:

1. Use `mongodump` to create an encrypted, access-controlled backup and record its checksum.
2. Verify the application health endpoint.

Test restoration before sign-off:

1. Restore a backup to a separate non-production MongoDB database with `mongorestore`.
2. Set `MONGODB_URI` for a non-production test instance to that database.
3. Verify representative route ordering, timetables, favorites, announcements, and audit entries.
4. Record backup ID, checksum, elapsed restore time, recovered timestamp, and verifier.

## 6. Monitoring and rollback

- Stream journald and Nginx logs to the approved monitoring target with retention limits. Application logs redact cookies, authorization headers, and passwords.
- Alert on service restarts, disk space, CPU/memory, Nginx 5xx responses, and backup failure.
- Application rollback: point `current` to the previous retained release and restart the service. Restore the MongoDB backup only if the data format is incompatible.
- After rollback, verify health, login, public routes, a next-departure query, favorites, admin authorization, and logs.

## Troubleshooting

- `503 /api/health`: inspect `journalctl -u campus-bus-api`, confirm that `MONGODB_URI` is correct and MongoDB is reachable.
- Login loop: verify `APP_ORIGIN`, HTTPS, `TRUST_PROXY=1`, cookie behavior, and system clock.
- Deep-link 404: confirm the Nginx SPA fallback is active.
- Wrong departure day/time: verify `CAMPUS_TIMEZONE=Africa/Cairo` and the timetable's 0–6 day convention.
- MongoDB connection failures: verify MongoDB is running, its network access controls permit the API server, and the configured user has database permissions.
