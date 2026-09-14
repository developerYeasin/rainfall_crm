import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { contentApi } from '@/api/endpoints.js';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { ContentForm, CONTENT_STATUS, PLATFORMS } from './ContentForm.jsx';
import { CONTENT_STATUS_TONE } from '@/lib/status.js';
import { dateLabel } from '@/lib/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { t } from '@/i18n/index.jsx';

export const ContentTab = () => {
  const { cycle } = useOutletContext();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ status: '', platform: '' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['content', cycle.id, filters],
    queryFn: () =>
      contentApi.list({
        cycle_id: cycle.id,
        status: filters.status || undefined,
        platform: filters.platform || undefined,
      }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['content'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: (payload) =>
      payload.id ? contentApi.update(payload) : contentApi.create({ ...payload, cycle_id: cycle.id }),
    onSuccess: () => {
      toast.success(t('কন্টেন্ট সংরক্ষিত হয়েছে'));
      invalidate();
      setEditing(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }) => contentApi.update({ id, status }),
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: contentApi.remove,
    onSuccess: () => {
      toast.success(t('মুছে ফেলা হয়েছে'));
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const editable = can('admin', 'manager', 'media_buyer', 'designer');

  const columns = [
    { key: 'plan_date', header: 'তারিখ', render: (r) => dateLabel(r.plan_date) },
    { key: 'platform', header: 'প্ল্যাটফর্ম' },
    { key: 'content_type', header: 'কন্টেন্ট টাইপ', render: (r) => t(r.content_type) },
    { key: 'topic', header: 'টপিক / ক্যাপশন আইডিয়া' },
    {
      key: 'status',
      header: 'স্ট্যাটাস',
      render: (row) =>
        editable ? (
          <Select
            className="w-32 py-1 text-xs"
            value={row.status}
            options={CONTENT_STATUS}
            onChange={(e) => changeStatus.mutate({ id: row.id, status: e.target.value })}
          />
        ) : (
          <Badge tone={CONTENT_STATUS_TONE[row.status]}>{row.status}</Badge>
        ),
    },
    { key: 'designer_name', header: 'ডিজাইনার', render: (r) => r.designer_user_name || r.designer_name || '—' },
    { key: 'publish_date', header: 'পাবলিশ তারিখ', render: (r) => dateLabel(r.publish_date) },
    { key: 'note', header: 'নোট', render: (r) => r.note || '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        editable && (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
              এডিট
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-600"
              onClick={() => window.confirm(t('এই কন্টেন্ট মুছে ফেলবেন?')) && remove.mutate(row.id)}
            >
              ✕
            </Button>
          </div>
        ),
    },
  ];

  const counts = data.meta.statusCounts || [];

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {CONTENT_STATUS.map((status) => {
          const found = counts.find((c) => c.status === status);
          return (
            <Badge key={status} tone={CONTENT_STATUS_TONE[status]}>
              {t(status)}: {found ? found.total : 0}
            </Badge>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="মাসিক কন্টেন্ট ক্যালেন্ডার"
          subtitle="ক্লায়েন্টকে দেখানোর জন্য"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="w-36 py-1.5"
                placeholder="সব স্ট্যাটাস"
                value={filters.status}
                options={CONTENT_STATUS}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              />
              <Select
                className="w-40 py-1.5"
                placeholder="সব প্ল্যাটফর্ম"
                value={filters.platform}
                options={PLATFORMS}
                onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
              />
              {editable && <Button onClick={() => setEditing({})}>+ কন্টেন্ট</Button>}
            </div>
          }
        />
        <Table columns={columns} rows={data.rows} empty="এখনো কোনো কন্টেন্ট প্ল্যান নেই" />
      </Card>

      {editing && (
        <ContentForm
          open
          cycle={cycle}
          initial={editing.id ? editing : null}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => save.mutate(editing.id ? { ...payload, id: editing.id } : payload)}
        />
      )}
    </>
  );
};
