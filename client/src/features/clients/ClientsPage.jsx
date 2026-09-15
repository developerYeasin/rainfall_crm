import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientsApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { ClientForm } from './ClientForm.jsx';
import { CredentialsModal } from '@/components/ui/CredentialsModal.jsx';
import { CLIENT_STATUS_LABEL, CLIENT_STATUS_TONE } from '@/lib/status.js';
import { currency, number } from '@/lib/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { t } from '@/i18n/index.jsx';

const STATUS_OPTIONS = Object.entries(CLIENT_STATUS_LABEL).map(([value, label]) => ({ value, label }));

export const ClientsPage = () => {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 });
  const [editing, setEditing] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', filters],
    queryFn: () =>
      clientsApi.list({
        ...filters,
        status: filters.status || undefined,
        search: filters.search || undefined,
      }),
  });

  const [issued, setIssued] = useState(null);

  const save = useMutation({
    mutationFn: (payload) => (payload.id ? clientsApi.update(payload) : clientsApi.create(payload)),
    onSuccess: (client) => {
      toast.success(t('ক্লায়েন্ট সংরক্ষিত হয়েছে'));
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditing(null);
      if (client?.credentials) setIssued({ name: client.name, credentials: client.credentials });
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: clientsApi.remove,
    onSuccess: () => {
      toast.success(t('ক্লায়েন্ট মুছে ফেলা হয়েছে'));
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmRemove = (row) => {
    const message = t('এই ক্লায়েন্ট মুছে ফেলবেন? সব সাইকেল ও ডেটাও মুছে যাবে: {name}', { name: row.name });
    if (window.confirm(message)) remove.mutate(row.id);
  };

  const columns = [
    {
      key: 'name',
      header: 'ক্লায়েন্ট',
      render: (row) => (
        <div className="min-w-[180px] max-w-[240px] whitespace-normal">
          <Link to={`/clients/${row.id}`} className="font-medium text-brand-700 hover:underline">
            {row.name}
          </Link>
          <p className="text-xs text-slate-500">
            {[row.company, row.industry].filter(Boolean).join(' · ')}
            {' · '}
            <Link to={`/clients/${row.id}/business`} className="text-brand-600 hover:underline">
              {t('ড্যাশবোর্ড')}
            </Link>
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'স্ট্যাটাস',
      render: (r) => <Badge tone={CLIENT_STATUS_TONE[r.status]}>{CLIENT_STATUS_LABEL[r.status]}</Badge>,
    },
    { key: 'month_ad_spend', header: 'এই মাসের অ্যাড স্পেন্ড', align: 'right', render: (r) => currency(r.month_ad_spend) },
    { key: 'month_sales', header: 'এই মাসের সেল', align: 'right', render: (r) => currency(r.month_sales) },
    {
      key: 'dues',
      header: 'ফি বাকি',
      align: 'right',
      render: (r) => <span className={r.dues > 0 ? 'font-medium text-rose-600' : undefined}>{currency(r.dues)}</span>,
    },
    {
      key: 'low_stock',
      header: 'স্টক অ্যালার্ট',
      align: 'right',
      render: (r) =>
        r.low_stock > 0 ? (
          <Link to={`/clients/${r.id}/business/stock`}>
            <Badge tone="warning">{t('{n} প্রোডাক্ট', { n: number(r.low_stock) })}</Badge>
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'account_manager_name', header: 'অ্যাকাউন্ট ম্যানেজার', render: (r) => r.account_manager_name || '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        can('admin', 'manager', 'media_buyer') && (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
              এডিট
            </Button>
            {can('admin', 'manager') && (
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => confirmRemove(row)}>
                ডিলিট
              </Button>
            )}
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="ক্লায়েন্ট"
        subtitle="সব ক্লায়েন্টের তালিকা ও অনবোর্ডিং অবস্থা"
        actions={
          can('admin', 'manager') && <Button onClick={() => setEditing({})}>+ নতুন ক্লায়েন্ট</Button>
        }
      />

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <Input
            className="max-w-xs"
            placeholder="নাম, কোম্পানি বা যোগাযোগ খুঁজুন…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          />
          <Select
            className="max-w-[180px]"
            placeholder="সব স্ট্যাটাস"
            value={filters.status}
            options={STATUS_OPTIONS}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
          />
        </div>

        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <Table columns={columns} rows={data.rows} empty="কোনো ক্লায়েন্ট নেই" />
        )}
      </Card>

      {editing && (
        <ClientForm
          open
          initial={editing.id ? editing : null}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => save.mutate(editing.id ? { ...payload, id: editing.id } : payload)}
        />
      )}
      <CredentialsModal credentials={issued?.credentials} name={issued?.name} onClose={() => setIssued(null)} />
    </>
  );
};
