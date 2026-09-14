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
import { CLIENT_STATUS_LABEL, CLIENT_STATUS_TONE } from '@/lib/status.js';
import { currency, dateLabel, number } from '@/lib/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';

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

  const save = useMutation({
    mutationFn: (payload) => (payload.id ? clientsApi.update(payload) : clientsApi.create(payload)),
    onSuccess: () => {
      toast.success('ক্লায়েন্ট সংরক্ষিত হয়েছে');
      qc.invalidateQueries({ queryKey: ['clients'] });
      setEditing(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: clientsApi.remove,
    onSuccess: () => {
      toast.success('ক্লায়েন্ট মুছে ফেলা হয়েছে');
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmRemove = (row) => {
    const message = 'এই ক্লায়েন্ট মুছে ফেলবেন? সব সাইকেল ও ডেটাও মুছে যাবে: ' + row.name;
    if (window.confirm(message)) remove.mutate(row.id);
  };

  const columns = [
    {
      key: 'name',
      header: 'ক্লায়েন্ট',
      render: (row) => (
        <div>
          <Link to={`/clients/${row.id}`} className="font-medium text-brand-700 hover:underline">
            {row.name}
          </Link>
          {row.company && <p className="text-xs text-slate-500">{row.company}</p>}
        </div>
      ),
    },
    { key: 'contact_person', header: 'যোগাযোগ', render: (r) => r.contact_person || '—' },
    { key: 'industry', header: 'ইন্ডাস্ট্রি', render: (r) => r.industry || '—' },
    {
      key: 'status',
      header: 'স্ট্যাটাস',
      render: (r) => <Badge tone={CLIENT_STATUS_TONE[r.status]}>{CLIENT_STATUS_LABEL[r.status]}</Badge>,
    },
    { key: 'cycles_count', header: 'সাইকেল', align: 'right', render: (r) => number(r.cycles_count) },
    { key: 'monthly_retainer', header: 'রিটেইনার', align: 'right', render: (r) => currency(r.monthly_retainer) },
    { key: 'onboarded_at', header: 'অনবোর্ডিং', render: (r) => dateLabel(r.onboarded_at) },
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
          can('admin', 'manager', 'media_buyer') && <Button onClick={() => setEditing({})}>+ নতুন ক্লায়েন্ট</Button>
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
    </>
  );
};
