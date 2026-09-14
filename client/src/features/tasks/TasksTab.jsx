import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { tasksApi } from '@/api/endpoints.js';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { StatTile } from '@/components/ui/StatTile.jsx';
import { TaskForm, CHECKS } from './TaskForm.jsx';
import { dateLabel, percent, number } from '@/lib/format.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';

const scoreTone = (score) => (score === 4 ? 'success' : score >= 2 ? 'warning' : 'danger');

export const TasksTab = () => {
  const { cycle } = useOutletContext();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [editing, setEditing] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tasks', cycle.id],
    queryFn: () => tasksApi.list({ cycle_id: cycle.id }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: (payload) =>
      payload.id ? tasksApi.update(payload) : tasksApi.create({ ...payload, cycle_id: cycle.id }),
    onSuccess: () => {
      toast.success('টাস্ক সংরক্ষিত হয়েছে');
      invalidate();
      setEditing(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, key, value }) => tasksApi.update({ id, [key]: value }),
    onSuccess: invalidate,
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: tasksApi.remove,
    onSuccess: () => {
      toast.success('মুছে ফেলা হয়েছে');
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const editable = can('admin', 'manager', 'media_buyer');
  const summary = data.meta.summary;

  const columns = [
    { key: 'task_date', header: 'তারিখ', render: (r) => dateLabel(r.task_date) },
    { key: 'task_name', header: 'নির্ধারিত ডেইলি টাস্ক' },
    { key: 'owner_label', header: 'দায়িত্বে', render: (r) => r.assignee_name || r.owner_label || '—' },
    ...CHECKS.map((check) => ({
      key: check.key,
      header: check.label,
      align: 'right',
      render: (row) => (
        <input
          type="checkbox"
          disabled={!editable || toggle.isPending}
          checked={!!row[check.key]}
          onChange={(e) => toggle.mutate({ id: row.id, key: check.key, value: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
        />
      ),
    })),
    {
      key: 'compliance',
      header: 'কমপ্লায়েন্স',
      align: 'right',
      render: (r) => <Badge tone={scoreTone(r.compliance.score)}>{r.compliance.label}</Badge>,
    },
    { key: 'comment', header: 'কমেন্ট', render: (r) => r.comment || '—' },
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
              onClick={() => window.confirm('এই রেকর্ড মুছে ফেলবেন?') && remove.mutate(row.id)}
            >
              ✕
            </Button>
          </div>
        ),
    },
  ];

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="ট্র্যাক করা দিন" value={number(summary.tracked_days)} />
        <StatTile label="১০০% সম্পন্ন দিন" value={number(summary.perfect_days)} />
        <StatTile
          label="কমপ্লায়েন্স রেট"
          value={percent(summary.compliance_rate, 1)}
          tone={summary.compliance_rate !== null && summary.compliance_rate < 0.8 ? 'danger' : undefined}
        />
        <StatTile label="গড় স্কোর" value={`${summary.average_score ?? '—'} / 4`} />
      </div>

      <Card>
        <CardHeader
          title="ডেইলি টাস্ক কমপ্লায়েন্স"
          subtitle="ইন্টারনাল — টিম প্রতিদিন নির্ধারিত কাজ করছে কিনা"
          actions={editable && <Button onClick={() => setEditing({})}>+ টাস্ক</Button>}
        />
        <Table columns={columns} rows={data.rows} empty="এখনো কোনো টাস্ক রেকর্ড নেই" />
      </Card>

      {editing && (
        <TaskForm
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
