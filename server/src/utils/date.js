/** Returns YYYY-MM-DD for a Date or a date-ish value. */
export const toDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};

export const addDays = (dateStr, days) => {
  const d = new Date(`${toDateOnly(dateStr)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** First day of the month for a given date string. */
export const monthStart = (dateStr) => `${toDateOnly(dateStr).slice(0, 7)}-01`;

/**
 * Week number (1-based) of a date inside a cycle, using fixed 7-day blocks
 * from month_start — matching how the sheet labels rows "সপ্তাহ ১..৪".
 */
export const weekNoFor = (dateStr, cycleStart, weeksCount = 4) => {
  const a = new Date(`${toDateOnly(cycleStart)}T00:00:00Z`);
  const b = new Date(`${toDateOnly(dateStr)}T00:00:00Z`);
  const diff = Math.floor((b - a) / 86400000);
  if (diff < 0) return 1;
  return Math.min(weeksCount, Math.floor(diff / 7) + 1);
};
