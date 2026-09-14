import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cyclesApi } from '@/api/endpoints.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { CYCLE_STATUS_LABEL } from '@/lib/status.js';
import { currency, dateLabel } from '@/lib/format.js';
import { tData } from '@/i18n/index.jsx';

const STATUS_OPTIONS = Object.entries(CYCLE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

export const CyclesPage = () => {
  const [status, setStatus] = useState('');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cycles', status],
    queryFn: () => cyclesApi.list({ status: status || undefined, limit: 100 }),
  });

  const columns = [
    {
      key: 'name',
      header: 'সাইকেল',
      render: (row) => (
        <Link to={`/cycles/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {tData(row.name)}
        </Link>
      ),
    },
    {
      key: 'client_name',
      header: 'ক্লায়েন্ট',
      render: (row) => (
        <Link to={`/clients/${row.client_id}`} className="hover:underline">
          {row.client_name}
        </Link>
      ),
    },
    { key: 'month_start', header: 'মাস শুরু', render: (r) => dateLabel(r.month_start) },
    { key: 'monthly_budget', header: 'বাজেট', align: 'right', render: (r) => currency(r.monthly_budget) },
    {
      key: 'status',
      header: 'স্ট্যাটাস',
      render: (r) => (
        <Badge tone={r.status === 'running' ? 'success' : r.status === 'planned' ? 'info' : 'muted'}>
          {CYCLE_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="মাস / সাইকেল" subtitle="সব ক্লায়েন্টের মাসিক ক্যাম্পেইন সাইকেল" />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <Select
            className="max-w-[200px]"
            placeholder="সব স্ট্যাটাস"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <Table columns={columns} rows={data.rows} empty="কোনো সাইকেল নেই" />
        )}
      </Card>
    </>
  );
};
