import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { chatApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Textarea } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { ROLE_LABEL } from '@/lib/status.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { t } from '@/i18n/index.jsx';

const stamp = (value) => String(value).slice(0, 16).replace('T', ' ');

const Avatar = ({ name }) => (
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
    {(name || '?')
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()}
  </span>
);

const Thread = ({ userId }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const endRef = useRef(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['chat', 'thread', userId],
    queryFn: () => chatApi.thread(userId),
    refetchInterval: 10_000,
  });

  // Opening a thread marks it read on the server; refresh the unread counters.
  useEffect(() => {
    if (data) {
      qc.invalidateQueries({ queryKey: ['chat', 'contacts'] });
      qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
    }
  }, [data?.messages?.length, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [data?.messages?.length]);

  const send = useMutation({
    mutationFn: () => chatApi.send(userId, body),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['chat', 'thread', userId] });
      qc.invalidateQueries({ queryKey: ['chat', 'contacts'] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { contact, messages } = data;
  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <Link to="/inbox" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 md:hidden" aria-label={t('ফিরে যান')}>
          ←
        </Link>
        <Avatar name={contact.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{contact.name}</p>
          <p className="truncate text-xs text-slate-500">
            {contact.client_name || ROLE_LABEL[contact.role]} · {contact.email}
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4" style={{ maxHeight: '55vh' }}>
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">{t('এখনো কোনো মেসেজ নেই')}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={clsx(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[70%]',
                  mine ? 'bg-brand-600 text-white' : 'bg-white text-slate-800',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={clsx('mt-1 text-right text-[11px]', mine ? 'text-brand-100' : 'text-slate-400')}>
                  {stamp(m.created_at)}
                  {mine && (m.read_at ? ` · ${t('দেখেছে')}` : '')}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="space-y-2 border-t border-slate-100 p-4">
        <Textarea
          value={body}
          placeholder="মেসেজ লিখুন…"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && body.trim()) send.mutate();
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{t('মেসেজের কপি প্রাপকের ইমেইলেও যাবে')}</p>
          <Button loading={send.isPending} disabled={!body.trim()} onClick={() => send.mutate()}>
            পাঠান
          </Button>
        </div>
      </div>
    </div>
  );
};

/** Direct messages between everyone in the ecosystem — team members and clients. */
export const InboxPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['chat', 'contacts'],
    queryFn: chatApi.contacts,
    refetchInterval: 20_000,
  });

  const needle = search.trim().toLowerCase();
  const contacts = (data || []).filter(
    (c) => !needle || [c.name, c.email, c.client_name].some((v) => v?.toLowerCase().includes(needle)),
  );

  return (
    <>
      <PageHeader title="ইনবক্স" subtitle="টিম ও ক্লায়েন্ট — সবার সাথে সরাসরি মেসেজ" />
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[300px_1fr]">
          <aside className={clsx('border-slate-100 md:border-r', userId && 'hidden md:block')}>
            <div className="border-b border-slate-100 p-3">
              <Input placeholder="নাম বা ইমেইল খুঁজুন…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {isLoading ? (
              <Loading />
            ) : error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : (
              <ul className="max-h-[65vh] divide-y divide-slate-100 overflow-y-auto">
                {contacts.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">{t('কেউ নেই')}</li>}
                {contacts.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/inbox/${c.id}`)}
                      className={clsx(
                        'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50',
                        Number(userId) === c.id && 'bg-brand-50',
                      )}
                    >
                      <Avatar name={c.name} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-800">{c.name}</span>
                          {c.unread > 0 && (
                            <span className="rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">{c.unread}</span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {c.last_message
                            ? `${c.last_message.mine ? `${t('আপনি')}: ` : ''}${c.last_message.body}`
                            : c.client_name || ROLE_LABEL[c.role]}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
          <section className={clsx(!userId && 'hidden md:block')}>
            {userId ? (
              <Thread key={userId} userId={Number(userId)} />
            ) : (
              <p className="px-4 py-24 text-center text-sm text-slate-500">{t('মেসেজ পাঠাতে বাম পাশ থেকে কাউকে বেছে নিন')}</p>
            )}
          </section>
        </div>
      </Card>
    </>
  );
};
