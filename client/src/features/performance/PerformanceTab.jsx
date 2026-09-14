import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { performanceApi } from '@/api/endpoints.js';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { StatTile } from '@/components/ui/StatTile.jsx';
import { PerformanceForm } from './PerformanceForm.jsx';
import { currency, number, percent, roas, dateLabel } from '@/lib/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { t } from '@/i18n/index.jsx';

const PLATFORMS = ['Facebook', 'Instagram', 'Google', 'TikTok', 'YouTube', 'LinkedIn', 'Other'];

export const PerformanceTab = () => {
  const { cycle } = useOutletContext();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ week_no: '', platform: '' });

  const params = {
    cycle_id: cycle.id,
    week_no: filters.week_no || undefined,
    platform: filters.platform || undefined,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['performance', cycle.id, filters],
    queryFn: () => performanceApi.list(params),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['performance'] });
    qc.invalidateQueries({ queryKey: ['control'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: (payload) =>
      payload.id
        ? performanceApi.update(payload)
        : performanceApi.create({ ...payload, cycle_id: cycle.id }),
    onSuccess: () => {
      toast.success(t('এন্ট্রি সংরক্ষিত হয়েছে'));
      invalidate();
      setEditing(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: performanceApi.remove,
    onSuccess: () => {
      toast.success(t('এন্ট্রি মুছে ফেলা হয়েছে'));
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const totals = data.meta.totals;
  const editable = can('admin', 'manager', 'media_buyer');

  const columns = [
    { key: 'entry_date', header: 'তারিখ', render: (r) => dateLabel(r.entry_date) },
    { key: 'week_no', header: 'সপ্তাহ', render: (r) => t('সপ্তাহ {n}', { n: r.week_no }) },
    { key: 'platform', header: 'প্ল্যাটফর্ম' },
    { key: 'spend', header: 'স্পেন্ড (৳)', align: 'right', render: (r) => currency(r.spend) },
    { key: 'impressions', header: 'ইমপ্রেশন', align: 'right', render: (r) => number(r.impressions) },
    { key: 'clicks', header: 'ক্লিক', align: 'right', render: (r) => number(r.clicks) },
    { key: 'ctr', header: 'CTR', align: 'right', render: (r) => percent(r.ctr) },
    { key: 'cpc', header: 'CPC (৳)', align: 'right', render: (r) => currency(r.cpc) },
    { key: 'conversions', header: 'কনভার্সন', align: 'right', render: (r) => number(r.conversions) },
    { key: 'revenue', header: 'রেভিনিউ (৳)', align: 'right', render: (r) => currency(r.revenue) },
    { key: 'roas', header: 'ROAS', align: 'right', render: (r) => roas(r.roas) },
    { key: 'note', header: 'নোট', render: (r) => r.note || '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        editable && (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
              এডিট
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-600"
              onClick={() => window.confirm(t('এই এন্ট্রি মুছে ফেলবেন?')) && remove.mutate(row.id)}
            >
              ✕
            </Button>
          </div>
        ),
    },
  ];

  const footer = {
    entry_date: 'মোট / এভারেজ',
    spend: currency(totals.spend),
    impressions: number(totals.impressions),
    clicks: number(totals.clicks),
    ctr: percent(totals.ctr),
    cpc: currency(totals.cpc),
    conversions: number(totals.conversions),
    revenue: currency(totals.revenue),
    roas: roas(totals.roas),
  };

  const weekOptions = Array.from({ length: cycle.weeks_count }, (_, i) => ({
    value: String(i + 1),
    label: t('সপ্তাহ {n}', { n: i + 1 }),
  }));

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="মোট স্পেন্ড" value={currency(totals.spend)} />
        <StatTile label="মোট রেভিনিউ" value={currency(totals.revenue)} />
        <StatTile label="মোট কনভার্সন" value={number(totals.conversions)} />
        <StatTile label="রিয়েল ROAS" value={roas(totals.roas)} hint={`CTR ${percent(totals.ctr)} · CPC ${currency(totals.cpc)}`} />
      </div>

      <Card>
        <CardHeader
          title="পারফরম্যান্স ট্র্যাকার"
          subtitle="প্রতিদিনের প্রকৃত অ্যাড পারফরম্যান্স"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="w-36 py-1.5"
                placeholder="সব সপ্তাহ"
                value={filters.week_no}
                options={weekOptions}
                onChange={(e) => setFilters({ ...filters, week_no: e.target.value })}
              />
              <Select
                className="w-40 py-1.5"
                placeholder="সব প্ল্যাটফর্ম"
                value={filters.platform}
                options={PLATFORMS}
                onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
              />
              {editable && <Button onClick={() => setEditing({})}>+ এন্ট্রি</Button>}
            </div>
          }
        />
        <Table columns={columns} rows={data.rows} footer={footer} empty="এখনো কোনো ডেটা এন্ট্রি হয়নি" />
      </Card>

      {editing && (
        <PerformanceForm
          open
          cycle={cycle}
          initial={editing.id ? editing : null}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => save.mutate(editing.id ? { ...payload, id: editing.id } : payload)}
        />
      )}
    </>
  );
};
