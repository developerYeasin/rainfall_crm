import clsx from 'clsx';

export const Field = ({ label, error, hint, className, children }) => (
  <div className={className}>
    {label && <label className="label">{label}</label>}
    {children}
    {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    {!error && hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

export const Input = ({ className, ...props }) => <input className={clsx('input', className)} {...props} />;

export const Select = ({ className, options = [], placeholder, ...props }) => (
  <select className={clsx('input', className)} {...props}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map((opt) => {
      const value = typeof opt === 'string' ? opt : opt.value;
      const label = typeof opt === 'string' ? opt : opt.label;
      return (
        <option key={value} value={value}>
          {label}
        </option>
      );
    })}
  </select>
);

export const Textarea = ({ className, ...props }) => (
  <textarea rows={3} className={clsx('input resize-y', className)} {...props} />
);

export const Checkbox = ({ label, className, ...props }) => (
  <label className={clsx('flex cursor-pointer items-center gap-2 text-sm text-slate-700', className)}>
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
      {...props}
    />
    {label}
  </label>
);
