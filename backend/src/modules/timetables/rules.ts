import { HttpError } from '../../utils/http-error.js';

export type ScheduleType = 'weekday' | 'weekend' | 'seasonal';
export type ScheduleRow = { dayOfWeek: number };

export function validateScheduleDays(type: ScheduleType, rows: ScheduleRow[]) {
  const invalid = rows.some((row) => type === 'weekday'
    ? row.dayOfWeek === 0 || row.dayOfWeek === 6
    : type === 'weekend'
      ? row.dayOfWeek !== 0 && row.dayOfWeek !== 6
      : false);
  if (invalid) throw new HttpError(400, 'VALIDATION_ERROR', 'Departure days do not match the timetable type.', {
    departures: 'Weekday uses Monday–Friday; weekend uses Saturday/Sunday.'
  });
}

export function scheduleApplies(type: ScheduleType, dayOfWeek: number, seasonalAvailable: boolean) {
  if (type === 'seasonal') return true;
  if (seasonalAvailable) return false;
  return type === 'weekday' ? dayOfWeek >= 1 && dayOfWeek <= 5 : dayOfWeek === 0 || dayOfWeek === 6;
}
