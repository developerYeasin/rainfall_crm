import clsx from 'clsx';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-200',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-200',
  ghost: 'text-slate-600 hover:bg-slate-100 focus:ring-slate-200',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200',
};

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
};

export const Button = ({ variant = 'primary', size = 'md', className, loading, children, ...props }) => (
  <button
    type="button"
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
      VARIANTS[variant],
      SIZES[size],
      className,
    )}
    disabled={loading || props.disabled}
    {...props}
  >
    {loading && (
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
    )}
    {children}
  </button>
);
