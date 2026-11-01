# Single-server deployment runbook

Target: Cloudflare proxied DNS/TLS → one Ubuntu server → Nginx → one Express process and the React static build. Express persists records in one local JSON file. There is no Docker or external database.

This storage model must run as one API process. Do not use Node cluster mode, PM2 multi-instance mode, multiple containers, or shared-network filesystem writers.

## 1. Server paths

Create a `campus-bus` system user and these protected locations:

- `/var/www/campus-bus/releases` and `/var/www/campus-bus/current` for application releases.
- `/var/lib/campus-bus` owned by `campus-bus`, mode `0700`, for the data file.
- `/etc/campus-bus/backend.env` owned by root, mode `0600`, for configuration.
- `/var/log/campus-bus` if file-based logs are enabled; journald is sufficient by default.

Back up `/var/lib/campus-bus/campus-bus.json` before each deployment that changes data behavior.

## 2. Environment

Create `/etc/campus-bus/backend.env`:

```text
NODE_ENV=production
PORT=4000
SESSION_SECRET=AT_LEAST_32_RANDOM_CHARACTERS
APP_ORIGIN=https://bus.example.edu
CAMPUS_TIMEZONE=Africa/Cairo
DATA_FILE=/var/lib/campus-bus/campus-bus.json
TRUST_PROXY=1
LOG_LEVEL=info
```

Do not store the session secret or admin password in Git. Sessions are intentionally in memory; a service restart signs users out but does not affect saved application records.

## 3. Build and release

Run in CI or a clean release workspace:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Copy the build and required runtime files into a timestamped release. Install production dependencies with the lockfile. For a new installation, starting Express creates the demo data file automatically. Do not run `data:reset` against a populated production file.

Install the reviewed systemd and Nginx templates, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now campus-bus-api
sudo nginx -t
sudo systemctl reload nginx
curl --fail --silent https://bus.example.edu/api/health
```

The systemd unit grants the service write access to `/var/lib/campus-bus`. The Nginx template serves the SPA, proxies `/api` to `127.0.0.1:4000`, and applies request/security controls.

## 4. Cloudflare and TLS

1. Point the hostname to the server and enable the Cloudflare proxy.
2. Use Full (Strict) TLS and a valid public or Cloudflare Origin certificate.
3. Enable managed WAF rules and appropriate auth/write rate rules.
4. Restrict the server firewall to current Cloudflare HTTPS ranges plus a narrowly controlled maintenance path. Never expose port 4000 publicly.
5. Replace placeholder hostnames and certificate paths in the Nginx template before deployment.

## 5. Backup and restore drill

Back up the data file only after making a consistent copy. The simplest safe procedure for this coursework deployment is a short maintenance window:

1. Stop `campus-bus-api` so no write is in progress.
2. Copy `/var/lib/campus-bus/campus-bus.json` to encrypted, access-controlled durable storage and record its checksum.
3. Restart the service and verify `/api/health`.

Test restoration before sign-off:

1. Restore a backup to a separate protected path.
2. Set `DATA_FILE` for a non-production test instance to that restored path.
3. Verify representative route ordering, timetables, favorites, announcements, and audit entries.
4. Record backup ID, checksum, elapsed restore time, recovered timestamp, and verifier.

## 6. Monitoring and rollback

- Stream journald and Nginx logs to the approved monitoring target with retention limits. Application logs redact cookies, authorization headers, and passwords.
- Alert on service restarts, disk space, CPU/memory, Nginx 5xx responses, and backup failure.
- Application rollback: point `current` to the previous retained release and restart the service. Restore the JSON backup only if the data format is incompatible; preserve the failed file first.
- After rollback, verify health, login, public routes, a next-departure query, favorites, admin authorization, and logs.

## Troubleshooting

- `503 /api/health`: inspect `journalctl -u campus-bus-api`, confirm `DATA_FILE` and parent-directory permissions, and validate the JSON file.
- Login loop: verify `APP_ORIGIN`, HTTPS, `TRUST_PROXY=1`, cookie behavior, and system clock.
- Deep-link 404: confirm the Nginx SPA fallback is active.
- Wrong departure day/time: verify `CAMPUS_TIMEZONE=Africa/Cairo` and the timetable's 0–6 day convention.
- `EACCES` while saving: confirm `/var/lib/campus-bus` is owned by the service account and included in systemd `ReadWritePaths`.
