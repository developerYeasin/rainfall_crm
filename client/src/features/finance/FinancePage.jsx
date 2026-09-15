import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { clientsApi, financeApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { StatTile } from '@/components/ui/StatTile.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { Field, Input, Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { currency, dateLabel, number, today } from '@/lib/format.js';
import { downloadFile } from '@/lib/download.js';
import { InvoiceStateBadge, INVOICE_STATE_OPTIONS } from './InvoiceStateBadge.jsx';
import { t } from '@/i18n/index.jsx';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [0, 1, 2].map((i) => ({ value: currentYear - i, label: String(currentYear - i) }));
const EXPENSE_OPTIONS = [
  { value: 'salary', label: 'বেতন' },
  { value: 'software', label: 'সফটওয়্যার / টুলস' },
  { value: 'rent', label: 'ভাড়া' },
  { value: 'utility', label: 'বিল / ইউটিলিটি' },
  { value: 'tax', label: 'ট্যাক্স' },
  { value: 'marketing', label: 'মার্কেটিং' },
  { value: 'other', label: 'অন্যান্য' },
];
const EXPENSE_LABEL = Object.fromEntries(EXPENSE_OPTIONS.map((o) => [o.value, o.label]));
const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const monthName = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString('en-US', { month: 'short' });

const InvoiceForm = ({ saving, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    client_id: '',
    period_month: `${today().slice(0, 7)}-01`,
    issue_date: today(),
    due_date: addDays(today(), 7),
    agency_fee: '',
    other_charges: 0,
    note: '',
  });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const clients = useQuery({ queryKey: ['clients', 'options'], queryFn: () => clientsApi.list({ limit: 200, sortBy: 'c.name', sortDir: 'asc' }) });
  const options = clients.data?.rows || [];

  return (
    <Modal
      open
      onClose={onClose}
      title="নতুন ইনভয়েস"
      subtitle="ক্লায়েন্ট নোটিফিকেশন ও ইমেইল পাবে"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button
            loading={saving}
            onClick={() =>
              onSubmit({
                ...form,
                client_id: Number(form.client_id),
                agency_fee: form.agency_fee === '' ? undefined : Number(form.agency_fee),
                other_charges: Number(form.other_charges || 0),
                note: form.note || null,
              })
            }
          >
            তৈরি করুন
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ক্লায়েন্ট *" className="sm:col-span-2">
          <Select
            value={form.client_id}
            placeholder="ক্লায়েন্ট বেছে নিন"
            onChange={(e) => {
              const c = options.find((o) => o.id === Number(e.target.value));
              setForm({ ...form, client_id: e.target.value, agency_fee: c?.monthly_retainer ?? form.agency_fee });
            }}
            options={options.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="সার্ভিস মাস *">
          <Input type="month" value={form.period_month.slice(0, 7)} onChange={(e) => setForm({ ...form, period_month: `${e.target.value}-01` })} />
        </Field>
        <Field label="ইস্যু তারিখ *">
          <Input type="date" value={form.issue_date} onChange={set('issue_date')} />
        </Field>
        <Field label="শেষ তারিখ *">
          <Input type="date" value={form.due_date} onChange={set('due_date')} />
        </Field>
        <Field label="এজেন্সি ফি (৳)" hint="খালি রাখলে মাসিক রিটেইনার">
          <Input type="number" min="0" value={form.agency_fee} onChange={set('agency_fee')} />
        </Field>
        <Field label="অন্যান্য চার্জ (৳)">
          <Input type="number" min="0" value={form.other_charges} onChange={set('other_charges')} />
        </Field>
        <Field label="নোট">
          <Input value={form.note} onChange={set('note')} />
        </Field>
      </div>
    </Modal>
  );
};

const PaymentForm = ({ invoice, saving, onClose, onSubmit }) => {
  const [form, setForm] = useState({ amount: invoice.balance, paid_on: today(), method: '', reference: '' });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={t('পেমেন্ট — {no}', { no: invoice.invoice_no })}
      subtitle={t('বাকি {v}', { v: currency(invoice.balance) })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button loading={saving} onClick={() => onSubmit({ ...form, amount: Number(form.amount), method: form.method || null, reference: form.reference || null })}>
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="টাকার পরিমাণ *">
          <Input type="number" min="0" value={form.amount} onChange={set('amount')} />
        </Field>
        <Field label="তারিখ *">
          <Input type="date" value={form.paid_on} onChange={set('paid_on')} />
        </Field>
        <Field label="মাধ্যম" hint="যেমন bKash, ব্যাংক, ক্যাশ">
          <Input value={form.method} onChange={set('method')} />
        </Field>
        <Field label="রেফারেন্স">
          <Input value={form.reference} onChange={set('reference')} />
        </Field>
      </div>
    </Modal>
  );
};

const ExpenseForm = ({ saving, onClose, onSubmit }) => {
  const [form, setForm] = useState({ expense_date: today(), category: 'salary', amount: '', note: '' });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="এজেন্সি খরচ"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button loading={saving} onClick={() => onSubmit({ ...form, amount: Number(form.amount), note: form.note || null })}>
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="তারিখ *">
          <Input type="date" value={form.expense_date} onChange={set('expense_date')} />
        </Field>
        <Field label="খাত">
          <Select value={form.category} onChange={set('category')} options={EXPENSE_OPTIONS} />
        </Field>
        <Field label="টাকার পরিমাণ *">
          <Input type="number" min="0" value={form.amount} onChange={set('amount')} />
        </Field>
        <Field label="নোট">
          <Input value={form.note} onChange={set('note')} />
        </Field>
      </div>
    </Modal>
  );
};

