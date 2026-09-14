import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import clsx from 'clsx';
import { businessApi } from '@/api/endpoints.js';
import { Card, CardHeader, CardBody } from '@/components/ui/Card.jsx';
import { StatTile } from '@/components/ui/StatTile.jsx';
import { Table } from '@/components/ui/Table.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Loading, ErrorState, EmptyState } from '@/components/ui/States.jsx';
import { currency, number, percent, roas } from '@/lib/format.js';
import { EXPENSE_CATEGORY_LABEL, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, STOCK_STATUS } from '@/lib/status.js';

/** One line of a P&L / cash statement. `total` rows are bold with a rule above. */
const Line = ({ label, value, sign, total, hint }) => (
  <tr className={clsx(total && 'border-t-2 border-slate-200 bg-slate-50')}>
    <td className={clsx(total ? 'font-semibold text-slate-900' : 'text-slate-700', !total && sign && 'pl-8')}>
      {sign && <span className="mr-1 text-slate-400">{sign}</span>}
      {label}
      {hint && <span className="ml-2 text-xs text-slate-400">{hint}</span>}
    </td>
    <td
      className={clsx(
        'text-right',
        total ? 'font-semibold' : 'font-medium',
        value < 0 ? 'text-rose-600' : 'text-slate-900',
      )}
    >
      {currency(value)}
    </td>
  </tr>
);

