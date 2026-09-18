import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adAccountsApi, clientsApi, metaApi, teamApi } from '@/api/endpoints.js';
import { Modal } from '@/components/ui/Modal.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Field, Input, Select } from '@/components/ui/Field.jsx';
import { t } from '@/i18n/index.jsx';

/**
 * Direct Facebook connection: log in with Facebook (or paste a system-user token), pick the
 * ad accounts, and they are linked to a client and synced right away.
 * `session` arrives from the OAuth callback redirect (?meta_session=…).
 */
export const FacebookConnectModal = ({ session, initialClientId, onClose, onDone }) => {
  const [clientId, setClientId] = useState(initialClientId ? String(initialClientId) : '');
  const [token, setToken] = useState('');
  const [picked, setPicked] = useState({});
  const [assignee, setAssignee] = useState('');

  const meta = useQuery({ queryKey: ['meta'], queryFn: metaApi.get, staleTime: Infinity });
  const clients = useQuery({ queryKey: ['clients', 'options'], queryFn: () => clientsApi.list({ limit: 200, sortBy: 'c.name', sortDir: 'asc' }) });
  const team = useQuery({ queryKey: ['team'], queryFn: teamApi.list });

  const source = session ? { session } : { access_token: token.trim() };

  const discover = useMutation({
    mutationFn: () => adAccountsApi.metaDiscover(source),
    onSuccess: (accounts) => {
      setPicked({});
      if (!accounts.length) toast.error(t('এই Facebook অ্যাকাউন্টে কোনো অ্যাড অ্যাকাউন্ট পাওয়া যায়নি'));
    },
    onError: (err) => toast.error(err.message),
  });

  // Returning from Facebook: list the accounts straight away.
  useEffect(() => {
    if (session) discover.mutate();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useMutation({
    mutationFn: () => adAccountsApi.metaConnectUrl(clientId ? Number(clientId) : undefined),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err.message),
  });

  const accounts = discover.data || [];
  const chosen = accounts.filter((a) => picked[a.external_id]);

  const importAccounts = useMutation({
    mutationFn: () =>
      adAccountsApi.metaImport({
        ...source,
        client_id: Number(clientId),
        assigned_user_id: assignee ? Number(assignee) : null,
        accounts: chosen.map(({ external_id, name, currency }) => ({ external_id, name, currency })),
      }),
    onSuccess: (rows) => {
      toast.success(t('{n}টি অ্যাড অ্যাকাউন্ট যুক্ত হয়েছে — ডেটা সিঙ্ক শুরু হয়েছে', { n: rows.length }));
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const clientName = (id) => clients.data?.rows.find((c) => c.id === id)?.name;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Facebook অ্যাড অ্যাকাউন্ট কানেক্ট"
      subtitle="কানেক্ট করলে প্রতিটি ক্যাম্পেইন ও অ্যাডের খরচ-রেজাল্ট নিজে থেকেই ক্লায়েন্টের পোর্টালে আসবে"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button
            loading={importAccounts.isPending}
            disabled={!clientId || !chosen.length}
            onClick={() => importAccounts.mutate()}
          >
            {t('{n}টি অ্যাকাউন্ট যুক্ত করুন', { n: chosen.length })}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="কোন ক্লায়েন্টের অ্যাকাউন্ট *">
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="ক্লায়েন্ট বেছে নিন"
              options={(clients.data?.rows || []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="মিডিয়া বায়ার">
            <Select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="কেউ না"
              options={(team.data || []).filter((u) => u.is_active).map((u) => ({ value: u.id, label: u.name }))}
            />
          </Field>
        </div>

        {!session && (
          <div className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">{t('১. Facebook দিয়ে লগইন')}</p>
              <p className="mt-1 text-xs text-slate-500">{t('আপনার Facebook অ্যাকাউন্ট যেসব অ্যাড অ্যাকাউন্ট দেখতে পারে, সব এখানে আসবে।')}</p>
              <Button
                className="mt-3 w-full bg-[#1877F2] hover:bg-[#166fe0]"
                loading={login.isPending}
                disabled={meta.data && !meta.data.metaConnect}
                onClick={() => login.mutate()}
              >
                {t('Facebook দিয়ে কানেক্ট করুন')}
              </Button>
              {meta.data && !meta.data.metaConnect && (
                <p className="mt-2 text-xs text-amber-700">
                  {t('সার্ভারে META_APP_ID ও META_APP_SECRET সেট করলে এই বাটন চালু হবে। ততক্ষণ পাশের টোকেন ব্যবহার করুন।')}
                </p>
              )}
            </div>
            <div className="md:border-l md:border-slate-100 md:pl-4">
              <p className="text-sm font-semibold text-slate-800">{t('২. অথবা অ্যাক্সেস টোকেন')}</p>
              <p className="mt-1 text-xs text-slate-500">{t('Business Manager → System users থেকে ads_read পারমিশনসহ টোকেন।')}</p>
              <div className="mt-3 flex gap-2">
                <Input type="password" placeholder="EAAB…" value={token} onChange={(e) => setToken(e.target.value)} />
                <Button variant="secondary" loading={discover.isPending} disabled={token.trim().length < 20} onClick={() => discover.mutate()}>
                  খুঁজুন
                </Button>
              </div>
            </div>
          </div>
        )}

        {discover.isPending && <p className="text-sm text-slate-500">{t('অ্যাড অ্যাকাউন্ট খোঁজা হচ্ছে…')}</p>}

        {accounts.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{t('অ্যাড অ্যাকাউন্ট বেছে নিন')}</p>
              <button
                type="button"
                className="text-xs font-medium text-brand-700 hover:underline"
                onClick={() => setPicked(Object.fromEntries(accounts.map((a) => [a.external_id, true])))}
              >
                {t('সব বেছে নিন')}
              </button>
            </div>
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {accounts.map((a) => (
                <li key={a.external_id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                      checked={!!picked[a.external_id]}
                      onChange={(e) => setPicked({ ...picked, [a.external_id]: e.target.checked })}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{a.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        act_{a.external_id} · {a.currency}
                        {a.business ? ` · ${a.business}` : ''}
                      </span>
                    </span>
                    {!a.active && <Badge tone="muted">{t('নিষ্ক্রিয়')}</Badge>}
                    {a.linked_client_id && (
                      <Badge tone="info">{t('যুক্ত: {c}', { c: clientName(a.linked_client_id) || `#${a.linked_client_id}` })}</Badge>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};
