import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { businessApi } from '@/api/endpoints.js';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { Field, Input, Select, Textarea } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { currency, number, dateLabel, today } from '@/lib/format.js';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/lib/status.js';
import { t } from '@/i18n/index.jsx';

// Pre-orders are retired: only real orders are taken. Old pre-order rows still show their label.
const STATUS_OPTIONS = Object.keys(ORDER_STATUS_LABEL)
  .filter((value) => value !== 'pre_order')
  .map((value) => ({
  value,
  get label() {
    return ORDER_STATUS_LABEL[value];
  },
}));
/** A legacy pre-order keeps its own value in the picker so it can be moved to confirmed. */
const optionsFor = (current) =>
  current === 'pre_order' ? [{ value: 'pre_order', label: ORDER_STATUS_LABEL.pre_order }, ...STATUS_OPTIONS] : STATUS_OPTIONS;
const PAGE_SIZE = 50;

const OrderForm = ({ initial, products, saving, onClose, onSubmit }) => {
  const first = products.find((p) => p.id === initial?.product_id) || products[0];
  const [form, setForm] = useState({
    product_id: initial?.product_id ?? first?.id ?? '',
    order_date: initial?.order_date || today(),
    status: initial?.status || 'confirmed',
    qty: initial?.qty ?? 1,
    unit_price: initial?.unit_price ?? first?.sale_price ?? '',
    discount: initial?.discount ?? 0,
    paid_amount: initial?.paid_amount ?? 0,
    customer_name: initial?.customer_name || '',
    customer_phone: initial?.customer_phone || '',
    note: initial?.note || '',
    source: initial?.source || '',
  });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const product = products.find((p) => p.id === Number(form.product_id));
  const amount = Number(form.qty || 0) * Number(form.unit_price || 0) - Number(form.discount || 0);
  const due = amount - Number(form.paid_amount || 0);

  const submit = () =>
    onSubmit({
      ...form,
      unit_price: form.unit_price || 0,
      discount: form.discount || 0,
      paid_amount: form.paid_amount || 0,
      customer_name: form.customer_name || null,
      customer_phone: form.customer_phone || null,
      note: form.note || null,
      source: form.source || null,
    });

  return (
    <Modal
      open
      onClose={onClose}
      title={initial?.id ? 'অর্ডার সম্পাদনা' : 'নতুন অর্ডার'}
      subtitle="কনফার্মড অর্ডার ডেলিভারি হলে ডেলিভারড করুন"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button loading={saving} onClick={submit}>
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="প্রোডাক্ট *" className="sm:col-span-2">
          <Select
            value={form.product_id}
            onChange={(e) => {
              const next = products.find((p) => p.id === Number(e.target.value));
              setForm({ ...form, product_id: e.target.value, unit_price: next?.sale_price ?? form.unit_price });
            }}
            options={products.map((p) => ({ value: p.id, label: t('{name} — স্টক {n}', { name: p.name, n: p.in_stock }) }))}
          />
        </Field>
        <Field label="স্ট্যাটাস">
          <Select value={form.status} onChange={set('status')} options={optionsFor(form.status)} />
        </Field>
        <Field label="তারিখ *">
          <Input type="date" value={form.order_date} onChange={set('order_date')} />
        </Field>
        <Field label="পরিমাণ (পিস) *">
          <Input type="number" min="1" value={form.qty} onChange={set('qty')} />
        </Field>
        <Field label="দাম (প্রতি পিস)">
          <Input type="number" min="0" value={form.unit_price} onChange={set('unit_price')} />
        </Field>
        <Field label="ডিসকাউন্ট (৳)">
          <Input type="number" min="0" value={form.discount} onChange={set('discount')} />
        </Field>
        <Field label={form.status === 'pre_order' ? 'অগ্রিম পেমেন্ট (৳)' : 'পেমেন্ট পাওয়া (৳)'}>
          <Input type="number" min="0" value={form.paid_amount} onChange={set('paid_amount')} />
        </Field>
        <div className="flex items-end">
          <Button variant="secondary" className="w-full" onClick={() => setForm({ ...form, paid_amount: Math.max(amount, 0) })}>
            পুরো টাকা পেয়েছি
          </Button>
        </div>
        <Field label="কাস্টমারের নাম">
          <Input value={form.customer_name} onChange={set('customer_name')} />
        </Field>
        <Field label="ফোন">
          <Input value={form.customer_phone} onChange={set('customer_phone')} />
        </Field>
        <Field label="নোট">
          <Input value={form.note} onChange={set('note')} />
        </Field>
        <Field label="সোর্স (কোন অ্যাড/ক্যাম্পেইন)" className="sm:col-span-3" hint="জানা থাকলে — যেমন Eid Collection, Retargeting, অর্গানিক">
          <Input value={form.source} onChange={set('source')} />
        </Field>

        <div className="sm:col-span-3 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div>
            <p className="text-xs text-slate-500">{t('মোট')}</p>
            <p className="font-semibold text-slate-900">{currency(amount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t('বাকি')}</p>
            <p className={clsx('font-semibold', due > 0 ? 'text-rose-600' : 'text-slate-900')}>{currency(Math.max(due, 0))}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t('আনুমানিক লাভ')}</p>
            <p className="font-semibold text-slate-900">
              {product ? currency(amount - Number(form.qty || 0) * Number(product.cost_price)) : '—'}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export const OrdersTab = () => {
  const { clientId, range, canWrite } = useOutletContext();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);

  const params = { ...range, status: status || undefined, search: search || undefined, page, limit: PAGE_SIZE };
  const orders = useQuery({
    queryKey: ['business', clientId, 'orders', params],
    queryFn: () => businessApi.orders(clientId, params),
    placeholderData: (prev) => prev,
  });
  const products = useQuery({
    queryKey: ['business', clientId, 'products'],
    queryFn: () => businessApi.products(clientId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['business', clientId] });
  const onError = (err) => toast.error(err.message);

  const save = useMutation({
    mutationFn: (payload) =>
      payload.id ? businessApi.updateOrder(clientId, payload) : businessApi.createOrder(clientId, payload),
    onSuccess: () => {
      toast.success(t('অর্ডার সংরক্ষিত হয়েছে'));
      invalidate();
      setEditing(null);
    },
    onError,
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, status: next }) => businessApi.updateOrder(clientId, { id, status: next }),
    onSuccess: () => {
      toast.success(t('স্ট্যাটাস আপডেট হয়েছে'));
      invalidate();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id) => businessApi.removeOrder(clientId, id),
    onSuccess: () => {
      toast.success(t('অর্ডার মুছে ফেলা হয়েছে'));
      invalidate();
    },
    onError,
  });

  if (orders.isLoading) return <Loading />;
  if (orders.error) return <ErrorState error={orders.error} onRetry={orders.refetch} />;

  const { rows, meta } = orders.data;
  const counts = meta.status_counts || {};
  const allCount = Object.values(counts).reduce((sum, c) => sum + c.orders, 0);
  const activeProducts = (products.data || []).filter((p) => p.is_active || p.id === editing?.product_id);

  const pickStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

  const columns = [
    { key: 'order_date', header: 'তারিখ', render: (r) => dateLabel(r.order_date) },
    {
      key: 'customer_name',
      header: 'কাস্টমার',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.customer_name || '—'}</p>
          {r.customer_phone && <p className="text-xs text-slate-500">{r.customer_phone}</p>}
        </div>
      ),
    },
    {
      key: 'product_name',
      header: 'প্রোডাক্ট',
      render: (r) => (
        <div>
          <p>{r.product_name}</p>
          {r.source && <p className="text-xs text-slate-500">{r.source}</p>}
        </div>
      ),
    },
    { key: 'qty', header: 'পিস', align: 'right', render: (r) => number(r.qty) },
    { key: 'amount', header: 'মোট', align: 'right', render: (r) => currency(r.amount) },
    { key: 'paid_amount', header: 'পেমেন্ট', align: 'right', render: (r) => currency(r.paid_amount) },
    {
      key: 'due',
      header: 'বাকি',
      align: 'right',
      render: (r) =>
        ['returned', 'cancelled'].includes(r.status) ? '—' : (
          <span className={r.due > 0 ? 'font-medium text-rose-600' : undefined}>{currency(r.due)}</span>
        ),
    },
    {
      key: 'profit',
      header: 'লাভ',
      align: 'right',
      render: (r) => (['confirmed', 'delivered'].includes(r.status) ? currency(r.profit) : '—'),
    },
    {
      key: 'status',
      header: 'স্ট্যাটাস',
      render: (r) =>
        canWrite ? (
          <Select
            className="w-32 py-1 text-xs"
            value={r.status}
            options={optionsFor(r.status)}
            disabled={changeStatus.isPending}
            onChange={(e) => changeStatus.mutate({ id: r.id, status: e.target.value })}
          />
        ) : (
          <Badge tone={ORDER_STATUS_TONE[r.status]}>{ORDER_STATUS_LABEL[r.status]}</Badge>
        ),
    },
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
                  onClick={() => window.confirm(t('এই অর্ডার মুছবেন?')) && remove.mutate(r.id)}
                >
                  মুছুন
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const chips = [{ value: '', label: 'সব', count: allCount }].concat(
    STATUS_OPTIONS.map((o) => ({ ...o, count: counts[o.value]?.orders || 0, qty: counts[o.value]?.qty || 0 })),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.value || 'all'}
            type="button"
            onClick={() => pickStatus(chip.value)}
            className={clsx(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition',
              status === chip.value
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {t(chip.label)} <span className="ml-1 font-semibold">{number(chip.count)}</span>
            {chip.qty ? <span className="ml-1 text-xs text-slate-400">{t('({n} পিস)', { n: number(chip.qty) })}</span> : null}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title="অর্ডারসমূহ"
          subtitle={t('{n} টি অর্ডার', { n: number(meta.total) })}
          actions={
            <>
              <Input
                className="w-56"
                placeholder="কাস্টমার, ফোন বা প্রোডাক্ট…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {canWrite && (
                <Button disabled={!activeProducts.length} onClick={() => setEditing({})}>
                  + নতুন অর্ডার
                </Button>
              )}
            </>
          }
        />
        <Table columns={columns} rows={rows} empty="কোনো অর্ডার নেই" />
        {meta.pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            {t('পৃষ্ঠা {page} / {pages}', { page, pages: meta.pages })}
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              আগের
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= meta.pages} onClick={() => setPage(page + 1)}>
              পরের
            </Button>
          </div>
        )}
      </Card>

      {!products.isLoading && !activeProducts.length && canWrite && (
        <p className="text-sm text-slate-500">{t('অর্ডার নিতে আগে "প্রোডাক্ট ও স্টক" ট্যাবে প্রোডাক্ট যোগ করুন।')}</p>
      )}

      {editing && (
        <OrderForm
          initial={editing}
          products={activeProducts}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => save.mutate(editing.id ? { ...payload, id: editing.id } : payload)}
        />
      )}
    </div>
  );
};
