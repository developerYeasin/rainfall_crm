import clsx from 'clsx';
import { Badge } from './Badge.jsx';

export const StatTile = ({ label, value, hint, tone, badge }) => (
  <div className="card p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <div className="mt-2 flex items-baseline gap-2">
      <span className={clsx('text-2xl font-semibold', tone === 'danger' ? 'text-rose-600' : 'text-slate-900')}>
        {value}
      </span>
      {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
    </div>
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);
