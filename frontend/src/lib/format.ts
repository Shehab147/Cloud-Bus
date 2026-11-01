export const campusTimezone = 'Africa/Cairo';
export const formatDateTime = (value: string) => new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: campusTimezone }).format(new Date(value));
export const formatDate = (value: string) => new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium', timeZone: campusTimezone }).format(new Date(value));
export const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
