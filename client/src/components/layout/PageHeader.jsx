import { t } from '@/i18n/index.jsx';

export const PageHeader = ({ title, subtitle, actions, breadcrumb }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      {breadcrumb && <div className="mb-1 text-xs font-medium text-brand-600">{breadcrumb}</div>}
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 lg:text-2xl">{t(title)}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{t(subtitle)}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
