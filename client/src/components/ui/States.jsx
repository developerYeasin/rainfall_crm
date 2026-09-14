export const Spinner = ({ className = 'h-5 w-5' }) => (
  <span className={`inline-block animate-spin rounded-full border-2 border-brand-500 border-t-transparent ${className}`} />
);

export const Loading = ({ label = 'লোড হচ্ছে…' }) => (
  <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
    <Spinner />
    {label}
  </div>
);

export const ErrorState = ({ error, onRetry }) => (
  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-6 text-center">
    <p className="text-sm font-medium text-rose-700">{error?.message || 'কিছু একটা ভুল হয়েছে'}</p>
    {onRetry && (
      <button type="button" onClick={onRetry} className="mt-3 text-sm font-medium text-rose-700 underline">
        আবার চেষ্টা করুন
      </button>
    )}
  </div>
);

export const EmptyState = ({ title = 'কোনো ডেটা নেই', description, action }) => (
  <div className="px-4 py-12 text-center">
    <p className="text-sm font-medium text-slate-700">{title}</p>
    {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);
