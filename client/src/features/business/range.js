import { endOfMonth, format, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';

const fmt = (d) => format(d, 'yyyy-MM-dd');

export const RANGE_OPTIONS = [
  { value: 'all', label: 'শুরু থেকে এখন পর্যন্ত' },
  { value: 'this_month', label: 'এই মাস' },
  { value: 'last_month', label: 'গত মাস' },
  { value: 'last_90', label: 'গত ৯০ দিন' },
  { value: 'this_year', label: 'এই বছর' },
  { value: 'today', label: 'আজ' },
  { value: 'yesterday', label: 'গতকাল' },
  { value: 'last_7', label: 'গত ৭ দিন' },
  { value: 'custom', label: 'তারিখ বেছে নিন (ক্যালেন্ডার)…' },
];

/** Returns { from, to } query params; "all" sends none. `custom` uses the picked dates. */
export const rangeFor = (key, now = new Date(), custom = {}) => {
  switch (key) {
    case 'today':
      return { from: fmt(now), to: fmt(now) };
    case 'yesterday': {
      const d = subDays(now, 1);
      return { from: fmt(d), to: fmt(d) };
    }
    case 'last_7':
      return { from: fmt(subDays(now, 6)), to: fmt(now) };
    case 'custom': {
      const { from, to } = custom;
      if (!from && !to) return {};
      // A single picked date means "that day"; reversed dates are swapped.
      const a = from || to;
      const b = to || from;
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
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
