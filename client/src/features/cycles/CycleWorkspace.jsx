import { NavLink, Outlet, Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { cyclesApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { CYCLE_STATUS_LABEL } from '@/lib/status.js';
import { currency } from '@/lib/format.js';

const TABS = [
  { to: '', label: 'টার্গেট ও প্রজেকশন', end: true },
  { to: 'performance', label: 'পারফরম্যান্স ট্র্যাকার' },
  { to: 'control', label: 'কন্ট্রোল ইন্সপেকশন' },
  { to: 'tasks', label: 'ডেইলি টাস্ক কমপ্লায়েন্স' },
  { to: 'content', label: 'কন্টেন্ট ক্যালেন্ডার' },
  { to: 'summary', label: 'ড্যাশবোর্ড সামারি' },
];

export const CycleWorkspace = () => {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cycles', id, 'detail'],
    queryFn: () => cyclesApi.get(id),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to={`/clients/${data.client_id}`} className="hover:underline">
            {data.client_name}
          </Link>
        }
        title={`${data.name} · ${String(data.month_start).slice(0, 7)}`}
        subtitle={`মাসিক বাজেট ${currency(data.monthly_budget)} · ${data.weeks_count} সপ্তাহ`}
        actions={
          <Badge tone={data.status === 'running' ? 'success' : data.status === 'planned' ? 'info' : 'muted'}>
            {CYCLE_STATUS_LABEL[data.status]}
          </Badge>
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
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet context={{ cycle: data }} />
    </>
  );
};
