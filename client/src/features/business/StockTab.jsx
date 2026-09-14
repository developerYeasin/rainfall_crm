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
import { Field, Input, Select, Checkbox } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { currency, number, dateLabel, today } from '@/lib/format.js';
import { STOCK_STATUS } from '@/lib/status.js';

const ProductForm = ({ initial, saving, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    name: initial?.name || '',
    sku: initial?.sku || '',
    category: initial?.category || '',
    cost_price: initial?.cost_price ?? '',
    sale_price: initial?.sale_price ?? '',
    opening_stock: initial?.opening_stock ?? 0,
    low_stock_alert: initial?.low_stock_alert ?? 5,
    is_active: initial?.is_active ?? true,
  });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = () =>
    onSubmit({
      ...form,
      sku: form.sku || null,
      category: form.category || null,
      cost_price: form.cost_price || 0,
      sale_price: form.sale_price || 0,
    });

  return (
    <Modal
      open
      onClose={onClose}
      title={initial?.id ? 'প্রোডাক্ট সম্পাদনা' : 'নতুন প্রোডাক্ট'}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="প্রোডাক্টের নাম *" className="sm:col-span-2">
          <Input value={form.name} onChange={set('name')} />
        </Field>
        <Field label="SKU / কোড">
          <Input value={form.sku} onChange={set('sku')} />
        </Field>
        <Field label="ক্যাটাগরি">
          <Input value={form.category} onChange={set('category')} />
        </Field>
        <Field label="কেনা দাম (প্রতি পিস)">
          <Input type="number" min="0" value={form.cost_price} onChange={set('cost_price')} />
        </Field>
        <Field label="বিক্রয় মূল্য (প্রতি পিস)">
          <Input type="number" min="0" value={form.sale_price} onChange={set('sale_price')} />
        </Field>
        <Field label="শুরুর স্টক" hint="সিস্টেমে আসার আগে যত পিস ছিল">
          <Input type="number" min="0" value={form.opening_stock} onChange={set('opening_stock')} />
        </Field>
        <Field label="কম স্টক অ্যালার্ট" hint="এর নিচে গেলে সতর্ক করবে">
          <Input type="number" min="0" value={form.low_stock_alert} onChange={set('low_stock_alert')} />
        </Field>
        {initial?.id && (
          <Checkbox
            label="সক্রিয় (বিক্রি চলছে)"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
        )}
      </div>
    </Modal>
  );
};

const PurchaseForm = ({ products, saving, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    product_id: products[0]?.id ?? '',
    purchase_date: today(),
    qty: '',
    unit_cost: products[0]?.cost_price ?? '',
    supplier: '',
  });
  const product = products.find((p) => p.id === Number(form.product_id));

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="স্টক যোগ করুন"
      subtitle="নতুন মাল কেনা বা আসা"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button
            loading={saving}
            onClick={() => onSubmit({ ...form, supplier: form.supplier || null, unit_cost: form.unit_cost || 0 })}
          >
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="প্রোডাক্ট *">
          <Select
            value={form.product_id}
            onChange={(e) => {
              const next = products.find((p) => p.id === Number(e.target.value));
              setForm({ ...form, product_id: e.target.value, unit_cost: next?.cost_price ?? '' });
            }}
            options={products.map((p) => ({ value: p.id, label: `${p.name} (স্টক ${p.in_stock})` }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="তারিখ *">
            <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          </Field>
          <Field label="পরিমাণ (পিস) *">
            <Input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </Field>
          <Field label="কেনা দাম (প্রতি পিস)">
            <Input type="number" min="0" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
          </Field>
          <Field label="সাপ্লায়ার">
            <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </Field>
        </div>
        {product && form.qty && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            মোট খরচ {currency(Number(form.qty) * Number(form.unit_cost || 0))} · নতুন স্টক হবে{' '}
            {number(product.in_stock + Number(form.qty))} পিস
          </p>
        )}
      </div>
    </Modal>
  );
};

