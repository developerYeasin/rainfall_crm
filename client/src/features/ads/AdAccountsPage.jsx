import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adAccountsApi, clientsApi, teamApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { Checkbox, Field, Input, Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { currency } from '@/lib/format.js';
import { t } from '@/i18n/index.jsx';

const PLATFORM_OPTIONS = [
  { value: 'meta', label: 'Meta (Facebook / Instagram)' },
  { value: 'google', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
];
const PLATFORM_HINT = {
  meta: { id: 'যেমন act_1234567890 বা শুধু সংখ্যা', token: 'অ্যাক্সেস টোকেন' },
  google: { id: 'কাস্টমার আইডি, যেমন 123-456-7890', token: 'OAuth রিফ্রেশ টোকেন' },
  tiktok: { id: 'অ্যাডভার্টাইজার আইডি', token: 'অ্যাক্সেস টোকেন' },
};
const FLAG = {
  overspend: { label: 'বেশি খরচ', tone: 'danger' },
  underspend: { label: 'কম খরচ', tone: 'warning' },
  no_delivery: { label: 'ডেলিভারি বন্ধ', tone: 'danger' },
};

const AccountForm = ({ initial, saving, onClose, onSubmit }) => {
  const editing = !!initial?.id;
  const [form, setForm] = useState({
    client_id: initial?.client_id ?? '',
    platform: initial?.platform ?? 'meta',
    external_id: initial?.external_id ?? '',
    name: initial?.name ?? '',
    currency: initial?.currency ?? 'BDT',
    access_token: '',
    clear_token: false,
    result_action: initial?.result_action ?? '',
    daily_budget: initial?.daily_budget ?? '',
    assigned_user_id: initial?.assigned_user_id ?? '',
    is_active: initial?.is_active ?? true,
  });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const clients = useQuery({ queryKey: ['clients', 'options'], queryFn: () => clientsApi.list({ limit: 200, sortBy: 'c.name', sortDir: 'asc' }) });
  const team = useQuery({ queryKey: ['team'], queryFn: teamApi.list });

  const submit = () => {
    const payload = {
      ...form,
      client_id: form.client_id ? Number(form.client_id) : undefined,
      daily_budget: form.daily_budget === '' ? null : Number(form.daily_budget),
      assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : null,
      result_action: form.result_action || null,
    };
    if (!payload.access_token) delete payload.access_token;
    if (!editing) delete payload.clear_token;
    if (editing) delete payload.client_id;
    onSubmit(payload);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'অ্যাড অ্যাকাউন্ট সম্পাদনা' : 'নতুন অ্যাড অ্যাকাউন্ট যুক্ত করুন'}
      subtitle="টোকেন এনক্রিপ্ট করে রাখা হয় — কখনো ব্রাউজারে ফেরত আসে না"
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
        <Field label="ক্লায়েন্ট *">
          <Select
            value={form.client_id}
            onChange={set('client_id')}
            disabled={editing}
            placeholder="ক্লায়েন্ট বেছে নিন"
            options={(clients.data?.rows || []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="প্ল্যাটফর্ম">
          <Select value={form.platform} onChange={set('platform')} options={PLATFORM_OPTIONS} />
        </Field>
        <Field label="অ্যাকাউন্ট আইডি *" hint={PLATFORM_HINT[form.platform].id}>
          <Input value={form.external_id} onChange={set('external_id')} />
        </Field>
        <Field label="নাম *">
          <Input value={form.name} onChange={set('name')} />
        </Field>
        <Field
          label={PLATFORM_HINT[form.platform].token}
          hint={initial?.has_token ? 'টোকেন সংরক্ষিত আছে — বদলাতে নতুনটা দিন' : 'খালি রাখলে এজেন্সির সার্ভার সেটিং (.env) এর টোকেন ব্যবহার হবে'}
          className="sm:col-span-2"
        >
          <Input type="password" autoComplete="off" value={form.access_token} onChange={set('access_token')} />
        </Field>
        {editing && initial?.has_token && (
          <Checkbox
            className="sm:col-span-2"
            label="সংরক্ষিত টোকেন মুছে ফেলুন"
            checked={form.clear_token}
            onChange={(e) => setForm({ ...form, clear_token: e.target.checked })}
          />
        )}
        <Field label="দৈনিক বাজেট (৳)" hint="স্পেন্ড অ্যালার্টের জন্য; খালি রাখলে ৭ দিনের গড় ধরা হবে">
          <Input type="number" min="0" value={form.daily_budget} onChange={set('daily_budget')} />
        </Field>
        <Field label="মিডিয়া বায়ার">
          <Select
            value={form.assigned_user_id}
            onChange={set('assigned_user_id')}
            placeholder="কেউ না"
            options={(team.data || []).filter((u) => u.is_active).map((u) => ({ value: u.id, label: u.name }))}
          />
        </Field>
        <Field label="রেজাল্ট অ্যাকশন" hint="যেমন purchase, lead — খালি রাখলে নিজে বেছে নেবে">
          <Input value={form.result_action} onChange={set('result_action')} />
        </Field>
        <Field label="কারেন্সি">
          <Input value={form.currency} onChange={set('currency')} />
        </Field>
        <Checkbox
          className="sm:col-span-2"
          label="সক্রিয় — নির্ধারিত সময়ে নিজে থেকে সিঙ্ক হবে"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
        />
      </div>
    </Modal>
  );
};

/** Every connected ad account across clients, with sync status and spend anomaly flags. */
export const AdAccountsPage = () => {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canManage = can('admin', 'manager');
  const [editing, setEditing] = useState(null);
  const [flagOnly, setFlagOnly] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['ad-accounts'], queryFn: () => adAccountsApi.list() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ad-accounts'] });
  const onError = (err) => toast.error(err.message);

  const save = useMutation({
    mutationFn: (payload) => (editing?.id ? adAccountsApi.update({ ...payload, id: editing.id }) : adAccountsApi.create(payload)),
    onSuccess: () => {
      toast.success(t('অ্যাড অ্যাকাউন্ট সংরক্ষিত হয়েছে'));
      invalidate();
      setEditing(null);
    },
    onError,
  });
  const sync = useMutation({
    mutationFn: adAccountsApi.sync,
    onSuccess: (res) => {
      toast.success(t('সিঙ্ক সম্পন্ন — {n} রো', { n: res.rows }));
      invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
      invalidate();
    },
  });
  const reassign = useMutation({
    mutationFn: ({ id, assigned_user_id }) => adAccountsApi.update({ id, assigned_user_id }),
    onSuccess: () => {
      toast.success(t('মিডিয়া বায়ার বদলানো হয়েছে'));
      invalidate();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: adAccountsApi.remove,
    onSuccess: () => {
      toast.success(t('মুছে ফেলা হয়েছে'));
      invalidate();
    },
    onError,
  });
  const team = useQuery({ queryKey: ['team'], queryFn: teamApi.list, enabled: canManage });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const flagged = data.filter((a) => a.flag || a.last_sync_error);
  const rows = flagOnly ? flagged : data;
  const teamOptions = (team.data || []).filter((u) => u.is_active).map((u) => ({ value: u.id, label: u.name }));

  const columns = [
    {
      key: 'name',
      header: 'অ্যাকাউন্ট',
      render: (r) => (
        <div className="min-w-[160px] max-w-[220px] whitespace-normal">
          <p className="font-medium text-slate-800">{r.name}</p>
          <p className="text-xs text-slate-500">
            <span className="uppercase">{r.platform}</span> · {r.external_id}
          </p>
        </div>
      ),
    },
    {
      key: 'client_name',
      header: 'ক্লায়েন্ট',
      render: (r) => (
        <Link to={`/clients/${r.client_id}/business/ads`} className="text-brand-700 hover:underline">
          {r.client_name}
        </Link>
      ),
    },
    {
      key: 'assigned_user_name',
      header: 'মিডিয়া বায়ার',
      render: (r) =>
        canManage ? (
          <Select
            className="w-32 py-1 text-xs"
            value={r.assigned_user_id ?? ''}
            placeholder="কেউ না"
            options={teamOptions}
            onChange={(e) => reassign.mutate({ id: r.id, assigned_user_id: e.target.value ? Number(e.target.value) : null })}
          />
        ) : (
          r.assigned_user_name || '—'
        ),
    },
    { key: 'daily_budget', header: 'দৈনিক বাজেট', align: 'right', render: (r) => currency(r.daily_budget) },
    {
      key: 'yesterday_spend',
      header: 'গতকাল / ৭ দিনের গড়',
      align: 'right',
      render: (r) => (
        <div>
          <p>{currency(r.yesterday_spend)}</p>
          <p className="text-xs text-slate-500">{currency(r.avg_7d)}</p>
        </div>
      ),
    },
    {
      key: 'flag',
      header: 'অবস্থা',
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <span className="text-xs text-slate-500">{r.last_synced_at ? String(r.last_synced_at).slice(0, 16).replace('T', ' ') : t('কখনো সিঙ্ক হয়নি')}</span>
          {!r.is_active ? (
            <Badge tone="muted">{t('নিষ্ক্রিয়')}</Badge>
          ) : r.flag ? (
            <Badge tone={FLAG[r.flag].tone}>{t(FLAG[r.flag].label)}</Badge>
          ) : (
            <Badge tone="success">{t('ঠিক আছে')}</Badge>
          )}
          {r.last_sync_error && (
            <span className="max-w-[220px] truncate text-xs text-rose-600" title={r.last_sync_error}>
              {r.last_sync_error}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" loading={sync.isPending && sync.variables === r.id} onClick={() => sync.mutate(r.id)}>
            সিঙ্ক
          </Button>
          {canManage && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                এডিট
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600"
                onClick={() => window.confirm(t('এই অ্যাড অ্যাকাউন্ট ও তার সিঙ্ক করা ডেটা মুছবেন?')) && remove.mutate(r.id)}
              >
                ডিলিট
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="অ্যাড অ্যাকাউন্ট"
        subtitle="সব ক্লায়েন্টের যুক্ত অ্যাড অ্যাকাউন্ট, সিঙ্ক ও বাজেট অ্যালার্ট"
        actions={canManage && <Button onClick={() => setEditing({})}>+ অ্যাকাউন্ট যুক্ত করুন</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFlagOnly(!flagOnly)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${flagOnly ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'}`}
        >
          {t('অ্যালার্ট')} <span className="ml-1 font-semibold">{flagged.length}</span>
        </button>
        <span className="text-sm text-slate-500">{t('মোট {n} টি অ্যাকাউন্ট', { n: data.length })}</span>
      </div>

      <Card>
        <Table columns={columns} rows={rows} empty="কোনো অ্যাড অ্যাকাউন্ট নেই" minWidth={900} />
      </Card>

      {editing && <AccountForm initial={editing} saving={save.isPending} onClose={() => setEditing(null)} onSubmit={(p) => save.mutate(p)} />}
    </>
  );
};
