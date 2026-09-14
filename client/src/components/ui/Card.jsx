import clsx from 'clsx';

export const Card = ({ className, children }) => <div className={clsx('card', className)}>{children}</div>;

export const CardHeader = ({ title, subtitle, actions }) => (
  <div className="card-header">
    <div>
      <h3 className="card-title">{title}</h3>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const CardBody = ({ className, children }) => <div className={clsx('p-5', className)}>{children}</div>;
