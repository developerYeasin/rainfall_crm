import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cyclesApi } from '@/api/endpoints.js';
import { Card, CardHeader, CardBody } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { CycleForm } from './CycleForm.jsx';
import { currency, number, percent, roas } from '@/lib/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { t } from '@/i18n/index.jsx';

const AssumptionRow = ({ label, value }) => (
  <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
    <span className="text-sm text-slate-600">{t(label)}</span>
    <span className="text-sm font-semibold text-slate-900">{value}</span>
  </div>
);

export const ProjectionTab = () => {
  const { cycle } = useOutletContext();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [budgets, setBudgets] = useState({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cycles', cycle.id, 'projection'],
    queryFn: () => cyclesApi.projection(cycle.id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cycles'] });
    qc.invalidateQueries({ queryKey: ['control'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const updateCycle = useMutation({
    mutationFn: (payload) => cyclesApi.update({ id: cycle.id, ...payload }),
    onSuccess: () => {
      toast.success(t('অ্যাসাম্পশন আপডেট হয়েছে'));
      invalidate();
      setEditing(false);
      setBudgets({});
    },
    onError: (err) => toast.error(err.message),
  });

  const updateWeek = useMutation({
    mutationFn: ({ weekNo, budget }) => cyclesApi.updateWeek({ id: cycle.id, weekNo, budget }),
    onSuccess: () => {
      toast.success(t('সাপ্তাহিক বাজেট আপডেট হয়েছে'));
      invalidate();
      setBudgets({});
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const editable = can('admin', 'manager', 'media_buyer');

  const columns = [
    { key: 'label', header: 'সপ্তাহ' },
    {
      key: 'budget',
      header: 'বাজেট (৳)',
      align: 'right',
      render: (row) =>
        editable ? (
          <div className="flex justify-end gap-1">
            <Input
              type="number"
              className="w-28 py-1 text-right text-sm"
              value={budgets[row.week_no] ?? row.budget}
              onChange={(e) => setBudgets({ ...budgets, [row.week_no]: e.target.value })}
            />
            {budgets[row.week_no] !== undefined && Number(budgets[row.week_no]) !== Number(row.budget) && (
              <Button
                size="sm"
                loading={updateWeek.isPending}
                onClick={() => updateWeek.mutate({ weekNo: row.week_no, budget: Number(budgets[row.week_no]) })}
              >
                ✓
              </Button>
            )}
          </div>
        ) : (
          currency(row.budget)
        ),
    },
    { key: 'clicks', header: 'প্রত্যাশিত ক্লিক', align: 'right', render: (r) => number(r.clicks) },
    { key: 'impressions', header: 'প্রত্যাশিত ইমপ্রেশন', align: 'right', render: (r) => number(r.impressions) },
    { key: 'conversions', header: 'প্রত্যাশিত কনভার্সন', align: 'right', render: (r) => number(r.conversions) },
    { key: 'revenue', header: 'প্রত্যাশিত রেভিনিউ', align: 'right', render: (r) => currency(r.revenue) },
    { key: 'roas', header: 'প্রত্যাশিত ROAS', align: 'right', render: (r) => roas(r.roas) },
  ];

  const footer = {
    label: data.total.label,
    budget: currency(data.total.budget),
    clicks: number(data.total.clicks),
    impressions: number(data.total.impressions),
    conversions: number(data.total.conversions),
    revenue: currency(data.total.revenue),
    roas: roas(data.total.roas),
  };

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <Card className="lg:col-span-1">
        <CardHeader
          title="ধাপ ১: অ্যাসাম্পশন"
          actions={
            editable && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                এডিট
              </Button>
            )
          }
        />
        <CardBody className="py-1">
          <AssumptionRow label="মোট মাসিক অ্যাড বাজেট" value={currency(data.assumptions.monthly_budget)} />
          <AssumptionRow label="প্রত্যাশিত CTR" value={percent(data.assumptions.expected_ctr)} />
          <AssumptionRow label="প্রত্যাশিত CPC" value={currency(data.assumptions.expected_cpc)} />
          <AssumptionRow label="কনভার্সন রেট" value={percent(data.assumptions.expected_conversion_rate)} />
          <AssumptionRow label="গড় অর্ডার ভ্যালু (AOV)" value={currency(data.assumptions.aov)} />
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader title="ধাপ ২: সাপ্তাহিক টার্গেট" subtitle="অ্যাসাম্পশন থেকে অটো ক্যালকুলেটেড" />
        <Table columns={columns} rows={data.weeks} footer={footer} rowKey={(r) => r.week_no} />
      </Card>

      {editing && (
        <CycleForm
          open
          initial={cycle}
          saving={updateCycle.isPending}
          onClose={() => setEditing(false)}
          onSubmit={(payload) => updateCycle.mutate(payload)}
        />
      )}
    </div>
  );
};
