import clsx from 'clsx';
import { t } from '@/i18n/index.jsx';

export const Card = ({ className, children }) => <div className={clsx('card', className)}>{children}</div>;

export const CardHeader = ({ title, subtitle, actions }) => (
  <div className="card-header">
    <div className="min-w-0">
      <h3 className="card-title">{t(title)}</h3>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{t(subtitle)}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const CardBody = ({ className, children }) => <div className={clsx('p-5', className)}>{children}</div>;
