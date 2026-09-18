import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { teamApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { ROLE_LABEL } from '@/lib/status.js';
import { dateLabel, number } from '@/lib/format.js';
import { t } from '@/i18n/index.jsx';

/** Who works on what: assigned clients, ad accounts, task load and overdue work per team member. */
export const TeamPage = () => {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['team'], queryFn: teamApi.list });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const columns = [
    {
      key: 'name',
      header: 'মেম্বার',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.name}</p>
          <p className="text-xs text-slate-500">
            {ROLE_LABEL[r.role]} {!r.is_active && <Badge tone="muted">{t('নিষ্ক্রিয়')}</Badge>}
          </p>
        </div>
      ),
    },
    {
      key: 'clients',
      header: 'ক্লায়েন্ট',
      render: (r) =>
        r.role === 'admin' ? (
          <span className="text-xs text-slate-500">{t('সব ক্লায়েন্ট')}</span>
        ) : r.clients.length ? (
          <div className="flex max-w-[360px] flex-wrap gap-1">
            {r.clients.map((c) => (
              <Link key={c.id} to={`/clients/${c.id}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-brand-50 hover:text-brand-700">
                {c.name}
              </Link>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'ad_accounts',
      header: 'অ্যাড অ্যাকাউন্ট',
      align: 'right',
      render: (r) => (
        <span>
          {number(r.ad_accounts)}
          {r.failing_accounts > 0 && <Badge tone="danger" className="ml-2">{t('{n} সমস্যা', { n: r.failing_accounts })}</Badge>}
        </span>
      ),
    },
    { key: 'open_tasks', header: 'চলমান টাস্ক', align: 'right', render: (r) => number(r.open_tasks) },
    {
      key: 'overdue_tasks',
      header: 'মেয়াদোত্তীর্ণ',
      align: 'right',
      render: (r) => (r.overdue_tasks ? <Badge tone="danger">{number(r.overdue_tasks)}</Badge> : '0'),
    },
    { key: 'done_tasks_30d', header: '৩০ দিনে সম্পন্ন', align: 'right', render: (r) => number(r.done_tasks_30d) },
    { key: 'last_login_at', header: 'শেষ লগইন', render: (r) => dateLabel(r.last_login_at) },
  ];

  return (
    <>
      <PageHeader
        title="টিম পারফরম্যান্স"
        subtitle="কে কোন ক্লায়েন্ট ও অ্যাড অ্যাকাউন্ট দেখছে, কাজের চাপ ও পেন্ডিং টাস্ক"
        actions={
          <div className="flex items-center gap-3">
            <Link to="/users" className="text-sm font-medium text-brand-700 hover:underline">
              {t('ইউজার ও রোল ম্যানেজ করুন →')}
            </Link>
            <Link to="/users?new=media_buyer" className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              {t('+ নতুন টিম মেম্বার')}
            </Link>
          </div>
        }
      />
      <Card>
        <Table columns={columns} rows={data} empty="কোনো টিম মেম্বার নেই" minWidth={960} />
      </Card>
    </>
  );
};
