import clsx from 'clsx';
import { t } from '@/i18n/index.jsx';

export const Field = ({ label, error, hint, className, children }) => (
  <div className={className}>
    {label && <label className="label">{t(label)}</label>}
    {children}
    {error && <p className="mt-1 text-xs text-rose-600">{t(error)}</p>}
    {!error && hint && <p className="mt-1 text-xs text-slate-500">{t(hint)}</p>}
  </div>
);

export const Input = ({ className, placeholder, ...props }) => (
  <input className={clsx('input', className)} placeholder={t(placeholder)} {...props} />
);

/** String options keep their raw value (often stored Bangla) and show a translated label. */
export const Select = ({ className, options = [], placeholder, ...props }) => (
  <select className={clsx('input pr-8', className)} {...props}>
    {placeholder && <option value="">{t(placeholder)}</option>}
    {options.map((opt) => {
      const value = typeof opt === 'string' ? opt : opt.value;
      const label = typeof opt === 'string' ? opt : opt.label;
      return (
        <option key={value} value={value}>
          {t(label)}
        </option>
      );
    })}
  </select>
);

export const Textarea = ({ className, placeholder, ...props }) => (
  <textarea rows={3} className={clsx('input resize-y', className)} placeholder={t(placeholder)} {...props} />
);

export const Checkbox = ({ label, className, ...props }) => (
  <label className={clsx('flex cursor-pointer items-center gap-2 text-sm text-slate-700', className)}>
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
      {...props}
    />
    {t(label)}
  </label>
);
