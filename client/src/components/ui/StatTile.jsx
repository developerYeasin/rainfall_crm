import clsx from 'clsx';
import { t } from '@/i18n/index.jsx';
import { Badge } from './Badge.jsx';

export const StatTile = ({ label, value, hint, tone, badge }) => (
  <div className="card relative overflow-hidden p-4 sm:p-5">
    <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500/70 to-transparent" />
    <p className="text-xs font-medium text-slate-500">{t(label)}</p>
    <div className="mt-2 flex flex-wrap items-baseline gap-2">
      <span
        className={clsx(
          'text-xl font-semibold tabular-nums tracking-tight sm:text-2xl',
          tone === 'danger' ? 'text-rose-600' : 'text-slate-900',
        )}
      >
        {value}
      </span>
      {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
    </div>
    {hint && <p className="mt-1 truncate text-xs text-slate-500">{t(hint)}</p>}
  </div>
);
