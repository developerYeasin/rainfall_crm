import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { settingsApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card, CardHeader, CardBody } from '@/components/ui/Card.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Field, Input } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { t } from '@/i18n/index.jsx';

const SOURCE_HINT = { app: 'এই পেজ থেকে সেভ করা', env: 'সার্ভারের .env থেকে নেওয়া' };

const copy = (text) =>
  navigator.clipboard?.writeText(text).then(
    () => toast.success(t('কপি হয়েছে')),
    () => toast.error(t('কপি করা যায়নি')),
  );

const Step = ({ n, title, children }) => (
  <li className="flex gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{n}</span>
    <div className="min-w-0 text-sm text-slate-600">
      <p className="font-medium text-slate-800">{t(title)}</p>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  </li>
);

/** Live result of checking the saved token against Meta. */
const TokenStatus = ({ status, checking }) => {
  if (!status.has_token) {
    return <Badge tone="warning">{t('টোকেন সেভ করা নেই')}</Badge>;
  }
  if (checking && !status.token) return <p className="text-sm text-slate-500">{t('Meta-র সাথে টোকেন যাচাই হচ্ছে…')}</p>;
  if (!status.token) return null;
  if (!status.token.valid) {
    return (
      <div className="space-y-1">
        <Badge tone="danger">{t('টোকেন কাজ করছে না')}</Badge>
        <p className="text-sm text-rose-600">{status.error}</p>
      </div>
    );
  }
  const { token } = status;
  const expiry = !token.expiry_known
    ? t('জানা নেই — App ID ও Secret দিলে দেখা যাবে')
    : token.expires_at === null
      ? t('কখনো মেয়াদ শেষ হবে না')
      : t('মেয়াদ শেষ {date} ({n} দিন বাকি)', { date: token.expires_at.slice(0, 10), n: token.days_left });
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs text-slate-500">{t('অবস্থা')}</dt>
        <dd className="mt-0.5 flex flex-wrap gap-1">
          <Badge tone="success">{t('টোকেন ঠিক আছে')}</Badge>
          {!token.has_ads_read && <Badge tone="danger">{t('ads_read পারমিশন নেই')}</Badge>}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">{t('টোকেন কার')}</dt>
        <dd className="mt-0.5 font-medium text-slate-800">
          {token.owner_name || token.owner_id}
          {token.type && <span className="ml-1 text-xs font-normal text-slate-500">({token.type})</span>}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">{t('মেয়াদ')}</dt>
        <dd className={`mt-0.5 ${token.days_left !== null && token.days_left < 7 ? 'font-medium text-rose-600' : 'text-slate-800'}`}>
          {expiry}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">{t('পারমিশন')}</dt>
        <dd className="mt-0.5 break-words text-slate-800">{token.scopes?.length ? token.scopes.join(', ') : '—'}</dd>
      </div>
    </dl>
  );
};

/**
 * Admin page for the Meta (Facebook) connection: the developer app's id + secret and the agency
 * access token, a live check of that token, and the ad accounts it can see — with a step-by-step guide.
 */
