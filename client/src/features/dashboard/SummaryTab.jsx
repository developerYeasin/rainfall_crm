import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardApi } from '@/api/endpoints.js';
import { Card, CardHeader, CardBody } from '@/components/ui/Card.jsx';
import { StatTile } from '@/components/ui/StatTile.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States.jsx';
import { currency, number, percent, roas, dateLabel } from '@/lib/format.js';
import { WEEK_STATUS_TONE } from '@/lib/status.js';
import { t } from '@/i18n/index.jsx';

const PIE_COLORS = ['#3182f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#64748b'];

export const SummaryTab = () => {
  const { cycle } = useOutletContext();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'cycle', cycle.id],
    queryFn: () => dashboardApi.cycle(cycle.id),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const m = data.metrics;
  const achievementTone = m.achievement_pct >= 1 ? 'success' : m.achievement_pct >= 0.9 ? 'warning' : 'danger';

  const metricRows = [
    ['এই মাসের টার্গেট রেভিনিউ (৳)', currency(m.target_revenue), 'প্রজেকশন অনুযায়ী প্রত্যাশিত মোট রেভিনিউ'],
    ['এই মাস পর্যন্ত রিয়েল রেভিনিউ (৳)', currency(m.actual_revenue), 'এখন পর্যন্ত প্রকৃত অর্জিত রেভিনিউ'],
    ['টার্গেট অ্যাচিভমেন্ট %', percent(m.achievement_pct, 1), 'রিয়েল রেভিনিউ ÷ টার্গেট রেভিনিউ'],
    ['মোট অ্যাড স্পেন্ড (৳)', currency(m.total_spend), 'এখন পর্যন্ত মোট বিজ্ঞাপন খরচ'],
    ['রিয়েল ROAS', roas(m.actual_roas), 'প্রকৃত রিটার্ন অন অ্যাড স্পেন্ড'],
    ['টার্গেট ROAS (মাসিক)', roas(m.target_roas), 'প্রজেকশন অনুযায়ী প্রত্যাশিত ROAS'],
    ['মোট কনভার্সন', number(m.total_conversions), 'এখন পর্যন্ত মোট অর্ডার/লিড'],
    ['ডেইলি টাস্ক কমপ্লায়েন্স রেট', percent(m.compliance_rate, 1), 'কতদিন ১০০% টাস্ক সম্পন্ন হয়েছে'],
    ['রিপোর্ট করা মোট দিন', number(m.reported_days), 'যতদিনের রিয়েল ডেটা এন্ট্রি হয়েছে'],
    ['বাজেট ব্যবহার', percent(m.budget_utilisation, 1), t('অবশিষ্ট {n}', { n: currency(m.remaining_budget) })],
  ];

  const weekColumns = [
    { key: 'label', header: 'সপ্তাহ' },
    { key: 'variance_pct', header: 'ভ্যারিয়েন্স %', align: 'right', render: (r) => percent(r.variance_pct, 1) },
    { key: 'status', header: 'স্ট্যাটাস', render: (r) => <Badge tone={WEEK_STATUS_TONE[r.status]}>{r.status}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="টার্গেট অ্যাচিভমেন্ট"
          value={percent(m.achievement_pct, 1)}
          badge={{ tone: achievementTone, label: `${currency(m.actual_revenue)} / ${currency(m.target_revenue)}` }}
        />
        <StatTile
          label="মোট স্পেন্ড"
          value={currency(m.total_spend)}
          hint={t('বাজেটের {n}', { n: percent(m.budget_utilisation, 1) })}
        />
        <StatTile label="রিয়েল ROAS" value={roas(m.actual_roas)} hint={t('টার্গেট {n}', { n: roas(m.target_roas) })} />
        <StatTile
          label="কমপ্লায়েন্স রেট"
          value={percent(m.compliance_rate, 1)}
          hint={t('{n} দিন ট্র্যাক', { n: number(m.tracked_days) })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="দৈনিক স্পেন্ড বনাম রেভিনিউ" />
          <CardBody>
            {data.daily.length === 0 ? (
              <EmptyState title="কোনো ডেটা নেই" description="পারফরম্যান্স ট্র্যাকারে এন্ট্রি দিন" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.daily} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3182f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3182f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="entry_date"
                      tickFormatter={dateLabel}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                    />
                    <Tooltip formatter={(v) => currency(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" name={t('রেভিনিউ')} stroke="#3182f6" fill="url(#rev)" />
                    <Area type="monotone" dataKey="spend" name={t('স্পেন্ড')} stroke="#f59e0b" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="প্ল্যাটফর্মভিত্তিক রেভিনিউ" />
          <CardBody>
            {data.platforms.length === 0 ? (
              <EmptyState title="কোনো ডেটা নেই" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.platforms} dataKey="revenue" nameKey="platform" innerRadius={55} outerRadius={90}>
                      {data.platforms.map((entry, index) => (
                        <Cell key={entry.platform} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => currency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="ড্যাশবোর্ড সামারি — Full Overview"
            subtitle="টার্গেট, রিয়েল পারফরম্যান্স ও কমপ্লায়েন্স একসাথে"
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('মেট্রিক')}</th>
                  <th className="text-right">{t('মান')}</th>
                  <th>{t('ব্যাখ্যা')}</th>
                </tr>
              </thead>
              <tbody>
                {metricRows.map(([label, value, hint]) => (
                  <tr key={label}>
                    <td className="font-medium text-slate-800">{t(label)}</td>
                    <td className="text-right font-semibold text-slate-900">{value}</td>
                    <td className="text-slate-500">{t(hint)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="সাপ্তাহিক স্ট্যাটাস" subtitle="কন্ট্রোল শীট থেকে" />
          <Table columns={weekColumns} rows={data.weeks} rowKey={(r) => r.week_no} />
        </Card>
      </div>
    </div>
  );
};
