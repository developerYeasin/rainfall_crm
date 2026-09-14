const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const toBn = (value) =>
  String(value ?? '').replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

export const currency = (value, { bn = false } = {}) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const formatted = Math.abs(Number(value)).toLocaleString('en-US', { maximumFractionDigits: 2 });
  // Sign before the taka symbol: −৳8,570, not ৳-8,570.
  return `${Number(value) < 0 ? '−' : ''}৳${bn ? toBn(formatted) : formatted}`;
};

export const number = (value, digits = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
};

export const percent = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(digits)}%`;
};

export const roas = (value) => (value === null || value === undefined ? '—' : `${Number(value).toFixed(2)}x`);

export const dateLabel = (value) => (value ? String(value).slice(0, 10) : '—');

/** Local calendar date — toISOString() is UTC and gives yesterday before 6am in Bangladesh. */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
