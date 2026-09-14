import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { ROLE_LABEL, STAFF_ROLES } from '@/lib/status.js';
import { Button } from '@/components/ui/Button.jsx';

const NAV = [
  { to: '/business', label: 'আমার ব্যবসা', icon: '▦', roles: ['client'] },
  { to: '/', label: 'ওভারভিউ', icon: '▦', end: true, roles: STAFF_ROLES },
  { to: '/clients', label: 'ক্লায়েন্ট', icon: '👥', roles: STAFF_ROLES },
  { to: '/cycles', label: 'মাস / সাইকেল', icon: '🗓', roles: STAFF_ROLES },
  { to: '/users', label: 'টিম', icon: '⚙', roles: ['admin', 'manager'] },
];

export const AppLayout = () => {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => !item.roles || can(...item.roles));

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            R
          </span>
          <span className="font-semibold text-slate-900">Rainfall CRM</span>
        </div>
        <nav className="space-y-1 p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
          <button type="button" className="rounded p-2 text-slate-600 lg:hidden" onClick={() => setOpen(true)}>
            ☰
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.client_name || ROLE_LABEL[user?.role] || user?.role}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              লগআউট
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