export const BusinessSummaryTab = () => {
  const { clientId, range } = useOutletContext();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['business', clientId, 'summary', range],
    queryFn: () => businessApi.summary(clientId, range),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { sales, pre_orders: pre, stock, marketing, expenses, profit, cash, purchases } = data;
  const nonMarketingExpenses = expenses.by_category.filter((e) => e.category !== 'marketing');

  const statusStrip = [
    ['delivered', sales.delivered_orders],
    ['confirmed', sales.pending_delivery_orders],
    ['pre_order', pre.orders],
    ['returned', data.returns.orders],
    ['cancelled', data.cancelled.orders],
  ];

  const topColumns = [
    { key: 'name', header: 'প্রোডাক্ট' },
    { key: 'qty', header: 'সেল (পিস)', align: 'right', render: (r) => number(r.qty) },
    { key: 'revenue', header: 'সেল (৳)', align: 'right', render: (r) => currency(r.revenue) },
    { key: 'profit', header: 'গ্রস প্রফিট', align: 'right', render: (r) => currency(r.profit) },
  ];

  const alertColumns = [
    { key: 'name', header: 'প্রোডাক্ট' },
    { key: 'in_stock', header: 'স্টক', align: 'right', render: (r) => number(r.in_stock) },
    { key: 'pre_order_qty', header: 'প্রি-অর্ডার', align: 'right', render: (r) => number(r.pre_order_qty) },
    {
      key: 'stock_status',
      header: '',
      render: (r) =>
        r.available < 0 ? (
          <Badge tone="danger">{number(-r.available)} পিস কম</Badge>
        ) : (
          <Badge tone={STOCK_STATUS[r.stock_status].tone}>{STOCK_STATUS[r.stock_status].label}</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="মোট সেল"
          value={currency(sales.revenue)}
          hint={`${number(sales.orders)} অর্ডার · ${number(sales.qty)} পিস`}
        />
        <StatTile
          label="নিট প্রফিট"
          value={currency(profit.net)}
          tone={profit.net < 0 ? 'danger' : undefined}
          hint={`মার্জিন ${percent(profit.margin, 1)} · গ্রস ${currency(profit.gross)}`}
        />
        <StatTile
          label="ক্যাশ ব্যালেন্স"
          value={currency(cash.balance)}
          tone={cash.balance < 0 ? 'danger' : undefined}
          hint={`ইন ${currency(cash.in)} · আউট ${currency(cash.out)}`}
        />
        <StatTile
          label="মোট মার্কেটিং খরচ"
          value={currency(marketing.total)}
          hint={`ROAS ${roas(marketing.roas)} · প্রতি অর্ডার ${currency(marketing.cost_per_order)}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="সেল হয়েছে" value={`${number(sales.qty)} পিস`} hint={`গড় অর্ডার ${currency(sales.avg_order_value)}`} />
        <StatTile
          label="স্টকে আছে (এখন)"
          value={`${number(stock.units)} পিস`}
          hint={`কেনা দামে ${currency(stock.value)} · ${number(stock.active_products)} প্রোডাক্ট`}
        />
        <StatTile
          label="প্রি-অর্ডার"
          value={`${number(pre.qty)} পিস`}
          hint={`${number(pre.orders)} অর্ডার · ${currency(pre.value)} · অগ্রিম ${currency(pre.advance)}`}
        />
        <StatTile
          label="কাস্টমারের কাছে বাকি"
          value={currency(sales.due)}
          tone={sales.due > 0 ? 'danger' : undefined}
          hint={`পেমেন্ট পাওয়া ${currency(sales.cash_received)}`}
        />
      </div>

      <Card>
        <CardBody className="flex flex-wrap gap-x-6 gap-y-2 py-3">
          {statusStrip.map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 text-sm">
              <Badge tone={ORDER_STATUS_TONE[status]}>{ORDER_STATUS_LABEL[status]}</Badge>
              <span className="font-semibold text-slate-800">{number(count)}</span>
            </div>
          ))}
          <div className="ml-auto text-sm text-slate-500">
            স্টক অ্যালার্ট: <span className="font-medium text-amber-700">{number(stock.low)} কম</span> ·{' '}
            <span className="font-medium text-rose-700">{number(stock.out)} শেষ</span>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="প্রফিট হিসাব" subtitle="সেল থেকে সব খরচ বাদ দিয়ে নিট লাভ" />
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <Line label="মোট সেল" value={sales.revenue} hint="কনফার্মড + ডেলিভারড, ডিসকাউন্ট বাদে" />
                <Line sign="−" label="প্রোডাক্টের কেনা দাম" value={-sales.cogs} />
                <Line total label="গ্রস প্রফিট" value={profit.gross} />
                <Line sign="−" label="অ্যাড স্পেন্ড" value={-marketing.ad_spend} hint="পারফরম্যান্স ট্র্যাকার থেকে" />
                <Line sign="−" label="অন্যান্য মার্কেটিং" value={-marketing.other_marketing} />
                {nonMarketingExpenses.map((e) => (
                  <Line key={e.category} sign="−" label={EXPENSE_CATEGORY_LABEL[e.category]} value={-e.total} />
                ))}
                <Line total label="নিট প্রফিট" value={profit.net} hint={`মার্জিন ${percent(profit.margin, 1)}`} />
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="ক্যাশ হিসাব" subtitle="আসলে হাতে কত টাকা এসেছে ও গেছে" />
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <Line label="সেলের পেমেন্ট পাওয়া" value={sales.cash_received} />
                <Line label="প্রি-অর্ডারের অগ্রিম" value={pre.advance} />
                <Line total label="মোট ক্যাশ ইন" value={cash.in} />
                <Line sign="−" label="স্টক কেনা" value={-purchases.cost} hint={`${number(purchases.qty)} পিস`} />
                <Line sign="−" label="অ্যাড স্পেন্ড" value={-marketing.ad_spend} />
                <Line sign="−" label="অন্যান্য সব খরচ" value={-expenses.total} />
                <Line total label="ক্যাশ ব্যালেন্স" value={cash.balance} />
              </tbody>
            </table>
          </div>
          <CardBody className="border-t border-slate-100 py-3 text-xs text-slate-500">
            প্রফিট আর ক্যাশ আলাদা: কাস্টমারের বাকি {currency(sales.due)} ও স্টকে থাকা মাল {currency(stock.value)}{' '}
            এখনো ক্যাশ হয়নি।
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="মাসভিত্তিক ট্রেন্ড" subtitle="সেল, মার্কেটিং খরচ ও নিট প্রফিট" />
        <CardBody>
          {data.monthly.length === 0 ? (
            <EmptyState title="কোনো ডেটা নেই" description="সেল ও খরচ এন্ট্রি দিলে এখানে দেখা যাবে" />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  maxBarSize={48}
                  data={data.monthly.map((m) => ({ ...m, marketing: m.ad_spend }))}
                  margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip formatter={(v) => currency(v)} />
                  <Legend />
                  <Bar dataKey="revenue" name="সেল" fill="#3182f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="marketing" name="অ্যাড স্পেন্ড" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net_profit" name="নিট প্রফিট" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="সবচেয়ে বেশি বিক্রি" />
          <Table columns={topColumns} rows={data.top_products} empty="এখনো কোনো সেল নেই" />
        </Card>
        <Card>
          <CardHeader title="স্টক অ্যালার্ট" subtitle="কম/শেষ স্টক ও প্রি-অর্ডারের ঘাটতি" />
          <Table columns={alertColumns} rows={stock.alerts} empty="সব প্রোডাক্টে যথেষ্ট স্টক আছে" />
        </Card>
      </div>
    </div>
  );
};
