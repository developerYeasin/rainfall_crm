import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientStaffApi, teamApi } from '@/api/endpoints.js';
import { Card, CardHeader, CardBody } from '@/components/ui/Card.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Checkbox } from '@/components/ui/Field.jsx';
import { ROLE_LABEL } from '@/lib/status.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { t } from '@/i18n/index.jsx';

/** Which team members work on this client. Only assigned staff (and admins) can open its data. */
export const ClientStaffCard = ({ clientId }) => {
  const { can } = useAuth();
  const canManage = can('admin', 'manager');
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);

  const staff = useQuery({ queryKey: ['clients', clientId, 'staff'], queryFn: () => clientStaffApi.list(clientId) });
  const team = useQuery({ queryKey: ['team'], queryFn: teamApi.list, enabled: canManage && editing !== null });

  const save = useMutation({
    mutationFn: () => clientStaffApi.set(clientId, [...editing]),
    onSuccess: () => {
      toast.success(t('টিম অ্যাসাইনমেন্ট আপডেট হয়েছে'));
      qc.invalidateQueries({ queryKey: ['clients', clientId, 'staff'] });
      qc.invalidateQueries({ queryKey: ['team'] });
      setEditing(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggle = (id) => {
    const next = new Set(editing);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEditing(next);
  };

  return (
    <Card>
      <CardHeader
        title="অ্যাসাইন করা টিম"
        subtitle="শুধু এরা (ও অ্যাডমিন) এই ক্লায়েন্টের ডেটা দেখতে পারে"
        actions={
          canManage &&
          (editing ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                বাতিল
              </Button>
              <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
                সংরক্ষণ
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setEditing(new Set((staff.data || []).map((s) => s.id)))}>
              পরিবর্তন
            </Button>
          ))
        }
      />
      <CardBody>
        {editing ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(team.data || [])
              .filter((u) => u.is_active && u.role !== 'admin')
              .map((u) => (
                <Checkbox key={u.id} checked={editing.has(u.id)} onChange={() => toggle(u.id)} label={`${u.name} · ${ROLE_LABEL[u.role]}`} />
              ))}
          </div>
        ) : staff.data?.length ? (
          <ul className="flex flex-wrap gap-2">
            {staff.data.map((s) => (
              <li key={s.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {s.name} <span className="text-xs text-slate-500">· {ROLE_LABEL[s.role]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t('কেউ অ্যাসাইন করা নেই — শুধু অ্যাডমিন দেখতে পারে')}</p>
        )}
      </CardBody>
    </Card>
  );
};