export const MetaSetupPage = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ app_id: null, app_secret: '', access_token: '' });

  // Fast load first (no call to Meta), then the live check.
  const base = useQuery({ queryKey: ['settings', 'meta', 'base'], queryFn: () => settingsApi.meta(false) });
  const live = useQuery({ queryKey: ['settings', 'meta', 'live'], queryFn: () => settingsApi.meta(true), enabled: !!base.data?.has_token });

  const save = useMutation({
    mutationFn: settingsApi.saveMeta,
    onSuccess: (data) => {
      qc.setQueryData(['settings', 'meta', 'live'], data);
      qc.setQueryData(['settings', 'meta', 'base'], data);
      qc.invalidateQueries({ queryKey: ['meta'] });
      setForm({ app_id: null, app_secret: '', access_token: '' });
      if (data.token && !data.token.valid) toast.error(t('সেভ হয়েছে, কিন্তু টোকেন কাজ করছে না — নিচে কারণ দেখুন'));
      else toast.success(data.token_extended ? t('সেভ হয়েছে — টোকেন ৬০ দিনের লং-লিভড টোকেনে বদলানো হয়েছে') : t('সেভ হয়েছে'));
    },
    onError: (err) => toast.error(err.message),
  });

  if (base.isLoading) return <Loading />;
  if (base.error) return <ErrorState error={base.error} onRetry={base.refetch} />;

  const status = live.data || base.data;
  const appId = form.app_id ?? status.app_id ?? '';

  const submit = () => {
    const payload = {};
    if (appId !== (status.app_id ?? '')) payload.app_id = appId.trim();
    if (form.app_secret.trim()) payload.app_secret = form.app_secret.trim();
    if (form.access_token.trim()) payload.access_token = form.access_token.trim();
    if (!Object.keys(payload).length) return toast.error(t('কিছু বদলানো হয়নি'));
    save.mutate(payload);
  };

  const ready = status.has_token && status.token?.valid;

  return (
    <>
      <PageHeader
        title="Meta (Facebook) সেটআপ"
        subtitle="একবার সেটআপ করলে সব ক্লায়েন্টের অ্যাড অ্যাকাউন্ট এই টোকেন দিয়ে কানেক্ট ও সিঙ্ক হবে"
        actions={
          ready && (
            <Link to="/ad-accounts?connect=1">
              <Button className="bg-[#1877F2] hover:bg-[#166fe0]">{t('অ্যাড অ্যাকাউন্ট কানেক্ট করুন')}</Button>
            </Link>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Card>
            <CardHeader
              title="কানেকশন স্ট্যাটাস"
              actions={
                status.has_token && (
                  <Button size="sm" variant="secondary" loading={live.isFetching} onClick={() => live.refetch()}>
                    {t('আবার যাচাই করুন')}
                  </Button>
                )
              }
            />
            <CardBody className="space-y-5">
              <TokenStatus status={status} checking={live.isFetching} />
              {status.ad_accounts && (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-800">
                    {t('এই টোকেন দিয়ে {n}টি অ্যাড অ্যাকাউন্ট দেখা যাচ্ছে', { n: status.ad_accounts.length })}
                  </p>
                  {status.ad_accounts.length === 0 ? (
                    <p className="text-sm text-amber-700">
                      {t('কোনো অ্যাড অ্যাকাউন্ট নেই — System user-কে ক্লায়েন্টদের অ্যাড অ্যাকাউন্ট অ্যাসাইন করুন (ধাপ ৪)।')}
                    </p>
                  ) : (
                    <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm">
                      {status.ad_accounts.map((a) => (
                        <li key={a.external_id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-800">{a.name}</span>
                            <span className="block truncate text-xs text-slate-500">
                              act_{a.external_id} · {a.currency}
                              {a.business ? ` · ${a.business}` : ''}
                            </span>
                          </span>
                          {!a.active && <Badge tone="muted">{t('নিষ্ক্রিয়')}</Badge>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {t('ডেটা প্রতি {m} মিনিটে নিজে থেকে সিঙ্ক হয়। প্রতিদিন {time} ({tz}) এ আগের দিনের পুরো রিপোর্ট ক্লায়েন্টকে নোটিফিকেশন ও ইমেইলে যায়।', {
                  m: status.sync_every_minutes,
                  time: status.daily_report_time,
                  tz: status.timezone,
                })}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="অ্যাপ ও টোকেন" subtitle="সব কিছু এনক্রিপ্ট করে সার্ভারে রাখা হয় — সেভের পর আর দেখা যায় না" />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="App ID" hint={status.source.appId ? t(SOURCE_HINT[status.source.appId]) : t('ধাপ ৩ দেখুন')}>
                  <Input inputMode="numeric" value={appId} onChange={(e) => setForm({ ...form, app_id: e.target.value })} placeholder="1234567890" />
                </Field>
                <Field
                  label="App Secret"
                  hint={status.has_app_secret ? `${t(SOURCE_HINT[status.source.appSecret])} — ${t('বদলাতে নতুনটা দিন')}` : t('ধাপ ৩ দেখুন')}
                >
                  <Input
                    type="password"
                    autoComplete="off"
                    value={form.app_secret}
                    onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
                    placeholder={status.has_app_secret ? '••••••••' : ''}
                  />
                </Field>
              </div>
              <Field
                label="অ্যাক্সেস টোকেন (System user)"
                hint={
                  status.has_token
                    ? `${t(SOURCE_HINT[status.source.accessToken])} — ${t('বদলাতে নতুনটা দিন')}`
                    : t('ধাপ ৪ দেখুন। ছোট মেয়াদের টোকেন দিলে App ID ও Secret থাকলে নিজে থেকে ৬০ দিনের টোকেনে বদলে যাবে।')
                }
              >
                <Input
                  type="password"
                  autoComplete="off"
                  value={form.access_token}
                  onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                  placeholder={status.has_token ? '••••••••' : 'EAAB…'}
                />
              </Field>
              <div className="flex justify-end">
                <Button loading={save.isPending} onClick={submit}>
                  {t('সেভ ও যাচাই করুন')}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader title="কীভাবে সেটআপ করবেন" subtitle="একবারই করতে হয়" />
          <CardBody>
            <ol className="space-y-5">
              <Step n="1" title="ক্লায়েন্টের অ্যাড অ্যাকাউন্টে এজেন্সির অ্যাক্সেস">
                <p>{t('প্রতিটি ক্লায়েন্ট তার Business Settings → Ad accounts থেকে আমাদের Business Portfolio-কে Partner হিসেবে অ্যাক্সেস দেবে (অথবা অ্যাকাউন্টটি আমাদের Business Manager-এই থাকবে)।')}</p>
              </Step>
              <Step n="2" title="Meta for Developers-এ অ্যাপ তৈরি">
                <p>
                  <a className="text-brand-700 hover:underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
                    developers.facebook.com/apps
                  </a>{' '}
                  {t('→ Create app → Use case: "Other" → Type: "Business" → এজেন্সির Business Portfolio বেছে নিন।')}
                </p>
                <p>{t('অ্যাপের ড্যাশবোর্ডে Add product → "Marketing API" যোগ করুন।')}</p>
              </Step>
              <Step n="3" title="App ID ও App Secret">
                <p>{t('App settings → Basic থেকে App ID ও App Secret কপি করে পাশের ফর্মে দিন।')}</p>
              </Step>
              <Step n="4" title="System user টোকেন (কখনো মেয়াদ শেষ হয় না)">
                <p>
                  <a className="text-brand-700 hover:underline" href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer">
                    Business settings → Users → System users
                  </a>{' '}
                  {t('→ Add → Admin রোল।')}
                </p>
                <p>{t('"Assign assets" → সব ক্লায়েন্টের অ্যাড অ্যাকাউন্ট বেছে নিন (অন্তত "View performance")। Apps-এ আমাদের অ্যাপটিও অ্যাসাইন করুন।')}</p>
                <p>{t('"Generate new token" → অ্যাপ বেছে নিন → Expiration: Never → পারমিশন: ads_read, business_management → টোকেন কপি করে পাশের ফর্মে দিন।')}</p>
                <p className="text-xs text-slate-500">
                  {t('নতুন ক্লায়েন্ট এলে শুধু তার অ্যাড অ্যাকাউন্ট এই System user-কে অ্যাসাইন করুন — টোকেন বদলাতে হবে না।')}
                </p>
              </Step>
              <Step n="5" title="ক্লায়েন্টের সাথে অ্যাড অ্যাকাউন্ট যুক্ত করুন">
                <p>{t('অ্যাড অ্যাকাউন্ট → Facebook কানেক্ট → "সেভ করা টোকেন দিয়ে লোড করুন" → ক্লায়েন্ট বেছে নিয়ে তার অ্যাকাউন্টগুলো টিক দিন। সাথে সাথে গত ৩০ দিনের ডেটা চলে আসবে।')}</p>
              </Step>
              <Step n="6" title="(ঐচ্ছিক) Facebook দিয়ে লগইন বাটন">
                <p>{t('অ্যাপে "Facebook Login for Business" যোগ করে Valid OAuth Redirect URIs-এ এটা দিন:')}</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-xs">{status.redirect_uri}</code>
                  <Button size="sm" variant="ghost" onClick={() => copy(status.redirect_uri)}>
                    {t('কপি')}
                  </Button>
                </div>
              </Step>
            </ol>
          </CardBody>
        </Card>
      </div>
    </>
  );
};
