import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Field, Input } from '@/components/ui/Field.jsx';
import { LanguageSwitch } from '@/components/layout/LanguageSwitch.jsx';
import { t } from '@/i18n/index.jsx';

export const LoginPage = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form);
      toast.success(t('স্বাগতম!'));
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      toast.error(t(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 font-bold ring-1 ring-white/25">R</span>
          <span className="text-lg font-semibold">Rainfall CRM</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            {t('ক্লায়েন্ট টার্গেট, পারফরম্যান্স ও কমপ্লায়েন্স ম্যানেজমেন্ট')}
          </h2>
          <p className="mt-4 text-brand-100">{t('এজেন্সির সব ক্লায়েন্ট, টার্গেট ও ব্যবসার হিসাব এক জায়গায়।')}</p>
        </div>
        <p className="relative text-sm text-brand-200">© {new Date().getFullYear()} Rainfall</p>
      </div>

      <div className="flex flex-col bg-slate-50 px-4 py-6 sm:px-8">
        <div className="flex justify-end">
          <LanguageSwitch />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
                R
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('আপনার অ্যাকাউন্টে লগইন করুন')}</h1>
            <p className="mt-1 text-sm text-slate-500 lg:hidden">
              {t('ক্লায়েন্ট টার্গেট, পারফরম্যান্স ও কমপ্লায়েন্স ম্যানেজমেন্ট')}
            </p>

            <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
              <Field label="ইমেইল">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@rainfall.com"
                />
              </Field>
              <Field label="পাসওয়ার্ড">
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
              </Field>
              <Button type="submit" loading={loading} className="w-full" size="lg">
                লগইন
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
