import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { controlApi } from '@/api/endpoints.js';
import { Card, CardHeader, CardBody } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { currency, percent, roas } from '@/lib/format.js';
import { WEEK_STATUS_TONE } from '@/lib/status.js';
import { t, tData } from '@/i18n/index.jsx';

export const ControlTab = () => {
  const { cycle } = useOutletContext();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['control', cycle.id],
    queryFn: () => controlApi.get(cycle.id),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const columns = [
    { key: 'label', header: 'সপ্তাহ' },
    { key: 'target_revenue', header: 'টার্গেট রেভিনিউ (৳)', align: 'right', render: (r) => currency(r.target_revenue) },
    { key: 'actual_revenue', header: 'রিয়েল রেভিনিউ (৳)', align: 'right', render: (r) => currency(r.actual_revenue) },
    {
      key: 'variance',
      header: 'ভ্যারিয়েন্স (৳)',
      align: 'right',
      render: (r) => (
        <span className={r.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}>{currency(r.variance)}</span>
      ),
    },
    {
      key: 'variance_pct',
      header: 'ভ্যারিয়েন্স %',
      align: 'right',
      render: (r) => (
        <span className={r.variance_pct < 0 ? 'text-rose-600' : 'text-emerald-600'}>{percent(r.variance_pct, 1)}</span>
      ),
    },
    { key: 'target_roas', header: 'টার্গেট ROAS', align: 'right', render: (r) => roas(r.target_roas) },
    { key: 'actual_roas', header: 'রিয়েল ROAS', align: 'right', render: (r) => roas(r.actual_roas) },
    {
      key: 'status',
      header: 'স্ট্যাটাস',
      render: (r) => <Badge tone={WEEK_STATUS_TONE[r.status]}>{r.status}</Badge>,
    },
  ];

  const footer = {
    label: data.total.label,
    target_revenue: currency(data.total.target_revenue),
    actual_revenue: currency(data.total.actual_revenue),
    variance: currency(data.total.variance),
    variance_pct: percent(data.total.variance_pct, 1),
    target_roas: roas(data.total.target_roas),
  };

  const chartData = data.weeks.map((w) => ({
    name: tData(w.label),
    target: w.target_revenue,
    actual: w.actual_revenue,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="কন্ট্রোল ইন্সপেকশন — টার্গেট বনাম রিয়েল" subtitle="সাপ্তাহিক ভ্যারিয়েন্স ও স্ট্যাটাস অটো-ফ্ল্যাগ" />
        <Table columns={columns} rows={data.weeks} footer={footer} rowKey={(r) => r.week_no} />
      </Card>

      <Card>
        <CardHeader title="সাপ্তাহিক তুলনা" />
        <CardBody>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip formatter={(v) => currency(v)} />
                <Legend />
                <Bar dataKey="target" name={t('টার্গেট')} fill="#94a3b8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="actual" name={t('রিয়েল')} fill="#3182f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
