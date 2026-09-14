import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientsApi, cyclesApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card, CardHeader, CardBody } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { CycleForm } from '@/features/cycles/CycleForm.jsx';
import { CLIENT_STATUS_LABEL, CLIENT_STATUS_TONE, CYCLE_STATUS_LABEL } from '@/lib/status.js';
import { currency, dateLabel } from '@/lib/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { t, tData } from '@/i18n/index.jsx';

const Detail = ({ label, value }) => (
  <div>
    <p className="text-xs text-slate-500">{t(label)}</p>
    <p className="mt-0.5 text-sm font-medium text-slate-800">{value || '—'}</p>
  </div>
);

export const ClientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsApi.get(id),
  });

  const createCycle = useMutation({
    mutationFn: (payload) => cyclesApi.create({ ...payload, client_id: Number(id) }),
    onSuccess: () => {
      toast.success(t('সাইকেল তৈরি হয়েছে'));
      qc.invalidateQueries({ queryKey: ['clients', id] });
      setCreating(false);
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const columns = [
    {
      key: 'name',
      header: 'সাইকেল',
      render: (row) => (
        <Link to={`/cycles/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {tData(row.name)}
        </Link>
      ),
    },
    { key: 'month_start', header: 'মাস শুরু', render: (r) => dateLabel(r.month_start) },
    { key: 'weeks_count', header: 'সপ্তাহ', align: 'right' },
    { key: 'monthly_budget', header: 'মাসিক বাজেট', align: 'right', render: (r) => currency(r.monthly_budget) },
    {
      key: 'status',
      header: 'স্ট্যাটাস',
      render: (r) => (
        <Badge tone={r.status === 'running' ? 'success' : r.status === 'planned' ? 'info' : 'muted'}>
          {CYCLE_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/clients" className="hover:underline">
            {t('ক্লায়েন্ট')}
          </Link>
        }
        title={data.name}
        subtitle={data.company}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('business')}>
              ব্যবসার হিসাব (সেল · স্টক · প্রফিট)
            </Button>
            {can('admin', 'manager', 'media_buyer') && <Button onClick={() => setCreating(true)}>+ নতুন মাস</Button>}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="প্রোফাইল"
            actions={<Badge tone={CLIENT_STATUS_TONE[data.status]}>{CLIENT_STATUS_LABEL[data.status]}</Badge>}
          />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Detail label="যোগাযোগকারী" value={data.contact_person} />
            <Detail label="ইমেইল" value={data.email} />
            <Detail label="ফোন" value={data.phone} />
            <Detail label="ইন্ডাস্ট্রি" value={data.industry} />
            <Detail label="অনবোর্ডিং" value={dateLabel(data.onboarded_at)} />
            <Detail label="মাসিক রিটেইনার" value={currency(data.monthly_retainer)} />
            <Detail label="অ্যাকাউন্ট ম্যানেজার" value={data.account_manager_name} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="নোট" />
          <CardBody>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{data.notes || t('কোনো নোট নেই')}</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="মাস / সাইকেল" subtitle="প্রতিটি মাসের টার্গেট, পারফরম্যান্স ও কমপ্লায়েন্স আলাদা" />
        <Table columns={columns} rows={data.cycles} empty="এখনো কোনো মাস তৈরি হয়নি" />
      </Card>

      {creating && (
        <CycleForm
          open
          saving={createCycle.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(payload) => createCycle.mutate(payload)}
        />
      )}
    </>
  );
};
