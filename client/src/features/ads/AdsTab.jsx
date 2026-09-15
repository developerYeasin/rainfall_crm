import { Fragment, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { portalApi } from '@/api/endpoints.js';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { StatTile } from '@/components/ui/StatTile.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States.jsx';
import { currency, number, percent, roas, dateLabel } from '@/lib/format.js';
import { t } from '@/i18n/index.jsx';

const GROUP_OPTIONS = [
  { value: 'day', label: 'দৈনিক' },
  { value: 'week', label: 'সাপ্তাহিক' },
  { value: 'month', label: 'মাসিক' },
];

const Metrics = ({ row }) => (
  <>
    <td className="text-right">{currency(row.spend)}</td>
    <td className="text-right">{number(row.impressions)}</td>
    <td className="text-right">{number(row.clicks)}</td>
    <td className="text-right">{percent(row.ctr)}</td>
    <td className="text-right">{currency(row.cpc)}</td>
    <td className="text-right">{number(row.results)}</td>
    <td className="text-right">{currency(row.cost_per_result)}</td>
    <td className="text-right">{roas(row.roas)}</td>
  </>
);

const HEADERS = ['স্পেন্ড', 'ইমপ্রেশন', 'ক্লিক', 'CTR', 'CPC', 'রেজাল্ট', 'প্রতি রেজাল্ট খরচ', 'ROAS'];

/** Campaigns with their ad sets folding out underneath. */
const CampaignTable = ({ campaigns }) => {
  const [open, setOpen] = useState({});
  if (!campaigns.length) return <EmptyState title="এই সময়ে কোনো ক্যাম্পেইন ডেটা নেই" />;
  return (
    <div className="table-wrap">
      <table className="table" style={{ minWidth: 900 }}>
        <thead>
          <tr>
            <th>{t('ক্যাম্পেইন / অ্যাড সেট')}</th>
            {HEADERS.map((h) => (
              <th key={h} className="text-right">
                {t(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <Fragment key={c.id}>
              <tr>
                <td>
                  <button
                    type="button"
                    className="flex items-center gap-2 font-medium text-slate-800"
                    onClick={() => setOpen({ ...open, [c.id]: !open[c.id] })}
                    disabled={!c.adsets.length}
                  >
                    <span className="inline-block w-3 text-slate-400">{c.adsets.length ? (open[c.id] ? '▾' : '▸') : ''}</span>
                    <span className="max-w-[280px] truncate">{c.name || c.id}</span>
                  </button>
                </td>
                <Metrics row={c} />
              </tr>
              {open[c.id] &&
                c.adsets.map((s) => (
                  <tr key={s.id} className="bg-slate-50/60">
                    <td className="pl-10 text-slate-600">
                      <span className="block max-w-[260px] truncate">{s.name || s.id}</span>
                    </td>
                    <Metrics row={s} />
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Ads performance pulled from connected ad accounts. Refreshes on its own every few minutes,
 * so the client never has to ask the media buyer for numbers.
 */
export const AdsTab = () => {
  const { clientId, range } = useOutletContext();
  const [group, setGroup] = useState('day');
  const params = { ...range, group };

  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['business', clientId, 'ads', params],
    queryFn: () => portalApi.ads(clientId, params),
    refetchInterval: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { totals, sales, series, campaigns, accounts } = data;
  const lastSync = accounts.map((a) => a.last_synced_at).filter(Boolean).sort().pop();

  if (!accounts.length) {
    return (
      <Card>
        <EmptyState
          title="এখনো কোনো অ্যাড অ্যাকাউন্ট যুক্ত হয়নি"
          description="এজেন্সি অ্যাড অ্যাকাউন্ট কানেক্ট করলে এখানে প্রতিদিনের পারফরম্যান্স নিজে থেকেই আসবে।"
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {t('{from} থেকে {to}', { from: data.range.from, to: data.range.to })}
          {lastSync && <> · {t('শেষ সিঙ্ক {time}', { time: String(lastSync).slice(0, 16).replace('T', ' ') })}</>}
          {dataUpdatedAt ? <span className="hidden sm:inline"> · {t('প্রতি ৫ মিনিটে রিফ্রেশ হয়')}</span> : null}
        </p>
        <Select className="w-36" value={group} onChange={(e) => setGroup(e.target.value)} options={GROUP_OPTIONS} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="অ্যাড স্পেন্ড" value={currency(totals.spend)} hint={t('{n} ইমপ্রেশন', { n: number(totals.impressions) })} />
        <StatTile label="রেজাল্ট" value={number(totals.results)} hint={t('প্রতি রেজাল্ট {v}', { v: currency(totals.cost_per_result) })} />
        <StatTile label="ক্লিক" value={number(totals.clicks)} hint={t('CTR {ctr} · CPC {cpc}', { ctr: percent(totals.ctr), cpc: currency(totals.cpc) })} />
        <StatTile label="প্ল্যাটফর্ম ROAS" value={roas(totals.roas)} hint={t('অ্যাট্রিবিউটেড সেল {v}', { v: currency(totals.purchase_value) })} />
      </div>

      <Card>
        <CardHeader title="অ্যাড স্পেন্ড বনাম আসল সেল" subtitle="সেল শীটে লেখা বিক্রির সাথে তুলনা — প্ল্যাটফর্মের ROAS না, আসল রিটার্ন" />
        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 p-5 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">{t('সেল (সেল শীট)')}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{currency(sales.revenue)}</p>
            <p className="text-xs text-slate-500">{t('{n} টি অর্ডার', { n: number(sales.orders) })}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t('আসল ROAS')}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{roas(sales.blended_roas)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t('ROI')}</p>
            <p className={`mt-1 text-lg font-semibold ${sales.roi < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{percent(sales.roi, 1)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t('প্রতি অর্ডার অ্যাড খরচ')}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{currency(sales.cost_per_order)}</p>
          </div>
        </div>
        <div className="h-72 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis yAxisId="money" tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => number(v)} />
              <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                formatter={(value, name) => (name === t('রেজাল্ট') ? number(value) : currency(value))}
                labelFormatter={(v) => dateLabel(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="money" dataKey="spend" name={t('স্পেন্ড')} fill="#3182f6" radius={[3, 3, 0, 0]} />
              <Line yAxisId="money" dataKey="sales_revenue" name={t('সেল')} stroke="#059669" strokeWidth={2} dot={false} />
              <Line yAxisId="count" dataKey="results" name={t('রেজাল্ট')} stroke="#f59e0b" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="ক্যাম্পেইন ও অ্যাড সেট" subtitle="ক্যাম্পেইনে ক্লিক করলে অ্যাড সেট দেখা যাবে" />
        <CampaignTable campaigns={campaigns} />
      </Card>

      <Card>
        <CardHeader title="যুক্ত অ্যাড অ্যাকাউন্ট" />
        <ul className="divide-y divide-slate-100">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <span>
                <span className="font-medium text-slate-800">{a.name}</span>
                <span className="ml-2 text-xs uppercase text-slate-400">{a.platform}</span>
              </span>
              <span className="flex items-center gap-2">
                {a.last_sync_error ? (
                  <Badge tone="danger">{t('সিঙ্ক সমস্যা')}</Badge>
                ) : (
                  <Badge tone={a.is_active ? 'success' : 'muted'}>{a.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge>
                )}
                <span className="text-xs text-slate-500">{a.last_synced_at ? String(a.last_synced_at).slice(0, 16).replace('T', ' ') : '—'}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
