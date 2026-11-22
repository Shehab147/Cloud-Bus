#!/usr/bin/env bash
# Save a copy outside the deployment directory before first use, for example:
#   install -m 700 a2.sh /root/a2.sh
# Then deploy with: /root/a2.sh

set -Eeuo pipefail

# Load NVM when this server uses it. System Node is used otherwise.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
fi

readonly REPOSITORY_URL="${REPOSITORY_URL:-https://github.com/Shehab147/Cloud-Bus.git}"
readonly CHECKOUT_DIR="/tmp/a2cloud-checkout"
readonly APP_DIR="/var/www/a2cloud"
readonly API_SERVICE="${API_SERVICE:-campus-bus-api.service}"

export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_SIZE_MB:-4096} ${NODE_OPTIONS:-}"

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Required command is unavailable: $1" >&2; exit 1; }
}

cleanup() {
  rm -rf "$CHECKOUT_DIR"
}
trap cleanup EXIT

require git
require npm
require node
require rsync
require nginx
require systemctl

if [[ $EUID -ne 0 ]]; then
  echo "Run this deployment script as root (for systemctl and nginx reload)." >&2
  exit 1
fi

if [[ -e "$APP_DIR" && ! -d "$APP_DIR" ]]; then
  echo "$APP_DIR exists but is not a directory." >&2
  exit 1
fi

# The application deliberately loads this file from the repository root.
# rsync below excludes it, so deployments never overwrite secrets.
if [[ ! -r "$APP_DIR/.env" ]]; then
  echo "Missing $APP_DIR/.env. Create it before deploying." >&2
  exit 1
fi
if ! grep -q '^SESSION_SECRET=.' "$APP_DIR/.env"; then
  echo "$APP_DIR/.env is missing SESSION_SECRET." >&2
  exit 1
fi
chown root:root "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

rm -rf "$CHECKOUT_DIR"
git clone --depth 1 "$REPOSITORY_URL" "$CHECKOUT_DIR"

# Compile in an isolated checkout. Development dependencies are needed only here.
cd "$CHECKOUT_DIR"
npm ci
npm run build

mkdir -p "$APP_DIR"

# Sync the release without deleting the production environment, runtime data,
# or the source-control metadata from the existing checkout.
rsync -a --delete \
  --exclude '.env' \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'backend/data/' \
  "$CHECKOUT_DIR/" "$APP_DIR/"

# Install only the runtime dependencies after the compiled files are in place.
cd "$APP_DIR"
npm ci --omit=dev

# Nginx needs read access to the static build. Do not change .env permissions.
chown -R www-data:www-data "$APP_DIR/frontend/dist"
chmod -R u=rwX,go=rX "$APP_DIR/frontend/dist"

# Validate configuration before restarting either public-facing service.
nginx -t
systemctl daemon-reload
systemctl restart "$API_SERVICE"
systemctl is-active --quiet "$API_SERVICE"
systemctl reload nginx

echo "A2Cloud deployment completed successfully."
