import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usersApi, authApi, clientsApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { Field, Input, Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { ROLE_LABEL } from '@/lib/status.js';
import { dateLabel } from '@/lib/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';

const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }));

const UserForm = ({ open, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer', phone: '', client_id: '' });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const isClient = form.role === 'client';

  const clients = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => clientsApi.list({ limit: 200, sortBy: 'c.name', sortDir: 'asc' }),
    enabled: isClient,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="নতুন টিম মেম্বার"
      subtitle="অ্যাকাউন্ট তৈরি করে রোল নির্ধারণ করুন"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button
            loading={saving}
            onClick={() =>
              onSubmit({ ...form, phone: form.phone || null, client_id: isClient ? form.client_id || null : null })
            }
          >
            তৈরি করুন
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="নাম *">
          <Input value={form.name} onChange={set('name')} />
        </Field>
        <Field label="ইমেইল *">
          <Input type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="পাসওয়ার্ড *" hint="কমপক্ষে ৬ অক্ষর">
          <Input type="password" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="রোল">
          <Select value={form.role} onChange={set('role')} options={ROLE_OPTIONS} />
        </Field>
        {isClient && (
          <Field label="কোন ক্লায়েন্টের অ্যাকাউন্ট *" hint="লগইন করলে শুধু এই ক্লায়েন্টের ব্যবসার ডেটা দেখবে">
            <Select
              value={form.client_id}
              onChange={set('client_id')}
              placeholder={clients.isLoading ? 'লোড হচ্ছে…' : 'ক্লায়েন্ট বেছে নিন'}
              options={(clients.data?.rows || []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
        )}
        <Field label="ফোন">
          <Input value={form.phone} onChange={set('phone')} />
        </Field>
      </div>
    </Modal>
  );
};

export const UsersPage = () => {
  const qc = useQueryClient();
  const { can, user: me } = useAuth();
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ limit: 100 }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const create = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      toast.success('টিম মেম্বার তৈরি হয়েছে');
      invalidate();
      setCreating(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }) => usersApi.update({ id, role }),
    onSuccess: () => {
      toast.success('রোল আপডেট হয়েছে');
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivate = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => {
      toast.success('অ্যাকাউন্ট নিষ্ক্রিয় হয়েছে');
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const isAdmin = can('admin');

  const columns = [
    {
      key: 'name',
      header: 'নাম',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'রোল',
      render: (row) =>
        // A client login is tied to one client, so its role isn't switched inline.
        row.role === 'client' ? (
          <div>
            <Badge tone="warning">{ROLE_LABEL.client}</Badge>
            <p className="mt-1 text-xs text-slate-500">{row.client_name || '—'}</p>
          </div>
        ) : isAdmin && row.id !== me.id ? (
          <Select
            className="w-36 py-1 text-xs"
            value={row.role}
            options={ROLE_OPTIONS.filter((o) => o.value !== 'client')}
            onChange={(e) => changeRole.mutate({ id: row.id, role: e.target.value })}
          />
        ) : (
          <Badge tone="info">{ROLE_LABEL[row.role]}</Badge>
        ),
    },
    { key: 'phone', header: 'ফোন', render: (r) => r.phone || '—' },
    {
      key: 'is_active',
      header: 'অবস্থা',
      render: (r) => <Badge tone={r.is_active ? 'success' : 'muted'}>{r.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge>,
    },
    { key: 'last_login_at', header: 'শেষ লগইন', render: (r) => dateLabel(r.last_login_at) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        isAdmin &&
        row.is_active &&
        row.id !== me.id && (
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-600"
            onClick={() => window.confirm('এই অ্যাকাউন্ট নিষ্ক্রিয় করবেন?') && deactivate.mutate(row.id)}
          >
            নিষ্ক্রিয় করুন
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="টিম"
        subtitle="ইউজার অ্যাকাউন্ট ও রোল ম্যানেজমেন্ট"
        actions={isAdmin && <Button onClick={() => setCreating(true)}>+ নতুন মেম্বার</Button>}
      />
      <Card>
        <CardHeader title="সব ইউজার" />
        <Table columns={columns} rows={data.rows} empty="কোনো ইউজার নেই" />
      </Card>

      {creating && (
        <UserForm
          open
          saving={create.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(payload) => create.mutate(payload)}
        />
      )}
    </>
  );
};
