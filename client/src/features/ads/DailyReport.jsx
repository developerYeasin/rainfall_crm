import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/api/endpoints.js';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { Input } from '@/components/ui/Field.jsx';
import { Loading } from '@/components/ui/States.jsx';
import { currency, number, percent, roas } from '@/lib/format.js';
import { t } from '@/i18n/index.jsx';

/** Change against the day before. `lowerIsBetter` flips the colour for costs; `neutral` (spend) stays grey. */
const Delta = ({ now, before, lowerIsBetter = false, neutral = false }) => {
  if (!before) return null;
  const change = (now - before) / before;
  if (!Number.isFinite(change) || Math.abs(change) < 0.005) return <span className="text-xs text-slate-400">±0%</span>;
  const good = lowerIsBetter ? change < 0 : change > 0;
  return (
    <span className={`text-xs font-medium ${neutral ? 'text-slate-500' : good ? 'text-emerald-600' : 'text-rose-600'}`}>
      {change > 0 ? '▲' : '▼'} {percent(Math.abs(change), 0)}
    </span>
  );
};

const METRICS = [
  { key: 'spend', label: 'স্পেন্ড', fmt: currency, neutral: true },
  { key: 'results', label: 'রেজাল্ট', fmt: number },
  { key: 'cost_per_result', label: 'প্রতি রেজাল্ট খরচ', fmt: currency, lowerIsBetter: true },
  { key: 'clicks', label: 'ক্লিক', fmt: number },
  { key: 'ctr', label: 'CTR', fmt: (v) => percent(v) },
  { key: 'roas', label: 'ROAS', fmt: roas },
];

/**
 * "How did the day go": one whole day (yesterday by default — ready right after midnight) against
 * the day before, today so far, and that day's campaigns.
 */
export const DailyReport = ({ clientId }) => {
  const [date, setDate] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['business', clientId, 'ads', 'daily', date],
    queryFn: () => portalApi.adsDaily(clientId, date || undefined),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });

  if (isLoading) return <Loading />;
  if (!data) return null;
  const { day, previous, today, campaigns } = data;

  return (
    <Card>
      <CardHeader
        title="দিনের রিপোর্ট"
        subtitle="প্রতিদিন রাত ১২টার পর আগের দিনের পুরো হিসাব এখানে চলে আসে"
        actions={
          <Input
            type="date"
            className="w-40"
            value={date || day.date}
            max={today.date}
            onChange={(e) => setDate(e.target.value)}
          />
        }
      />
      <div className="grid gap-5 p-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="mb-3 text-sm font-medium text-slate-700">
            {day.date === today.date ? t('আজ ({d}) — এখন পর্যন্ত', { d: day.date }) : t('{d} — পুরো দিন', { d: day.date })}
            <span className="ml-2 text-xs font-normal text-slate-400">{t('আগের দিনের তুলনায়')}</span>
          </p>
          {day.has_data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {METRICS.map((m) => (
                <div key={m.key} className="rounded-xl border border-slate-100 p-3">
                  <p className="text-xs text-slate-500">{t(m.label)}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{m.fmt(day[m.key])}</p>
                  {previous.has_data && <Delta now={day[m.key]} before={previous[m.key]} lowerIsBetter={m.lowerIsBetter} neutral={m.neutral} />}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t('এই দিনের কোনো অ্যাড ডেটা নেই।')}</p>
          )}
        </div>

        <div className="space-y-4">
          {day.date !== today.date && (
            <div className="rounded-xl bg-brand-50/60 p-4">
              <p className="text-xs font-medium text-brand-700">{t('আজ এখন পর্যন্ত')}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{currency(today.spend)}</p>
              <p className="text-xs text-slate-600">
                {t('{r} রেজাল্ট · প্রতি রেজাল্ট {c}', { r: number(today.results), c: currency(today.cost_per_result) })}
              </p>
            </div>
          )}
          {campaigns.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">{t('এই দিনের ক্যাম্পেইন')}</p>
              <ul className="space-y-2 text-sm">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-slate-700">{c.name || c.id}</span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="font-medium text-slate-900">{currency(c.spend)}</span>
                      <span className="block text-xs text-slate-500">{t('{n} রেজাল্ট', { n: number(c.results) })}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
