import clsx from 'clsx';

const TONES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  info: 'bg-brand-50 text-brand-700 ring-brand-200',
  muted: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export const Badge = ({ tone = 'muted', children, className }) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      TONES[tone] || TONES.muted,
      className,
    )}
  >
    {children}
  </span>
);
