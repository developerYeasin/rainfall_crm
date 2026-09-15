import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { notificationsApi } from '@/api/endpoints.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { currency } from '@/lib/format.js';
import { t } from '@/i18n/index.jsx';

const FLAG_LABEL = { overspend: 'বেশি খরচ', underspend: 'কম খরচ', no_delivery: 'ডেলিভারি বন্ধ' };
const STOCK_LABEL = { low: 'কম স্টক', out: 'স্টক শেষ' };

/** Notifications are stored as type + data so they render in the viewer's language. */
const TEMPLATES = {
  client_onboarded: (d) => t('নতুন ক্লায়েন্ট: {client} ({by})', d),
  low_stock: (d) => t('{label}: {product} — {n} পিস বাকি', { ...d, label: t(STOCK_LABEL[d.status] || ''), n: d.in_stock }),
  invoice_issued: (d) => t('নতুন ইনভয়েস {invoice_no} — {total}, শেষ তারিখ {due_date}', { ...d, total: currency(d.total) }),
  invoice_due: (d) =>
    t(d.stage === 'overdue' ? 'ইনভয়েস {invoice_no} মেয়াদোত্তীর্ণ — বাকি {balance}' : 'ইনভয়েস {invoice_no} এর শেষ তারিখ {due_date} — বাকি {balance}', {
      ...d,
      balance: currency(d.balance),
    }),
  payment_received: (d) => t('পেমেন্ট পাওয়া গেছে: {amount} ({invoice_no})', { ...d, amount: currency(d.amount) }),
  spend_alert: (d) => t('স্পেন্ড অ্যালার্ট — {client} / {account}: {flag} (গতকাল {spend})', { ...d, flag: t(FLAG_LABEL[d.flag] || d.flag), spend: currency(d.spend) }),
  task_assigned: (d) => t('নতুন টাস্ক: {title} ({by})', d),
  task_overdue: (d) => t('টাস্ক মেয়াদোত্তীর্ণ: {title}', d),
  announcement: (d) => t('ঘোষণা: {preview}', d),
  agency_message: (d) => t('{from}: {preview}', d),
  client_message: (d) => t('{client} — {from}: {preview}', d),
  direct_message: (d) => t('{from}: {preview}', d),
};

export const notificationText = (n) => (TEMPLATES[n.type] ? TEMPLATES[n.type](n.data || {}) : n.type);

/** "business:stock" links point at the client ledger — the path differs for client logins and staff. */
const resolveLink = (n, user) => {
  if (!n.link) return null;
  if (!n.link.startsWith('business:')) return n.link;
  const section = n.link.slice('business:'.length);
  return user.role === 'client' ? `/business/${section}` : `/clients/${n.client_id}/business/${section}`;
};

const timeAgo = (value) => {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return t('এইমাত্র');
  if (minutes < 60) return t('{n} মিনিট আগে', { n: minutes });
  if (minutes < 1440) return t('{n} ঘণ্টা আগে', { n: Math.round(minutes / 60) });
  return t('{n} দিন আগে', { n: Math.round(minutes / 1440) });
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const read = useMutation({ mutationFn: notificationsApi.read, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: notificationsApi.readAll, onSuccess: invalidate });

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const unread = data?.meta?.unread || 0;
  const rows = data?.rows || [];

  const openItem = (n) => {
    if (!n.read_at) read.mutate(n.id);
    const link = resolveLink(n, user);
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t('নোটিফিকেশন')}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{t('নোটিফিকেশন')}</p>
            {unread > 0 && (
              <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => readAll.mutate()}>
                {t('সব পড়া হয়েছে')}
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
            {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">{t('কোনো নোটিফিকেশন নেই')}</li>}
            {rows.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={clsx('flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50', !n.read_at && 'bg-brand-50/50')}
                >
                  <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand-600')} />
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-800">{notificationText(n)}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
