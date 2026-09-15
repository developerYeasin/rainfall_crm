import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { StatTile } from '@/components/ui/StatTile.jsx';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { currency, number, percent, roas } from '@/lib/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { ActivityFeed } from './ActivityFeed.jsx';
import { t, tData } from '@/i18n/index.jsx';

const achievementTone = (pct) => {
  if (pct === null || pct === undefined) return 'muted';
  if (pct >= 1) return 'success';
  if (pct >= 0.9) return 'warning';
  return 'danger';
};

export const OverviewPage = () => {
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: dashboardApi.overview,
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const columns = [
    {
      key: 'client_name',
      header: 'ক্লায়েন্ট',
      render: (row) => (
        <Link to={`/cycles/${row.cycle_id}`} className="font-medium text-brand-700 hover:underline">
          {row.client_name}
        </Link>
      ),
    },
    { key: 'cycle_name', header: 'মাস', render: (row) => `${tData(row.cycle_name)} ·${String(row.month_start).slice(0, 7)}` },
    { key: 'target_revenue', header: 'টার্গেট রেভিনিউ', align: 'right', render: (r) => currency(r.target_revenue) },
    { key: 'revenue', header: 'রিয়েল রেভিনিউ', align: 'right', render: (r) => currency(r.revenue) },
    { key: 'spend', header: 'স্পেন্ড', align: 'right', render: (r) => currency(r.spend) },
    { key: 'roas', header: 'ROAS', align: 'right', render: (r) => roas(r.roas) },
    {
      key: 'achievement_pct',
      header: 'অ্যাচিভমেন্ট',
      align: 'right',
      render: (r) => <Badge tone={achievementTone(r.achievement_pct)}>{percent(r.achievement_pct, 1)}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader title="এজেন্সি ওভারভিউ" subtitle="সব চলমান ক্লায়েন্টের টার্গেট ও রিয়েল পারফরম্যান্স এক নজরে" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="মোট ক্লায়েন্ট" value={number(data.clients.total)} hint={t('অ্যাক্টিভ {n}', { n: number(data.clients.active) })} />
        <StatTile label="মোট রেভিনিউ" value={currency(data.totals.revenue)} hint="চলমান সাইকেলসমূহ" />
        <StatTile label="মোট অ্যাড স্পেন্ড" value={currency(data.totals.spend)} />
        <StatTile label="সামগ্রিক ROAS" value={roas(data.totals.roas)} hint={t('{n} কনভার্সন', { n: number(data.totals.conversions) })} />
      </div>

      <Card className="mt-5">
        <CardHeader title="চলমান সাইকেল" subtitle="প্রতিটি ক্লায়েন্টের চলতি মাসের অবস্থা" />
        <Table columns={columns} rows={data.running_cycles} empty="কোনো চলমান সাইকেল নেই" rowKey={(r) => r.cycle_id} />
      </Card>

      {can('admin') && (
        <div className="mt-5">
          <ActivityFeed />
        </div>
      )}
    </>
  );
};
