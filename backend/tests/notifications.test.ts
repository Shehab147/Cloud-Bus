import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { createSeedData, type UserRecord } from '../src/data/store.js';
import { pendingNotifications } from '../src/services/departure-notifications.js';

const student = (id: number, email: string): UserRecord => ({ id, name: `Student ${id}`, email, passwordHash: 'not-used', role: 'student', createdAt: new Date().toISOString() });

describe('departure reminders', () => {
  it('reminds every student who saved the same stop, once each', () => {
    const data = createSeedData();
    data.users.push(student(1, 'first@example.edu'), student(2, 'second@example.edu'));
    const createdAt = new Date().toISOString();
    data.favorites.push({ id: 1, userId: 1, stopId: 1, createdAt }, { id: 2, userId: 2, stopId: 1, createdAt });

    // The seed has weekday departures at 08:00 from stop 1, so 07:55 on the next Monday is 5 minutes before one.
    let monday = DateTime.now().setZone('Africa/Cairo').plus({ days: 1 }).startOf('day');
    while (monday.weekday !== 1) monday = monday.plus({ days: 1 });
    const now = monday.set({ hour: 7, minute: 55 });

    const recipients = pendingNotifications(data, now).map((notification) => notification.to).sort();
    expect(recipients).toEqual(['first@example.edu', 'second@example.edu']);
  });

  it('sends nothing for a reminder that was already sent', () => {
    const data = createSeedData();
    data.users.push(student(1, 'first@example.edu'));
    data.favorites.push({ id: 1, userId: 1, stopId: 1, createdAt: new Date().toISOString() });
    let monday = DateTime.now().setZone('Africa/Cairo').plus({ days: 1 }).startOf('day');
    while (monday.weekday !== 1) monday = monday.plus({ days: 1 });
    const now = monday.set({ hour: 7, minute: 55 });

    const [first] = pendingNotifications(data, now);
    data.notificationLogs.push({ key: first.key, sentAt: now.toISO()! });
    expect(pendingNotifications(data, now)).toEqual([]);
  });
});
