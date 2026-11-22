import nodemailer from 'nodemailer';
import { DateTime } from 'luxon';
import { env } from '../config/env.js';
import { mutateData, readData, type CampusData } from '../data/store.js';
import { scheduleApplies } from '../modules/timetables/rules.js';

type PendingNotification = { key: string; to: string; subject: string; text: string };

const transporter = env.EMAIL_NOTIFICATIONS_ENABLED && env.SMTP_USER && env.SMTP_PASSWORD
  ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } })
  : undefined;

function pendingNotifications(data: CampusData, now: DateTime): PendingNotification[] {
  const sent = new Set(data.notificationLogs.map((record) => record.key));
  const serviceDate = now.setZone(env.CAMPUS_TIMEZONE).toISODate()!;
  const dayOfWeek = now.setZone(env.CAMPUS_TIMEZONE).weekday % 7;
  const recipients = new Map<number, string[]>();
  for (const favorite of data.favorites) {
    const user = data.users.find((candidate) => candidate.id === favorite.userId);
    if (!user) continue;
    recipients.set(favorite.stopId, [...new Set([user.email, user.parentEmail].filter((email): email is string => Boolean(email)))]);
  }
  const notifications: PendingNotification[] = [];
  for (const table of data.timetables.filter((item) => item.status === 'active' && item.effectiveFrom <= serviceDate && serviceDate <= item.effectiveTo)) {
    const seasonal = data.timetables.some((item) => item.routeId === table.routeId && item.status === 'active' && item.scheduleType === 'seasonal' && item.effectiveFrom <= serviceDate && serviceDate <= item.effectiveTo);
    if (!scheduleApplies(table.scheduleType, dayOfWeek, seasonal)) continue;
    const route = data.routes.find((item) => item.id === table.routeId && item.status === 'active');
    if (!route) continue;
    for (const departure of data.departures.filter((item) => item.timetableId === table.id)) {
      const stop = data.stops.find((item) => item.id === departure.stopId && item.status === 'active');
      const emails = recipients.get(departure.stopId);
      if (!stop || !emails?.length) continue;
      const departureAt = DateTime.fromISO(`${serviceDate}T${departure.departureTime}`, { zone: env.CAMPUS_TIMEZONE });
      const minutesAway = departureAt.diff(now.setZone(env.CAMPUS_TIMEZONE), 'minutes').minutes;
      if (minutesAway < 4.5 || minutesAway > 5.5) continue;
      for (const to of emails) {
        const key = `${departure.id}:${serviceDate}:${to}`;
        if (!sent.has(key)) notifications.push({ key, to, subject: `Bus departs in 5 minutes: ${route.name}`, text: `${route.name} is scheduled to depart ${stop.name} at ${departureAt.toFormat('HH:mm')} (${env.CAMPUS_TIMEZONE}).` });
      }
    }
  }
  return notifications;
}

async function dispatch() {
  if (!transporter) return;
  const notifications = pendingNotifications(await readData(), DateTime.now());
  for (const notification of notifications) {
    await transporter.sendMail({ from: env.SMTP_FROM ?? env.SMTP_USER, to: notification.to, subject: notification.subject, text: notification.text });
    await mutateData((data) => { if (!data.notificationLogs.some((record) => record.key === notification.key)) data.notificationLogs.push({ key: notification.key, sentAt: new Date().toISOString() }); });
  }
}

export function startDepartureNotifications() {
  if (!transporter) { console.log('Scheduled email notifications are disabled.'); return; }
  void dispatch().catch((error) => console.error('Scheduled email notification failed', error));
  setInterval(() => void dispatch().catch((error) => console.error('Scheduled email notification failed', error)), 30_000).unref();
}
