import { endOfMonth, format, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';

const fmt = (d) => format(d, 'yyyy-MM-dd');

export const RANGE_OPTIONS = [
  { value: 'all', label: 'শুরু থেকে এখন পর্যন্ত' },
  { value: 'this_month', label: 'এই মাস' },
  { value: 'last_month', label: 'গত মাস' },
  { value: 'last_90', label: 'গত ৯০ দিন' },
  { value: 'this_year', label: 'এই বছর' },
];

/** Returns { from, to } query params; "all" sends none. */
export const rangeFor = (key, now = new Date()) => {
  switch (key) {
    case 'this_month':
      return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) };
    case 'last_month': {
      const prev = subMonths(now, 1);
      return { from: fmt(startOfMonth(prev)), to: fmt(endOfMonth(prev)) };
    }
    case 'last_90':
      return { from: fmt(subDays(now, 89)), to: fmt(now) };
    case 'this_year':
      return { from: fmt(startOfYear(now)), to: fmt(now) };
    default:
      return {};
  }
};
