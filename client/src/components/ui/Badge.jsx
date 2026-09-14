import clsx from 'clsx';
import { tData } from '@/i18n/index.jsx';

const TONES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  info: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  muted: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export const Badge = ({ tone = 'muted', children, className }) => (
  <span
    className={clsx(
      'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      TONES[tone] || TONES.muted,
      className,
    )}
  >
    {tData(children)}
  </span>
);
