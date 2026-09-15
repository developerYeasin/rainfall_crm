import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { portalApi } from '@/api/endpoints.js';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Select, Textarea } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { t } from '@/i18n/index.jsx';

const KIND_OPTIONS = [
  { value: 'message', label: 'মেসেজ' },
  { value: 'announcement', label: 'ঘোষণা (ক্লায়েন্টকে ইমেইলও যাবে)' },
  { value: 'note', label: 'ইন্টার্নাল নোট (ক্লায়েন্ট দেখবে না)' },
];

/** One conversation per client, replacing the WhatsApp/email back-and-forth. */
export const MessagesTab = () => {
  const { clientId } = useOutletContext();
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const isClient = user.role === 'client';
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('message');
  const endRef = useRef(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['business', clientId, 'messages'],
    queryFn: () => portalApi.messages(clientId),
    refetchInterval: 30_000,
  });

  const send = useMutation({
    mutationFn: () => portalApi.sendMessage(clientId, { body, kind }),
    onSuccess: () => {
      setBody('');
      setKind('message');
      qc.invalidateQueries({ queryKey: ['business', clientId, 'messages'] });
    },
    onError: (err) => toast.error(err.message),
  });

  // Braces matter: newer browsers return a Promise from scrollIntoView, which React would call as the cleanup.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [data?.length]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const kindOptions = can('admin', 'manager', 'media_buyer') ? KIND_OPTIONS : KIND_OPTIONS.filter((k) => k.value !== 'announcement');

  return (
    <Card>
      <CardHeader
        title={isClient ? 'এজেন্সির সাথে কথা' : 'ক্লায়েন্ট কমিউনিকেশন'}
        subtitle={isClient ? 'ক্যাম্পেইন আপডেট, ঘোষণা ও প্রশ্ন — সব এক জায়গায়' : 'মেসেজ ও ঘোষণা ক্লায়েন্ট দেখে; ইন্টার্নাল নোট শুধু টিম দেখে'}
      />
      <div className="max-h-[55vh] min-h-[240px] space-y-3 overflow-y-auto bg-slate-50/60 p-4">
        {data.length === 0 && <p className="py-10 text-center text-sm text-slate-500">{t('এখনো কোনো মেসেজ নেই')}</p>}
        {data.map((m) => {
          const mine = m.user_id === user.id;
          return (
            <div key={m.id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={clsx(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[70%]',
                  m.kind === 'note' && 'border border-dashed border-amber-300 bg-amber-50 text-amber-900',
                  m.kind === 'announcement' && 'border border-brand-200 bg-brand-50 text-slate-800',
                  m.kind === 'message' && (mine ? 'bg-brand-600 text-white' : 'bg-white text-slate-800'),
                )}
              >
                <div className={clsx('mb-1 flex flex-wrap items-center gap-2 text-xs', mine && m.kind === 'message' ? 'text-brand-100' : 'text-slate-500')}>
                  <span className="font-medium">{m.user_name || t('অজানা')}</span>
                  {m.kind === 'announcement' && <Badge tone="info">{t('ঘোষণা')}</Badge>}
                  {m.kind === 'note' && <Badge tone="warning">{t('ইন্টার্নাল নোট')}</Badge>}
                  <span>{String(m.created_at).slice(0, 16).replace('T', ' ')}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!isClient && <Select className="w-full sm:w-72" value={kind} onChange={(e) => setKind(e.target.value)} options={kindOptions} />}
          <Button loading={send.isPending} disabled={!body.trim()} onClick={() => send.mutate()}>
            পাঠান
          </Button>
        </div>
      </div>
    </Card>
  );
};
