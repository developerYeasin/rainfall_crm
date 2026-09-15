import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * File builders for accounting/sales exports. Reports are in English: PDFKit's built-in
 * fonts cannot shape Bangla, and accountants/tax filings expect English anyway.
 */

const MONEY_FMT = '#,##0.00';

/**
 * The web app fetches exports with its bearer token and saves them itself, reading only the filename.
 * `inline` keeps that filename but avoids browsers turning a cross-origin fetch into a download (which fails it).
 */
const contentDisposition = (filename) => `inline; filename="${filename}"`;
const monthLabel = (ym) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const tk = (n) => `BDT ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** columns: [{ header, key, width?, money? }] */
const addSheet = (workbook, name, columns, rows, totals) => {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } };
  rows.forEach((r) => sheet.addRow(r));
  if (totals) {
    const row = sheet.addRow(totals);
    row.font = { bold: true };
  }
  columns.forEach((c, i) => {
    if (c.money) sheet.getColumn(i + 1).numFmt = MONEY_FMT;
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return sheet;
};

export const sendWorkbook = async (res, filename, build) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rainfall CRM';
  workbook.created = new Date();
  build(workbook);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', contentDisposition(filename));
  await workbook.xlsx.write(res);
  res.end();
};

// ---------------------------------------------------------------- client accounting

const ACCOUNTING_COLUMNS = [
  { header: 'Month', key: 'label', width: 12 },
  { header: 'Sales revenue', key: 'revenue', money: true },
  { header: 'Orders', key: 'orders', width: 10 },
  { header: 'Product cost', key: 'product_cost', money: true },
  { header: 'Gross profit', key: 'gross_profit', money: true },
  { header: 'Ad spend', key: 'ad_spend', money: true },
  { header: 'Agency fee', key: 'agency_fee', money: true },
  { header: 'Other expenses', key: 'other_expenses', money: true },
  { header: 'Net profit', key: 'net_profit', money: true },
];

export const accountingWorkbook = (report, invoices) => (workbook) => {
  addSheet(
    workbook,
    `P&L ${report.year}`,
    ACCOUNTING_COLUMNS,
    report.months.map((m) => ({ ...m, label: monthLabel(m.month) })),
    { ...report.totals, label: 'Total' },
  );
  addSheet(
    workbook,
    'Invoices',
    [
      { header: 'Invoice', key: 'invoice_no', width: 18 },
      { header: 'Service month', key: 'period', width: 14 },
      { header: 'Issued', key: 'issue_date', width: 12 },
      { header: 'Due', key: 'due_date', width: 12 },
      { header: 'Total', key: 'total', money: true },
      { header: 'Paid', key: 'paid', money: true },
      { header: 'Balance', key: 'balance', money: true },
      { header: 'Status', key: 'state', width: 12 },
    ],
    invoices.map((i) => ({ ...i, period: monthLabel(i.period_month.slice(0, 7)) })),
  );
};

export const salesWorkbook = (orders) => (workbook) => {
  addSheet(
    workbook,
    'Sales',
    [
      { header: 'Date', key: 'order_date', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Product', key: 'product_name', width: 28 },
      { header: 'Qty', key: 'qty', width: 8 },
      { header: 'Unit price', key: 'unit_price', money: true },
      { header: 'Discount', key: 'discount', money: true },
      { header: 'Amount', key: 'amount', money: true },
      { header: 'Paid', key: 'paid_amount', money: true },
      { header: 'Due', key: 'due', money: true },
      { header: 'Profit', key: 'profit', money: true },
      { header: 'Customer', key: 'customer_name', width: 20 },
      { header: 'Phone', key: 'customer_phone', width: 16 },
      { header: 'Source', key: 'source', width: 20 },
    ],
    orders,
  );
};

/** One-month client report: P&L lines, expense categories and invoices for that month. */
export const sendAccountingPdf = (res, filename, { report, month, invoices, ads }) => {
  const m = report.months.find((row) => row.month === month);
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  // Not application/pdf: Chrome's PDF viewer intercepts that type and hands a cross-origin fetch an empty
  // header-less 204, which fails CORS. The web app saves the blob under the .pdf filename either way.
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', contentDisposition(filename));
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text('Rainfall Media');
  doc.fontSize(10).font('Helvetica').fillColor('#555').text('Monthly business report');
  doc.moveDown();
  doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text(report.client?.company || report.client?.name || 'Client');
  doc.fontSize(11).font('Helvetica').text(monthLabel(month));
  doc.fontSize(9).fillColor('#777').text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  doc.fillColor('#000').moveDown();

  const line = (label, value, { bold = false, indent = 0 } = {}) => {
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11);
    doc.text(label, 48 + indent, y, { width: 300 });
    doc.text(value, 350, y, { width: 197, align: 'right' });
    doc.moveDown(0.4);
  };
  const rule = () => {
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.4);
  };

  doc.font('Helvetica-Bold').fontSize(12).text('Profit & loss');
  doc.moveDown(0.5);
  line('Sales revenue', tk(m.revenue));
  line(`Orders`, String(m.orders));
  line('Product cost', `- ${tk(m.product_cost)}`);
  line('Gross profit', tk(m.gross_profit), { bold: true });
  rule();
  line(`Ad spend${m.ad_spend_source ? ` (${m.ad_spend_source})` : ''}`, `- ${tk(m.ad_spend)}`);
  line('Agency fee', `- ${tk(m.agency_fee)}`);
  line('Other expenses', `- ${tk(m.other_expenses)}`);
  m.expenses_by_category.forEach((e) => line(e.category, tk(e.total), { indent: 16 }));
  rule();
  line('Net profit', tk(m.net_profit), { bold: true });

  if (ads) {
    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(12).text('Advertising');
    doc.moveDown(0.5);
    line('Spend', tk(ads.totals.spend));
    line('Impressions', ads.totals.impressions.toLocaleString('en-US'));
    line('Clicks', ads.totals.clicks.toLocaleString('en-US'));
    line('Results', ads.totals.results.toLocaleString('en-US'));
    line('Cost per result', ads.totals.cost_per_result === null ? '-' : tk(ads.totals.cost_per_result));
    line('Sales per BDT 1 of ad spend', ads.sales.blended_roas === null ? '-' : `${ads.sales.blended_roas}x`);
  }

  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(12).text('Agency invoices');
  doc.moveDown(0.5);
  if (!invoices.length) doc.font('Helvetica').fontSize(11).text('No invoices for this month.');
  invoices.forEach((i) => line(`${i.invoice_no} · due ${i.due_date} · ${i.state}`, `${tk(i.paid)} / ${tk(i.total)}`));

  doc.end();
};

// ---------------------------------------------------------------- agency

export const agencyPnlWorkbook = (pnl, invoices, expenses) => (workbook) => {
  addSheet(
    workbook,
    `Agency P&L ${pnl.year}`,
    [
      { header: 'Month', key: 'label', width: 12 },
      { header: 'Fees invoiced', key: 'invoiced', money: true },
      { header: 'Fees collected', key: 'collected', money: true },
      { header: 'Agency expenses', key: 'expenses', money: true },
      { header: 'Profit (cash)', key: 'profit', money: true },
    ],
    pnl.months.map((m) => ({ ...m, label: monthLabel(m.month) })),
    { ...pnl.totals, label: 'Total' },
  );
  addSheet(
    workbook,
    'By client',
    [
      { header: 'Client', key: 'name', width: 28 },
      { header: 'Invoiced', key: 'invoiced', money: true },
      { header: 'Collected', key: 'collected', money: true },
      { header: 'Outstanding', key: 'outstanding', money: true },
    ],
    pnl.by_client,
  );
  addSheet(
    workbook,
    'Invoices',
    [
      { header: 'Invoice', key: 'invoice_no', width: 18 },
      { header: 'Client', key: 'client_name', width: 24 },
      { header: 'Service month', key: 'period_month', width: 14 },
      { header: 'Issued', key: 'issue_date', width: 12 },
      { header: 'Due', key: 'due_date', width: 12 },
      { header: 'Total', key: 'total', money: true },
      { header: 'Paid', key: 'paid', money: true },
      { header: 'Balance', key: 'balance', money: true },
      { header: 'Status', key: 'state', width: 12 },
    ],
    invoices,
  );
  addSheet(
    workbook,
    'Expenses',
    [
      { header: 'Date', key: 'expense_date', width: 12 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Amount', key: 'amount', money: true },
      { header: 'Note', key: 'note', width: 40 },
    ],
    expenses,
  );
};
