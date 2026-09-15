import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '@/api/endpoints.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { ROLE_LABEL, STAFF_ROLES } from '@/lib/status.js';
import { Button } from '@/components/ui/Button.jsx';
import { t } from '@/i18n/index.jsx';
import { LanguageSwitch } from './LanguageSwitch.jsx';
import { NotificationBell } from './NotificationBell.jsx';
import { ChangePasswordModal } from '@/features/auth/ChangePasswordModal.jsx';

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
    <path d={d} />
  </svg>
);

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Zm13-3a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2Zm14 7h.01',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z',
  check: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7.5 7.5 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
};

const NAV = [
  { to: '/business', label: 'আমার ব্যবসা', icon: 'home', end: true, roles: ['client'] },
  { to: '/business/ads', label: 'অ্যাড পারফরম্যান্স', icon: 'megaphone', roles: ['client'] },
  { to: '/business/accounting', label: 'হিসাব ও ইনভয়েস', icon: 'wallet', roles: ['client'] },
  { to: '/business/messages', label: 'মেসেজ', icon: 'chat', roles: ['client'] },
  { to: '/', label: 'ওভারভিউ', icon: 'chart', end: true, roles: STAFF_ROLES },
  { to: '/inbox', label: 'ইনবক্স', icon: 'chat', badge: 'chat' },
  { to: '/clients', label: 'ক্লায়েন্ট', icon: 'users', roles: STAFF_ROLES },
  { to: '/ad-accounts', label: 'অ্যাড অ্যাকাউন্ট', icon: 'megaphone', roles: STAFF_ROLES },
  { to: '/cycles', label: 'মাস / সাইকেল', icon: 'calendar', roles: STAFF_ROLES },
  { to: '/tasks', label: 'টাস্ক', icon: 'check', roles: STAFF_ROLES },
  { to: '/finance', label: 'ফাইন্যান্স', icon: 'wallet', roles: ['admin', 'manager'] },
  { to: '/team', label: 'টিম পারফরম্যান্স', icon: 'users', roles: ['admin', 'manager'] },
  { to: '/users', label: 'ইউজার ও রোল', icon: 'settings', roles: ['admin', 'manager'] },
];

const Brand = () => (
  <div className="flex items-center gap-2.5">
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
      R
    </span>
    <span className="font-semibold tracking-tight text-slate-900">Rainfall CRM</span>
  </div>
);

export const AppLayout = () => {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const { data: chat } = useQuery({ queryKey: ['chat', 'unread'], queryFn: chatApi.unread, refetchInterval: 30_000 });
  const chatUnread = chat?.unread || 0;

  const items = NAV.filter((item) => !item.roles || can(...item.roles));
  const initials = (user?.name || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0 shadow-xl' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center border-b border-slate-100 px-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-50 text-brand-700 shadow-[inset_3px_0_0] shadow-brand-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <Icon d={ICONS[item.icon]} />
              {t(item.label)}
              {item.badge === 'chat' && chatUnread > 0 && (
                <span className="ml-auto rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">{chatUnread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3 lg:hidden">
          <LanguageSwitch className="w-full justify-center" />
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            aria-label={t('মেনু')}
            className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Icon d="M4 6h16M4 12h16M4 18h16" />
          </button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <LanguageSwitch className="hidden sm:inline-flex" />
            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
            <button
              type="button"
              title={t('পাসওয়ার্ড পরিবর্তন')}
              onClick={() => setChangingPassword(true)}
              className="flex items-center gap-2.5 rounded-lg p-1 text-left hover:bg-slate-100"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {initials}
              </span>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight text-slate-800">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.client_name || t(ROLE_LABEL[user?.role]) || user?.role}</p>
              </div>
            </button>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              লগআউট
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
        {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} onChanged={handleLogout} />}
      </div>
    </div>
  );
};