/** Agency P&L — admin only, since it is the agency's internal books. */
const AgencyPnl = () => {
  const qc = useQueryClient();
  const [year, setYear] = useState(currentYear);
  const [addingExpense, setAddingExpense] = useState(false);
  const [exporting, setExporting] = useState(false);

  const pnl = useQuery({ queryKey: ['finance', 'pnl', year], queryFn: () => financeApi.pnl(year) });
  const expenses = useQuery({
    queryKey: ['finance', 'expenses', year],
    queryFn: () => financeApi.expenses({ from: `${year}-01-01`, to: `${year}-12-31` }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['finance'] });
  const createExpense = useMutation({
    mutationFn: financeApi.createExpense,
    onSuccess: () => {
      toast.success(t('খরচ যোগ হয়েছে'));
      invalidate();
      setAddingExpense(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const removeExpense = useMutation({
    mutationFn: financeApi.removeExpense,
    onSuccess: () => {
      toast.success(t('মুছে ফেলা হয়েছে'));
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const exportPnl = async () => {
    setExporting(true);
    try {
      await downloadFile('/finance/export/pnl.xlsx', { year });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (pnl.isLoading) return <Loading />;
  if (pnl.error) return <ErrorState error={pnl.error} onRetry={pnl.refetch} />;
  const { months, totals, outstanding, by_client: byClient } = pnl.data;

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{t('এজেন্সি P&L')}</h2>
        <div className="flex flex-wrap gap-2">
          <Select className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} options={YEAR_OPTIONS} />
          <Button variant="secondary" loading={exporting} onClick={exportPnl}>
            Excel এক্সপোর্ট
          </Button>
          <Button variant="secondary" onClick={() => setAddingExpense(true)}>
            + এজেন্সি খরচ
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="ফি ইনভয়েস করা" value={currency(totals.invoiced)} />
        <StatTile label="ফি আদায়" value={currency(totals.collected)} />
        <StatTile label="এজেন্সি খরচ" value={currency(totals.expenses)} />
        <StatTile label="প্রফিট (ক্যাশ)" value={currency(totals.profit)} tone={totals.profit < 0 ? 'danger' : undefined} hint={t('মোট বাকি {v}', { v: currency(outstanding) })} />
      </div>

      <Card>
        <CardHeader title="মাসিক আয় ও খরচ" />
        <div className="h-64 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months.map((m) => ({ ...m, label: monthName(m.month) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => number(v)} />
              <Tooltip formatter={(v) => currency(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="collected" name={t('আদায়')} fill="#059669" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name={t('খরচ')} fill="#f43f5e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="ক্লায়েন্ট অনুযায়ী ফি" />
          <Table
            columns={[
              { key: 'name', header: 'ক্লায়েন্ট' },
              { key: 'invoiced', header: 'ইনভয়েস', align: 'right', render: (r) => currency(r.invoiced) },
              { key: 'collected', header: 'আদায়', align: 'right', render: (r) => currency(r.collected) },
              { key: 'outstanding', header: 'বাকি', align: 'right', render: (r) => currency(r.outstanding) },
            ]}
            rows={byClient}
            empty="কোনো ইনভয়েস নেই"
          />
        </Card>
        <Card>
          <CardHeader title="এজেন্সি খরচ" />
          <Table
            columns={[
              { key: 'expense_date', header: 'তারিখ', render: (r) => dateLabel(r.expense_date) },
              { key: 'category', header: 'খাত', render: (r) => t(EXPENSE_LABEL[r.category] || r.category) },
              { key: 'amount', header: 'টাকা', align: 'right', render: (r) => currency(r.amount) },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (r) => (
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => window.confirm(t('এই খরচ মুছবেন?')) && removeExpense.mutate(r.id)}>
                    মুছুন
                  </Button>
                ),
              },
            ]}
            rows={expenses.data || []}
            empty="কোনো খরচ নেই"
          />
        </Card>
      </div>

      {addingExpense && <ExpenseForm saving={createExpense.isPending} onClose={() => setAddingExpense(false)} onSubmit={(p) => createExpense.mutate(p)} />}
    </div>
  );
};

export const FinancePage = () => {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [state, setState] = useState('');
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(null);

  const invoices = useQuery({
    queryKey: ['finance', 'invoices', state],
    queryFn: () => financeApi.invoices({ state: state || undefined }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['finance'] });
  const onError = (err) => toast.error(err.message);

  const createInvoice = useMutation({
    mutationFn: financeApi.createInvoice,
    onSuccess: () => {
      toast.success(t('ইনভয়েস তৈরি হয়েছে'));
      invalidate();
      setCreating(false);
    },
    onError,
  });
  const addPayment = useMutation({
    mutationFn: financeApi.addPayment,
    onSuccess: () => {
      toast.success(t('পেমেন্ট যোগ হয়েছে'));
      invalidate();
      setPaying(null);
    },
    onError,
  });
  const cancelInvoice = useMutation({
    mutationFn: (id) => financeApi.updateInvoice({ id, status: 'cancelled' }),
    onSuccess: () => {
      toast.success(t('ইনভয়েস বাতিল হয়েছে'));
      invalidate();
    },
    onError,
  });

  const columns = [
    { key: 'invoice_no', header: 'ইনভয়েস', render: (r) => <span className="font-medium text-slate-800">{r.invoice_no}</span> },
    {
      key: 'client_name',
      header: 'ক্লায়েন্ট',
      render: (r) => (
        <Link to={`/clients/${r.client_id}/business/accounting`} className="text-brand-700 hover:underline">
          {r.client_name}
        </Link>
      ),
    },
    { key: 'period_month', header: 'সার্ভিস মাস', render: (r) => r.period_month.slice(0, 7) },
    { key: 'due_date', header: 'শেষ তারিখ', render: (r) => dateLabel(r.due_date) },
    { key: 'total', header: 'মোট', align: 'right', render: (r) => currency(r.total) },
    { key: 'paid', header: 'পরিশোধ', align: 'right', render: (r) => currency(r.paid) },
    { key: 'balance', header: 'বাকি', align: 'right', render: (r) => currency(r.balance) },
    { key: 'state', header: 'স্ট্যাটাস', render: (r) => <InvoiceStateBadge state={r.state} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        r.state !== 'cancelled' && (
          <div className="flex justify-end gap-1">
            {r.balance > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setPaying(r)}>
                + পেমেন্ট
              </Button>
            )}
            {r.paid === 0 && (
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => window.confirm(t('এই ইনভয়েস বাতিল করবেন?')) && cancelInvoice.mutate(r.id)}>
                বাতিল করুন
              </Button>
            )}
          </div>
        ),
    },
  ];

  const meta = invoices.data?.meta;

  return (
    <>
      <PageHeader
        title="ফাইন্যান্স"
        subtitle="এজেন্সি ফি, ইনভয়েস, পেমেন্ট ও বাকি — ক্লায়েন্টের নিজের হিসাব থেকে আলাদা"
        actions={<Button onClick={() => setCreating(true)}>+ নতুন ইনভয়েস</Button>}
      />

      {meta && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="মোট ইনভয়েস" value={currency(meta.invoiced)} />
          <StatTile label="আদায় হয়েছে" value={currency(meta.collected)} />
          <StatTile label="বাকি" value={currency(meta.outstanding)} />
          <StatTile label="মেয়াদোত্তীর্ণ" value={currency(meta.overdue)} tone={meta.overdue > 0 ? 'danger' : undefined} />
        </div>
      )}

      <Card>
        <CardHeader
          title="ইনভয়েস"
          actions={<Select className="w-40" value={state} placeholder="সব স্ট্যাটাস" onChange={(e) => setState(e.target.value)} options={INVOICE_STATE_OPTIONS} />}
        />
        {invoices.isLoading ? (
          <Loading />
        ) : invoices.error ? (
          <ErrorState error={invoices.error} onRetry={invoices.refetch} />
        ) : (
          <Table columns={columns} rows={invoices.data.rows} empty="কোনো ইনভয়েস নেই" minWidth={1000} />
        )}
      </Card>

      {can('admin') && <AgencyPnl />}

      {creating && <InvoiceForm saving={createInvoice.isPending} onClose={() => setCreating(false)} onSubmit={(p) => createInvoice.mutate(p)} />}
      {paying && (
        <PaymentForm invoice={paying} saving={addPayment.isPending} onClose={() => setPaying(null)} onSubmit={(p) => addPayment.mutate({ ...p, id: paying.id })} />
      )}
    </>
  );
};
