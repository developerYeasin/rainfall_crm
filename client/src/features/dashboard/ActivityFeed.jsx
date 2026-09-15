import { useQuery } from '@tanstack/react-query';
import { activityApi } from '@/api/endpoints.js';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { Loading } from '@/components/ui/States.jsx';
import { t } from '@/i18n/index.jsx';

const ACTION_LABEL = {
  create: 'তৈরি করেছেন',
  update: 'আপডেট করেছেন',
  delete: 'মুছেছেন',
  cancel: 'বাতিল করেছেন',
  payment: 'পেমেন্ট যোগ করেছেন',
  delete_payment: 'পেমেন্ট মুছেছেন',
  assign_staff: 'টিম অ্যাসাইন করেছেন',
  export: 'এক্সপোর্ট করেছেন',
};
const ENTITY_LABEL = {
  client: 'ক্লায়েন্ট',
  order: 'অর্ডার',
  product: 'প্রোডাক্ট',
  stock_purchase: 'স্টক এন্ট্রি',
  expense: 'খরচ',
  invoice: 'ইনভয়েস',
  agency_expense: 'এজেন্সি খরচ',
  ad_account: 'অ্যাড অ্যাকাউন্ট',
  agency_task: 'এজেন্সি টাস্ক',
  agency_pnl: 'এজেন্সি P&L',
  client_accounting_xlsx: 'হিসাব (Excel)',
  client_accounting_pdf: 'মাসিক রিপোর্ট (PDF)',
  sales_xlsx: 'সেল (Excel)',
};

/** Agency-wide audit trail (admin): who changed what, newest first. */
export const ActivityFeed = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['activity', 'feed'],
    queryFn: () => activityApi.list({ limit: 15 }),
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader title="সাম্প্রতিক কার্যক্রম" subtitle="কে কী পরিবর্তন করেছে — অডিট লগ" />
      {isLoading ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(data?.rows || []).map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="min-w-0 text-slate-700">
                <span className="font-medium text-slate-900">{a.user_name || t('সিস্টেম')}</span>{' '}
                {t(ENTITY_LABEL[a.entity_type] || a.entity_type)} #{a.entity_id} {t(ACTION_LABEL[a.action] || a.action)}
              </span>
              <span className="shrink-0 text-xs text-slate-500">{String(a.created_at).slice(0, 16).replace('T', ' ')}</span>
            </li>
          ))}
          {!data?.rows?.length && <li className="px-5 py-8 text-center text-sm text-slate-500">{t('কোনো কার্যক্রম নেই')}</li>}
        </ul>
      )}
    </Card>
  );
};
