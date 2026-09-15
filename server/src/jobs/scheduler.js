import { query } from '../db/pool.js';
import { config } from '../config/index.js';
import { clientUserIds, adminIds, notifyUsers } from '../utils/notify.js';
import { decorateInvoice } from '../modules/finance/finance.service.js';
import { syncAllAccounts } from '../modules/ads/ads.sync.js';

/**
 * In-process scheduler. Jobs are idempotent (dedupe keys on notifications, upserts on insights),
 * so a restart or a second instance only causes a harmless re-run.
 */

const HOUR = 60 * 60 * 1000;

const run = (name, fn) => async () => {
  const started = Date.now();
  try {
    const result = await fn();
    console.log(`[job] ${name} done in ${Date.now() - started}ms`, result ?? '');
  } catch (err) {
    console.error(`[job] ${name} failed:`, err.message);
  }
};

/** Unpaid invoices: one reminder 3 days before the due date, one when it turns overdue. */
export const invoiceReminders = async () => {
  const rows = await query(
    `SELECT i.*, c.name AS client_name, COALESCE(p.paid, 0) AS paid
     FROM invoices i JOIN clients c ON c.id = i.client_id
     LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM invoice_payments GROUP BY invoice_id) p ON p.invoice_id = i.id
     WHERE i.status = 'issued' AND i.due_date <= CURDATE() + INTERVAL 3 DAY`,
  );
  const admins = await adminIds();
  let sent = 0;
  for (const row of rows) {
    const invoice = decorateInvoice(row);
    if (invoice.balance <= 0) continue;
    const stage = invoice.state === 'overdue' ? 'overdue' : 'due_soon';
    const data = { invoice_no: invoice.invoice_no, balance: invoice.balance, due_date: invoice.due_date, client: invoice.client_name, stage };
    await notifyUsers(await clientUserIds(invoice.client_id), {
      type: 'invoice_due',
      data,
      link: 'business:accounting',
      clientId: invoice.client_id,
      dedupeKey: `invoice-${invoice.id}-${stage}`,
      email: {
        subject: stage === 'overdue' ? `Invoice ${invoice.invoice_no} is overdue` : `Invoice ${invoice.invoice_no} is due on ${invoice.due_date}`,
        text: `Balance due: BDT ${invoice.balance} (due ${invoice.due_date}).\n\n${config.jobs.appUrl}/business/accounting`,
      },
    });
    if (stage === 'overdue') {
      await notifyUsers(admins, { type: 'invoice_due', data, link: '/finance', clientId: invoice.client_id, dedupeKey: `invoice-${invoice.id}-overdue` });
    }
    sent += 1;
  }
  return { invoices: sent };
};

export const overdueTasks = async () => {
  const rows = await query(
    `SELECT t.id, t.title, t.assignee_id, t.created_by, t.due_date, t.client_id, c.name AS client_name
     FROM agency_tasks t LEFT JOIN clients c ON c.id = t.client_id
     WHERE t.status = 'open' AND t.due_date < CURDATE()`,
  );
  for (const t of rows) {
    await notifyUsers([t.assignee_id, t.created_by], {
      type: 'task_overdue',
      data: { title: t.title, due_date: String(t.due_date).slice(0, 10), client: t.client_name },
      link: '/tasks',
      clientId: t.client_id,
      dedupeKey: `task-${t.id}-overdue`,
    });
  }
  return { tasks: rows.length };
};

export const startScheduler = () => {
  if (!config.jobs.enabled) {
    console.log('[job] scheduler disabled (JOBS_ENABLED=false)');
    return;
  }
  const adSync = run('ad-sync', syncAllAccounts);
  const hourly = run('reminders', async () => ({ ...(await invoiceReminders()), ...(await overdueTasks()) }));

  // Stagger the first runs so startup stays fast.
  setTimeout(adSync, 60_000).unref();
  setTimeout(hourly, 90_000).unref();
  setInterval(adSync, Math.max(config.jobs.adSyncHours, 0.25) * HOUR).unref();
  setInterval(hourly, HOUR).unref();
  console.log(`[job] scheduler on — ad sync every ${config.jobs.adSyncHours}h, reminders hourly`);
};
