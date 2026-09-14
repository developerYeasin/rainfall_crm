import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Field, Input } from '@/components/ui/Field.jsx';

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
      toast.success('স্বাগতম!');
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-brand-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            R
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Rainfall CRM</h1>
          <p className="mt-1 text-sm text-slate-500">ক্লায়েন্ট টার্গেট, পারফরম্যান্স ও কমপ্লায়েন্স ম্যানেজমেন্ট</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
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
  );
};
