import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { agencyTasksApi, clientsApi, teamApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { Field, Input, Select, Textarea } from '@/components/ui/Field.jsx';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States.jsx';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { dateLabel } from '@/lib/format.js';
import { t } from '@/i18n/index.jsx';

const PRIORITY = {
  high: { label: 'জরুরি', tone: 'danger' },
  normal: { label: 'সাধারণ', tone: 'info' },
  low: { label: 'কম', tone: 'muted' },
};
const PRIORITY_OPTIONS = Object.entries(PRIORITY).map(([value, p]) => ({ value, label: p.label }));

const TaskForm = ({ initial, saving, onClose, onSubmit }) => {
  const { can } = useAuth();
  const isLead = can('admin', 'manager');
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    client_id: initial?.client_id ?? '',
    assignee_id: initial?.assignee_id ?? '',
    due_date: initial?.due_date || '',
    priority: initial?.priority || 'normal',
  });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const clients = useQuery({ queryKey: ['clients', 'options'], queryFn: () => clientsApi.list({ limit: 200, sortBy: 'c.name', sortDir: 'asc' }) });
  const team = useQuery({ queryKey: ['team'], queryFn: teamApi.list, enabled: isLead });

  return (
    <Modal
      open
      onClose={onClose}
      title={initial?.id ? 'টাস্ক সম্পাদনা' : 'নতুন টাস্ক / রিমাইন্ডার'}
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
                description: form.description || null,
                client_id: form.client_id ? Number(form.client_id) : null,
                assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
                due_date: form.due_date || null,
              })
            }
          >
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="টাস্ক *" className="sm:col-span-2">
          <Input value={form.title} onChange={set('title')} placeholder="যেমন: ক্লায়েন্ট X এর ক্রিয়েটিভ আপডেট" />
        </Field>
        <Field label="ক্লায়েন্ট">
          <Select value={form.client_id} onChange={set('client_id')} placeholder="কোনো ক্লায়েন্ট না" options={(clients.data?.rows || []).map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        {isLead && (
          <Field label="দায়িত্বে">
            <Select
              value={form.assignee_id}
              onChange={set('assignee_id')}
              placeholder="আমি নিজে"
              options={(team.data || []).filter((u) => u.is_active).map((u) => ({ value: u.id, label: u.name }))}
            />
          </Field>
        )}
        <Field label="শেষ তারিখ">
          <Input type="date" value={form.due_date} onChange={set('due_date')} />
        </Field>
        <Field label="প্রায়োরিটি">
          <Select value={form.priority} onChange={set('priority')} options={PRIORITY_OPTIONS} />
        </Field>
        <Field label="বিস্তারিত" className="sm:col-span-2">
          <Textarea value={form.description} onChange={set('description')} />
        </Field>
      </div>
    </Modal>
  );
};

export const AgencyTasksPage = () => {
  const qc = useQueryClient();
  const { user, can } = useAuth();
  const [filter, setFilter] = useState({ status: 'open', mine: can('admin', 'manager') ? '' : '1' });
  const [editing, setEditing] = useState(null);

  const params = { status: filter.status || undefined, mine: filter.mine || undefined };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['agency-tasks', params], queryFn: () => agencyTasksApi.list(params) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['agency-tasks'] });
  const onError = (err) => toast.error(err.message);

  const save = useMutation({
    mutationFn: (payload) => (editing?.id ? agencyTasksApi.update({ ...payload, id: editing.id }) : agencyTasksApi.create(payload)),
    onSuccess: () => {
      toast.success(t('টাস্ক সংরক্ষিত হয়েছে'));
      invalidate();
      setEditing(null);
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (task) => agencyTasksApi.update({ id: task.id, status: task.status === 'open' ? 'done' : 'open' }),
    onSuccess: invalidate,
    onError,
  });
  const remove = useMutation({
    mutationFn: agencyTasksApi.remove,
    onSuccess: () => {
      toast.success(t('মুছে ফেলা হয়েছে'));
      invalidate();
    },
    onError,
  });

  const chip = (active, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full border px-3 py-1.5 text-sm font-medium transition',
        active ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {t(label)}
    </button>
  );

  return (
    <>
      <PageHeader title="টাস্ক ও রিমাইন্ডার" subtitle="টিমের কাজ, শেষ তারিখ ও দায়িত্ব" actions={<Button onClick={() => setEditing({})}>+ নতুন টাস্ক</Button>} />

      <div className="mb-4 flex flex-wrap gap-2">
        {chip(filter.status === 'open', 'চলমান', () => setFilter({ ...filter, status: 'open' }))}
        {chip(filter.status === 'done', 'সম্পন্ন', () => setFilter({ ...filter, status: 'done' }))}
        {chip(filter.status === '', 'সব', () => setFilter({ ...filter, status: '' }))}
        <span className="mx-1 w-px bg-slate-200" />
        {chip(filter.mine === '1', 'শুধু আমার', () => setFilter({ ...filter, mine: filter.mine ? '' : '1' }))}
      </div>

      <Card>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !data.length ? (
          <EmptyState title="কোনো টাস্ক নেই" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((task) => {
              const canEdit = can('admin', 'manager') || task.created_by === user.id;
              const canTick = canEdit || task.assignee_id === user.id;
              return (
                <li key={task.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                    checked={task.status === 'done'}
                    disabled={!canTick || toggle.isPending}
                    onChange={() => toggle.mutate(task)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={clsx('text-sm font-medium', task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>{task.title}</p>
                    {task.description && <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-500">{task.description}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge tone={PRIORITY[task.priority].tone}>{t(PRIORITY[task.priority].label)}</Badge>
                      {task.overdue && <Badge tone="danger">{t('মেয়াদোত্তীর্ণ')}</Badge>}
                      {task.due_date && <span>{t('শেষ তারিখ {d}', { d: dateLabel(task.due_date) })}</span>}
                      {task.client_name && (
                        <Link to={`/clients/${task.client_id}`} className="text-brand-700 hover:underline">
                          {task.client_name}
                        </Link>
                      )}
                      <span>· {task.assignee_name || '—'}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(task)}>
                        এডিট
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => window.confirm(t('এই টাস্ক মুছবেন?')) && remove.mutate(task.id)}>
                        মুছুন
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editing && <TaskForm initial={editing} saving={save.isPending} onClose={() => setEditing(null)} onSubmit={(p) => save.mutate(p)} />}
    </>
  );
};
