import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/utils/http-error.js';
import { paginationSchema, positiveId, strictDate, timeSchema } from '../src/utils/schemas.js';
import { scheduleApplies, validateScheduleDays } from '../src/modules/timetables/rules.js';
import { routeUpdateSchema } from '../src/modules/routes/router.js';
import { stopUpdateSchema } from '../src/modules/stops/router.js';
import { timetableUpdateSchema } from '../src/modules/timetables/router.js';
import { announcementUpdateSchema } from '../src/modules/announcements/router.js';

describe('shared validation', () => {
  it('normalizes safe pagination and rejects oversized input', () => {
    expect(paginationSchema.parse({ page: '2', limit: '20', q: ' north ' })).toEqual({ page: 2, limit: 20, q: 'north' });
    expect(() => paginationSchema.parse({ page: '0', limit: '101' })).toThrow();
    expect(() => positiveId.parse('1 OR 1=1')).toThrow();
  });

  it('accepts strict schedule dates and times only', () => {
    expect(strictDate.parse('2026-10-31')).toBe('2026-10-31');
    expect(timeSchema.parse('23:59')).toBe('23:59');
    expect(() => strictDate.parse('31/10/2026')).toThrow();
    expect(() => timeSchema.parse('24:00')).toThrow();
  });

  it('does not inject create defaults into partial updates', () => {
    expect(routeUpdateSchema.parse({ name: 'New route name' })).toEqual({ name: 'New route name' });
    expect(stopUpdateSchema.parse({ name: 'New stop name' })).toEqual({ name: 'New stop name' });
    expect(timetableUpdateSchema.parse({ effectiveTo: '2027-01-01' })).toEqual({ effectiveTo: '2027-01-01' });
    expect(announcementUpdateSchema.parse({ message: 'Updated information' })).toEqual({ message: 'Updated information' });
  });
});

describe('timetable rules', () => {
  it('enforces weekday and weekend day conventions', () => {
    expect(() => validateScheduleDays('weekday', [{ dayOfWeek: 1 }, { dayOfWeek: 5 }])).not.toThrow();
    expect(() => validateScheduleDays('weekend', [{ dayOfWeek: 0 }, { dayOfWeek: 6 }])).not.toThrow();
    expect(() => validateScheduleDays('weekday', [{ dayOfWeek: 0 }])).toThrow(HttpError);
    expect(() => validateScheduleDays('weekend', [{ dayOfWeek: 2 }])).toThrow(HttpError);
  });

  it('gives seasonal schedules priority over ordinary schedules', () => {
    expect(scheduleApplies('seasonal', 2, true)).toBe(true);
    expect(scheduleApplies('weekday', 2, true)).toBe(false);
    expect(scheduleApplies('weekday', 1, false)).toBe(true);
    expect(scheduleApplies('weekend', 0, false)).toBe(true);
    expect(scheduleApplies('weekend', 1, false)).toBe(false);
  });

  it('uses real Africa/Cairo offsets across daylight-saving boundaries', () => {
    const before = DateTime.fromISO('2026-04-23T12:00', { zone: 'Africa/Cairo' });
    const after = DateTime.fromISO('2026-04-24T12:00', { zone: 'Africa/Cairo' });
    expect(before.isValid && after.isValid).toBe(true);
    expect(after.offset - before.offset).toBe(60);
  });
});
