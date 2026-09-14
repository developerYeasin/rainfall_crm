export const PageHeader = ({ title, subtitle, actions, breadcrumb }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      {breadcrumb && <div className="mb-1 text-xs text-slate-500">{breadcrumb}</div>}
      <h1 className="text-xl font-semibold text-slate-900 lg:text-2xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
