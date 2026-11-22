#!/usr/bin/env bash
# Save outside the deployment directory so deployments cannot replace it:
#   install -m 700 test-mailer.sh /root/test-mailer.sh
# Usage:
#   /root/test-mailer.sh recipient@example.com

set -Eeuo pipefail

readonly APP_DIR="/var/www/a2cloud"
readonly ENV_FILE="$APP_DIR/.env"

if [[ $EUID -ne 0 ]]; then
  echo 'Run as root so the protected production environment file can be read.' >&2
  exit 1
fi
if [[ $# -ne 1 || $1 != *@* ]]; then
  echo "Usage: $0 recipient@example.com" >&2
  exit 1
fi
if [[ ! -r "$ENV_FILE" ]]; then
  echo "Missing production environment file: $ENV_FILE" >&2
  exit 1
fi
if [[ ! -d "$APP_DIR/node_modules/nodemailer" ]]; then
  echo 'Nodemailer is not installed. Run /root/a2.sh first.' >&2
  exit 1
fi

cd "$APP_DIR"
TEST_RECIPIENT="$1" node --input-type=module -e '
  import { config } from "dotenv";
  import nodemailer from "nodemailer";
  config({ path: ".env", quiet: true });
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"];
  const missing = required.filter((name) => !process.env[name]);
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== "true" || missing.length) {
    throw new Error(`Mailer is not configured; missing: ${missing.join(", ") || "EMAIL_NOTIFICATIONS_ENABLED=true"}`);
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
  await transport.verify();
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.TEST_RECIPIENT,
    subject: "Campus Bus production SMTP test",
    text: "This confirms the deployed Campus Bus server can authenticate and submit mail through Namecheap SMTP."
  });
  console.log("SMTP verification and test-message submission succeeded.");
'
