import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { portalApi } from '@/api/endpoints.js';
import { Card, CardHeader } from '@/components/ui/Card.jsx';
import { StatTile } from '@/components/ui/StatTile.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Select } from '@/components/ui/Field.jsx';
import { Loading, ErrorState } from '@/components/ui/States.jsx';
import { InvoiceStateBadge } from '@/features/finance/InvoiceStateBadge.jsx';
import { currency, number, dateLabel } from '@/lib/format.js';
import { downloadFile } from '@/lib/download.js';
import { t } from '@/i18n/index.jsx';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [0, 1, 2].map((i) => ({ value: currentYear - i, label: String(currentYear - i) }));
const monthName = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString('en-US', { month: 'short' });

/** Monthly income vs. expense, the agency invoices behind it, and PDF/Excel exports. */
export const AccountingTab = () => {
  const { clientId } = useOutletContext();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [exporting, setExporting] = useState(null);

  const report = useQuery({
    queryKey: ['business', clientId, 'accounting', year],
    queryFn: () => portalApi.accounting(clientId, year),
  });
  const invoices = useQuery({
    queryKey: ['business', clientId, 'invoices'],
    queryFn: () => portalApi.invoices(clientId),
  });

  const runExport = async (key, file, params) => {
    setExporting(key);
    try {
      const { url, params: query } = portalApi.exportPath(clientId, file, params);
      await downloadFile(url, query);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(null);
    }
  };

  if (report.isLoading) return <Loading />;
  if (report.error) return <ErrorState error={report.error} onRetry={report.refetch} />;

  const { months, totals } = report.data;
  const activeMonths = months.filter((m) => m.revenue || m.ad_spend || m.agency_fee || m.other_expenses || m.product_cost);
  const monthOptions = months.map((m) => ({ value: m.month, label: `${monthName(m.month)} ${year}` }));

  const columns = [
    { key: 'month', header: 'মাস', render: (r) => `${monthName(r.month)} ${year}` },
    { key: 'revenue', header: 'সেল', align: 'right', render: (r) => currency(r.revenue) },
    { key: 'product_cost', header: 'প্রোডাক্ট খরচ', align: 'right', render: (r) => currency(r.product_cost) },
    {
      key: 'ad_spend',
      header: 'অ্যাড স্পেন্ড',
      align: 'right',
      render: (r) => (
        <span title={r.ad_spend_source ? t(r.ad_spend_source === 'synced' ? 'অ্যাড অ্যাকাউন্ট থেকে' : 'ম্যানুয়াল ট্র্যাকার থেকে') : undefined}>
          {currency(r.ad_spend)}
        </span>
      ),
    },
    { key: 'agency_fee', header: 'এজেন্সি ফি', align: 'right', render: (r) => currency(r.agency_fee) },
    { key: 'other_expenses', header: 'অন্যান্য খরচ', align: 'right', render: (r) => currency(r.other_expenses) },
    {
      key: 'net_profit',
      header: 'নিট প্রফিট',
      align: 'right',
      render: (r) => <span className={r.net_profit < 0 ? 'font-semibold text-rose-600' : 'font-semibold text-slate-900'}>{currency(r.net_profit)}</span>,
    },
  ];

  const invoiceColumns = [
    { key: 'invoice_no', header: 'ইনভয়েস', render: (r) => <span className="font-medium text-slate-800">{r.invoice_no}</span> },
    { key: 'period_month', header: 'সার্ভিস মাস', render: (r) => r.period_month.slice(0, 7) },
    { key: 'due_date', header: 'শেষ তারিখ', render: (r) => dateLabel(r.due_date) },
    { key: 'total', header: 'মোট', align: 'right', render: (r) => currency(r.total) },
    { key: 'paid', header: 'পরিশোধ', align: 'right', render: (r) => currency(r.paid) },
    { key: 'balance', header: 'বাকি', align: 'right', render: (r) => currency(r.balance) },
    { key: 'state', header: 'স্ট্যাটাস', render: (r) => <InvoiceStateBadge state={r.state} /> },
  ];

  const invoiceMeta = invoices.data?.meta;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} options={YEAR_OPTIONS} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" loading={exporting === 'xlsx'} onClick={() => runExport('xlsx', 'accounting.xlsx', { year })}>
            Excel ({year})
          </Button>
          <Select className="w-32" value={month} onChange={(e) => setMonth(e.target.value)} options={monthOptions} />
          <Button variant="secondary" loading={exporting === 'pdf'} onClick={() => runExport('pdf', 'accounting.pdf', { month })}>
            মাসিক রিপোর্ট PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="মোট সেল" value={currency(totals.revenue)} hint={t('{n} টি অর্ডার', { n: number(totals.orders) })} />
        <StatTile label="মোট খরচ" value={currency(totals.total_expense)} hint={t('অ্যাড {v}', { v: currency(totals.ad_spend) })} />
        <StatTile label="নিট প্রফিট" value={currency(totals.net_profit)} tone={totals.net_profit < 0 ? 'danger' : undefined} />
        <StatTile
          label="এজেন্সি ফি বাকি"
          value={currency(invoiceMeta?.outstanding ?? 0)}
          tone={invoiceMeta?.overdue > 0 ? 'danger' : undefined}
          hint={invoiceMeta?.overdue > 0 ? t('মেয়াদোত্তীর্ণ {v}', { v: currency(invoiceMeta.overdue) }) : undefined}
        />
      </div>

      <Card>
        <CardHeader title="মাসিক আয়-ব্যয়" subtitle="সেল − প্রোডাক্ট খরচ − অ্যাড স্পেন্ড − এজেন্সি ফি − অন্যান্য খরচ = নিট প্রফিট" />
        <Table
          columns={columns}
          rows={activeMonths}
          rowKey={(r) => r.month}
          empty="এই বছরে কোনো হিসাব নেই"
          footer={
            activeMonths.length
              ? {
                  month: 'মোট',
                  revenue: currency(totals.revenue),
                  product_cost: currency(totals.product_cost),
                  ad_spend: currency(totals.ad_spend),
                  agency_fee: currency(totals.agency_fee),
                  other_expenses: currency(totals.other_expenses),
                  net_profit: currency(totals.net_profit),
                }
              : null
          }
        />
      </Card>

      <Card>
        <CardHeader title="ইনভয়েস ও পেমেন্ট" subtitle="এজেন্সি ফি — পরিশোধিত ও বাকি" />
        {invoices.isLoading ? <Loading /> : <Table columns={invoiceColumns} rows={invoices.data?.rows || []} empty="কোনো ইনভয়েস নেই" />}
      </Card>
    </div>
  );
};
