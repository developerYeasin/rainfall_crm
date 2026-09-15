import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientsApi } from '@/api/endpoints.js';
import { Card, CardHeader, CardBody } from '@/components/ui/Card.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Input } from '@/components/ui/Field.jsx';
import { CredentialsModal } from '@/components/ui/CredentialsModal.jsx';
import { dateLabel } from '@/lib/format.js';
import { t } from '@/i18n/index.jsx';

/** The client's portal login. Admins and managers create it or reset its password. */
export const ClientLoginCard = ({ client }) => {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [issued, setIssued] = useState(null);

  const logins = useQuery({ queryKey: ['clients', client.id, 'logins'], queryFn: () => clientsApi.logins(client.id) });

  const issue = useMutation({
    mutationFn: () => clientsApi.issueLogin(client.id, email ? { email } : {}),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['clients', client.id, 'logins'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      setIssued(result);
    },
    onError: (err) => toast.error(err.message),
  });

  const rows = logins.data || [];
  const hasLogin = rows.length > 0;

  return (
    <Card>
      <CardHeader
        title="ক্লায়েন্ট লগইন"
        subtitle="ক্লায়েন্ট এই ইমেইল ও পাসওয়ার্ড দিয়ে নিজের ড্যাশবোর্ডে ঢুকবে"
        actions={
          <Button
            size="sm"
            variant={hasLogin ? 'secondary' : 'primary'}
            loading={issue.isPending}
            onClick={() => {
              if (hasLogin && !window.confirm(t('নতুন পাসওয়ার্ড তৈরি করবেন? পুরোনো পাসওয়ার্ড আর কাজ করবে না।'))) return;
              issue.mutate();
            }}
          >
            {hasLogin ? 'পাসওয়ার্ড রিসেট' : 'লগইন তৈরি করুন'}
          </Button>
        }
      />
      <CardBody>
        {hasLogin ? (
          <ul className="space-y-2">
            {rows.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-800">{u.email}</span>
                <Badge tone={u.is_active ? 'success' : 'muted'}>{u.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Badge>
                <span className="text-xs text-slate-500">
                  {t('শেষ লগইন')}: {dateLabel(u.last_login_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">{t('এখনো কোনো লগইন নেই।')}</p>
            <Input
              type="email"
              value={email}
              placeholder={client.email || 'client@example.com'}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}
      </CardBody>
      <CredentialsModal credentials={issued?.credentials} name={issued?.user?.name} onClose={() => setIssued(null)} />
    </Card>
  );
};
