import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { businessApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import { BUSINESS_WRITE_ROLES } from '@/lib/status.js';
import { RANGE_OPTIONS, rangeFor } from './range.js';
import { t } from '@/i18n/index.jsx';

const TABS = [
  { to: '', label: 'সামারি', end: true },
  { to: 'ads', label: 'অ্যাড পারফরম্যান্স' },
  { to: 'orders', label: 'সেল ও প্রি-অর্ডার' },
  { to: 'stock', label: 'প্রোডাক্ট ও স্টক' },
  { to: 'expenses', label: 'খরচ ও মার্কেটিং' },
  { to: 'accounting', label: 'মাসিক হিসাব' },
  { to: 'messages', label: 'মেসেজ' },
];

/**
 * A client's business ledger. Staff open it at /clients/:id/business;
 * a client login lands on /business and only ever sees its own data.
 */
export const BusinessWorkspace = () => {
  const { id } = useParams();
  const { user, can } = useAuth();
  const isClient = user.role === 'client';
  const clientId = Number(id ?? user.client_id);
  const [rangeKey, setRangeKey] = useState('all');
  const range = useMemo(() => rangeFor(rangeKey), [rangeKey]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['business', clientId, 'profile'],
    queryFn: () => businessApi.profile(clientId),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader
        breadcrumb={
          !isClient && (
            <Link to={`/clients/${clientId}`} className="hover:underline">
              {data.name}
            </Link>
          )
        }
        title={isClient ? t('{name} — আমার ব্যবসা', { name: data.name }) : 'ব্যবসার হিসাব'}
        subtitle={data.company || 'সেল, স্টক, প্রি-অর্ডার, মার্কেটিং খরচ ও প্রফিট — সব এক জায়গায়'}
        actions={
          <Select
            className="w-52"
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value)}
            options={RANGE_OPTIONS}
          />
        }
      />

      <div className="mb-5 overflow-x-auto border-b border-slate-200">
        <nav className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to || 'index'}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                clsx(
                  '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
                )
              }
            >
              {t(tab.label)}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet context={{ clientId, range, canWrite: can(...BUSINESS_WRITE_ROLES) }} />
    </>
  );
};