export const StockTab = () => {
  const { clientId, range, canWrite } = useOutletContext();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [addingStock, setAddingStock] = useState(false);

  const products = useQuery({
    queryKey: ['business', clientId, 'products'],
    queryFn: () => businessApi.products(clientId),
  });
  const purchases = useQuery({
    queryKey: ['business', clientId, 'purchases', range],
    queryFn: () => businessApi.purchases(clientId, range),
  });

  const onDone = (message) => () => {
    toast.success(message);
    qc.invalidateQueries({ queryKey: ['business', clientId] });
    setEditing(null);
    setAddingStock(false);
  };
  const onError = (err) => toast.error(err.message);

  const saveProduct = useMutation({
    mutationFn: (payload) =>
      payload.id ? businessApi.updateProduct(clientId, payload) : businessApi.createProduct(clientId, payload),
    onSuccess: onDone('প্রোডাক্ট সংরক্ষিত হয়েছে'),
    onError,
  });
  const removeProduct = useMutation({
    mutationFn: (id) => businessApi.removeProduct(clientId, id),
    onSuccess: onDone('প্রোডাক্ট মুছে ফেলা হয়েছে'),
    onError,
  });
  const addStock = useMutation({
    mutationFn: (payload) => businessApi.createPurchase(clientId, payload),
    onSuccess: onDone('স্টক যোগ হয়েছে'),
    onError,
  });
  const removePurchase = useMutation({
    mutationFn: (id) => businessApi.removePurchase(clientId, id),
    onSuccess: onDone('স্টক এন্ট্রি মুছে ফেলা হয়েছে'),
    onError,
  });

  if (products.isLoading) return <Loading />;
  if (products.error) return <ErrorState error={products.error} onRetry={products.refetch} />;

  const rows = products.data;
  const active = rows.filter((p) => p.is_active);
  const totals = active.reduce(
    (acc, p) => ({
      units: acc.units + Math.max(p.in_stock, 0),
      value: acc.value + Math.max(p.stock_value, 0),
      sold: acc.sold + p.sold_qty,
      pre: acc.pre + p.pre_order_qty,
    }),
    { units: 0, value: 0, sold: 0, pre: 0 },
  );

  const columns = [
    {
      key: 'name',
      header: 'প্রোডাক্ট',
      render: (r) => (
        <div className={r.is_active ? undefined : 'opacity-50'}>
          <p className="font-medium text-slate-800">{r.name}</p>
          <p className="text-xs text-slate-500">{[r.sku, r.category].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      ),
    },
    { key: 'cost_price', header: 'কেনা / বিক্রয়', align: 'right', render: (r) => `${currency(r.cost_price)} / ${currency(r.sale_price)}` },
    { key: 'opening_stock', header: 'শুরু', align: 'right', render: (r) => number(r.opening_stock) },
    { key: 'purchased_qty', header: 'কেনা', align: 'right', render: (r) => `+${number(r.purchased_qty)}` },
    { key: 'sold_qty', header: 'সেল', align: 'right', render: (r) => `−${number(r.sold_qty)}` },
    {
      key: 'in_stock',
      header: 'স্টকে আছে',
      align: 'right',
      render: (r) => (
        <div className="flex flex-col items-end gap-1">
          <span className="font-semibold text-slate-900">{number(r.in_stock)}</span>
          <Badge tone={STOCK_STATUS[r.stock_status].tone}>{STOCK_STATUS[r.stock_status].label}</Badge>
        </div>
      ),
    },
    { key: 'pre_order_qty', header: 'প্রি-অর্ডার', align: 'right', render: (r) => number(r.pre_order_qty) },
    {
      key: 'available',
      header: 'প্রি-অর্ডারের পর',
      align: 'right',
      render: (r) => <span className={r.available < 0 ? 'font-semibold text-rose-600' : undefined}>{number(r.available)}</span>,
    },
    { key: 'stock_value', header: 'স্টক মূল্য', align: 'right', render: (r) => currency(r.stock_value) },
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
                  onClick={() => window.confirm(`"${r.name}" মুছে ফেলবেন?`) && removeProduct.mutate(r.id)}
                >
                  মুছুন
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const purchaseColumns = [
    { key: 'purchase_date', header: 'তারিখ', render: (r) => dateLabel(r.purchase_date) },
    { key: 'product_name', header: 'প্রোডাক্ট' },
    { key: 'qty', header: 'পরিমাণ', align: 'right', render: (r) => number(r.qty) },
    { key: 'unit_cost', header: 'প্রতি পিস', align: 'right', render: (r) => currency(r.unit_cost) },
    { key: 'total_cost', header: 'মোট', align: 'right', render: (r) => currency(r.total_cost) },
    { key: 'supplier', header: 'সাপ্লায়ার', render: (r) => r.supplier || '—' },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r) => (
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600"
                onClick={() => window.confirm('এই স্টক এন্ট্রি মুছবেন?') && removePurchase.mutate(r.id)}
              >
                মুছুন
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="মোট স্টক" value={`${number(totals.units)} পিস`} hint={`${number(active.length)} সক্রিয় প্রোডাক্ট`} />
        <StatTile label="স্টকের মূল্য" value={currency(totals.value)} hint="কেনা দামে" />
        <StatTile label="মোট সেল হয়েছে" value={`${number(totals.sold)} পিস`} hint="শুরু থেকে" />
        <StatTile label="অপেক্ষমাণ প্রি-অর্ডার" value={`${number(totals.pre)} পিস`} />
      </div>

      <Card>
        <CardHeader
          title="প্রোডাক্ট ও স্টক"
          subtitle="স্টক = শুরুর স্টক + কেনা − সেল (রিটার্ন ও বাতিল অর্ডার স্টকে ফেরত থাকে)"
          actions={
            canWrite && (
              <>
                <Button variant="secondary" disabled={!active.length} onClick={() => setAddingStock(true)}>
                  + স্টক যোগ
                </Button>
                <Button onClick={() => setEditing({})}>+ নতুন প্রোডাক্ট</Button>
              </>
            )
          }
        />
        <Table columns={columns} rows={rows} empty="এখনো কোনো প্রোডাক্ট নেই" />
      </Card>

      <Card>
        <CardHeader title="স্টক কেনার হিসাব" subtitle="উপরে বেছে নেওয়া সময়ের মধ্যে" />
        {purchases.isLoading ? (
          <Loading />
        ) : purchases.error ? (
          <ErrorState error={purchases.error} onRetry={purchases.refetch} />
        ) : (
          <Table columns={purchaseColumns} rows={purchases.data} empty="এই সময়ে কোনো স্টক কেনা হয়নি" />
        )}
      </Card>

      {editing && (
        <ProductForm
          initial={editing}
          saving={saveProduct.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => saveProduct.mutate(editing.id ? { ...payload, id: editing.id } : payload)}
        />
      )}
      {addingStock && (
        <PurchaseForm
          products={active}
          saving={addStock.isPending}
          onClose={() => setAddingStock(false)}
          onSubmit={(payload) => addStock.mutate(payload)}
        />
      )}
    </div>
  );
};
