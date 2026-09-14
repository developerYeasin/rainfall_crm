import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { businessApi } from '@/api/endpoints.js';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { StatTile } from '@/components/ui/StatTile.jsx';
import { Field, Input, Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { currency, dateLabel, roas, today } from '@/lib/format.js';
import { EXPENSE_CATEGORY_LABEL } from '@/lib/status.js';
import { t } from '@/i18n/index.jsx';

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABEL).map(([value, label]) => ({ value, label }));

const ExpenseForm = ({ initial, saving, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    expense_date: initial?.expense_date || today(),
    category: initial?.category || 'marketing',
    amount: initial?.amount ?? '',
    note: initial?.note || '',
  });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={initial?.id ? 'খরচ সম্পাদনা' : 'নতুন খরচ'}
      subtitle="ফেসবুক/গুগল অ্যাড স্পেন্ড পারফরম্যান্স ট্র্যাকার থেকে নিজে থেকেই যোগ হয়"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button loading={saving} onClick={() => onSubmit({ ...form, note: form.note || null })}>
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="তারিখ *">
          <Input type="date" value={form.expense_date} onChange={set('expense_date')} />
        </Field>
        <Field label="টাকা *">
          <Input type="number" min="0" value={form.amount} onChange={set('amount')} />
        </Field>
        <Field label="খাত" className="col-span-2">
          <Select value={form.category} onChange={set('category')} options={CATEGORY_OPTIONS} />
        </Field>
        <Field label="বিবরণ" className="col-span-2">
          <Input value={form.note} onChange={set('note')} />
        </Field>
      </div>
    </Modal>
  );
};

export const ExpensesTab = () => {
  const { clientId, range, canWrite } = useOutletContext();
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState(null);

  const params = { ...range, category: category || undefined, limit: 200 };
  const expenses = useQuery({
    queryKey: ['business', clientId, 'expenses', params],
    queryFn: () => businessApi.expenses(clientId, params),
  });
  // Same key as the summary tab, so switching tabs reuses the cached result.
  const summary = useQuery({
    queryKey: ['business', clientId, 'summary', range],
    queryFn: () => businessApi.summary(clientId, range),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['business', clientId] });
  const save = useMutation({
    mutationFn: (payload) =>
      payload.id ? businessApi.updateExpense(clientId, payload) : businessApi.createExpense(clientId, payload),
    onSuccess: () => {
      toast.success(t('খরচ সংরক্ষিত হয়েছে'));
      invalidate();
      setEditing(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const remove = useMutation({
    mutationFn: (id) => businessApi.removeExpense(clientId, id),
    onSuccess: () => {
      toast.success(t('খরচ মুছে ফেলা হয়েছে'));
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (expenses.isLoading || summary.isLoading) return <Loading />;
  if (expenses.error) return <ErrorState error={expenses.error} onRetry={expenses.refetch} />;
  if (summary.error) return <ErrorState error={summary.error} onRetry={summary.refetch} />;

  const { marketing, expenses: totals, sales } = summary.data;

  const columns = [
    { key: 'expense_date', header: 'তারিখ', render: (r) => dateLabel(r.expense_date) },
    {
      key: 'category',
      header: 'খাত',
      render: (r) => <Badge tone={r.category === 'marketing' ? 'info' : 'muted'}>{EXPENSE_CATEGORY_LABEL[r.category]}</Badge>,
    },
    { key: 'note', header: 'বিবরণ', render: (r) => r.note || '—' },
    { key: 'amount', header: 'টাকা', align: 'right', render: (r) => currency(r.amount) },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                  এডিট
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600"
                  onClick={() => window.confirm(t('এই খরচ মুছবেন?')) && remove.mutate(r.id)}
                >
                  মুছুন
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const categoryColumns = [
    { key: 'category', header: 'খাত', render: (r) => t(r.label) },
    { key: 'total', header: 'টাকা', align: 'right', render: (r) => currency(r.total) },
  ];
  const categoryRows = [
    { category: 'ad_spend', label: 'অ্যাড স্পেন্ড (ট্র্যাকার)', total: marketing.ad_spend },
    ...totals.by_category.map((e) => ({ ...e, label: EXPENSE_CATEGORY_LABEL[e.category] })),
  ].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="অ্যাড স্পেন্ড" value={currency(marketing.ad_spend)} hint="ফেসবুক/গুগল ইত্যাদি" />
        <StatTile label="মোট মার্কেটিং" value={currency(marketing.total)} hint={t('অন্যান্য {n}', { n: currency(marketing.other_marketing) })} />
        <StatTile
          label="মার্কেটিং রিটার্ন"
          value={roas(marketing.roas)}
          hint={t('{sales} সেল · প্রতি অর্ডারে {cpo}', {
            sales: currency(sales.revenue),
            cpo: currency(marketing.cost_per_order),
          })}
        />
        <StatTile label="মোট খরচ" value={currency(totals.total + marketing.ad_spend)} hint="অ্যাড + সব খাত" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="খরচের তালিকা"
            subtitle={t('এই ফিল্টারে মোট {n}', { n: currency(expenses.data.meta.amount) })}
            actions={
              <>
                <Select
                  className="w-44"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="সব খাত"
                  options={CATEGORY_OPTIONS}
                />
                {canWrite && <Button onClick={() => setEditing({})}>+ নতুন খরচ</Button>}
              </>
            }
          />
          <Table columns={columns} rows={expenses.data.rows} empty="কোনো খরচ নেই" />
        </Card>

        <Card>
          <CardHeader title="খাতভিত্তিক খরচ" />
          <Table columns={categoryColumns} rows={categoryRows} rowKey={(r) => r.category} />
        </Card>
      </div>

      {editing && (
        <ExpenseForm
          initial={editing}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => save.mutate(editing.id ? { ...payload, id: editing.id } : payload)}
        />
      )}
    </div>
  );
};
