import bcrypt from 'bcryptjs';
import { pool, query, queryOne } from './pool.js';
import { config } from '../config/index.js';
import { runMigrations } from './migrate.js';

/**
 * Seeds the team, plus one demo client carrying exactly the numbers that live
 * in the source Google Sheet, so the app can be verified against it row for row.
 */
const upsertUser = async ({ name, email, password, role, clientId = null }) => {
  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return existing.id;
  const hash = await bcrypt.hash(password, 10);
  const res = await query('INSERT INTO users (name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?)', [
    name,
    email,
    hash,
    role,
    clientId,
  ]);
  console.log(`[seed] user ${email} (${role})`);
  return res.insertId;
};

const seed = async () => {
  await runMigrations();

  const adminId = await upsertUser({
    name: 'Rainfall Admin',
    email: config.seed.adminEmail,
    password: config.seed.adminPassword,
    role: 'admin',
  });
  const managerId = await upsertUser({
    name: 'অ্যাকাউন্ট ম্যানেজার',
    email: 'manager@rainfall.com',
    password: 'Manager@123',
    role: 'manager',
  });
  const buyerId = await upsertUser({
    name: 'মিডিয়া বায়ার',
    email: 'buyer@rainfall.com',
    password: 'Buyer@123',
    role: 'media_buyer',
  });
  await upsertUser({
    name: 'ডিজাইনার',
    email: 'designer@rainfall.com',
    password: 'Designer@123',
    role: 'designer',
  });

  let client = await queryOne('SELECT id FROM clients WHERE name = ?', ['ডেমো ক্লায়েন্ট']);
  if (!client) {
    const res = await query(
      `INSERT INTO clients (name, company, contact_person, email, phone, industry, status, onboarded_at,
                            monthly_retainer, account_manager_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'active', '2026-09-01', 25000, ?, ?, ?)`,
      [
        'ডেমো ক্লায়েন্ট',
        'Demo Fashion BD',
        'রাকিব হাসান',
        'demo@client.com',
        '+8801700000000',
        'ই-কমার্স / ফ্যাশন',
        managerId,
        'গুগল শীট থেকে মাইগ্রেট করা ডেমো ডেটা',
        adminId,
      ],
    );
    client = { id: res.insertId };
    console.log('[seed] demo client');
  }

  let cycle = await queryOne('SELECT id FROM cycles WHERE client_id = ? AND month_start = ?', [client.id, '2026-09-01']);
  if (!cycle) {
    const res = await query(
      `INSERT INTO cycles (client_id, name, month_start, weeks_count, status, monthly_budget,
                           expected_ctr, expected_cpc, expected_conversion_rate, aov, created_by)
       VALUES (?, 'মাস ১', '2026-09-01', 4, 'running', 60000, 0.02, 3.5, 0.02, 900, ?)`,
      [client.id, adminId],
    );
    cycle = { id: res.insertId };

    const bn = ['১', '২', '৩', '৪'];
    for (let i = 0; i < 4; i += 1) {
      const start = new Date(Date.UTC(2026, 8, 1 + i * 7));
      const end = new Date(Date.UTC(2026, 8, 7 + i * 7));
      await query(
        'INSERT INTO target_weeks (cycle_id, week_no, label, start_date, end_date, budget) VALUES (?, ?, ?, ?, ?, 15000)',
        [cycle.id, i + 1, `সপ্তাহ ${bn[i]}`, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)],
      );
    }

    // The three real rows from the "পারফরম্যান্স ট্র্যাকার" tab.
    const entries = [
      ['2026-09-01', 1, 'Facebook', 2000, 45000, 900, 18, 9500],
      ['2026-09-02', 1, 'Facebook', 2200, 48000, 1020, 22, 11800],
      ['2026-09-08', 2, 'Facebook', 2100, 46000, 950, 19, 9800],
    ];
    for (const [date, week, platform, spend, impressions, clicks, conversions, revenue] of entries) {
      await query(
        `INSERT INTO performance_entries (cycle_id, entry_date, week_no, platform, spend, impressions, clicks, conversions, revenue, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cycle.id, date, week, platform, spend, impressions, clicks, conversions, revenue, buyerId],
      );
    }

    await query(
      `INSERT INTO task_compliance (cycle_id, task_date, task_name, owner_label, assignee_id,
                                    morning_check, ad_monitoring_done, report_updated, client_update_sent)
       VALUES (?, '2026-09-01', 'Facebook Ads Media Buyer', 'মিডিয়া বায়ার', ?, 1, 1, 1, 1)`,
      [cycle.id, buyerId],
    );

    const contentRows = [
      ['2026-09-05', 'Facebook', 'পোস্ট', 'প্রোডাক্ট লঞ্চ অ্যানাউন্সমেন্ট', 'আইডিয়া', 'উদাহরণ'],
      ['2026-09-07', 'Instagram', 'রিল/ভিডিও', 'বিহাইন্ড দ্য সিন', 'ড্রাফট', null],
    ];
    for (const [planDate, platform, type, topic, status, note] of contentRows) {
      await query(
        'INSERT INTO content_calendar (cycle_id, plan_date, platform, content_type, topic, status, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [cycle.id, planDate, platform, type, topic, status, note],
      );
    }
    console.log('[seed] demo cycle with sheet data');
  }

  // The demo client's own portal login, plus a small shop ledger to populate it.
  await upsertUser({
    name: 'রাকিব হাসান',
    email: 'client@rainfall.com',
    password: 'Client@123',
    role: 'client',
    clientId: client.id,
  });

  const hasProducts = await queryOne('SELECT id FROM products WHERE client_id = ? LIMIT 1', [client.id]);
  if (!hasProducts) {
    const productIds = {};
    const products = [
      ['পাঞ্জাবি — ক্লাসিক', 'PNJ-01', 'পাঞ্জাবি', 650, 1250, 40, 5],
      ['শাড়ি — জামদানি', 'SAR-01', 'শাড়ি', 1800, 3200, 12, 3],
      ['কুর্তি — কটন', 'KRT-01', 'কুর্তি', 380, 850, 30, 5],
    ];
    for (const [name, sku, category, cost, price, opening, alert] of products) {
      const res = await query(
        `INSERT INTO products (client_id, name, sku, category, cost_price, sale_price, opening_stock, low_stock_alert, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [client.id, name, sku, category, cost, price, opening, alert, adminId],
      );
      productIds[sku] = res.insertId;
    }

    await query(
      `INSERT INTO stock_purchases (client_id, product_id, purchase_date, qty, unit_cost, supplier, created_by)
       VALUES (?, ?, '2026-09-03', 20, 650, 'লোকাল সাপ্লায়ার', ?)`,
      [client.id, productIds['PNJ-01'], adminId],
    );

    // [sku, date, status, qty, price, discount, paid, customer]
    const orders = [
      ['PNJ-01', '2026-09-01', 'delivered', 3, 1250, 0, 3750, 'সাকিব'],
      ['PNJ-01', '2026-09-02', 'delivered', 5, 1250, 250, 6000, 'তানভীর'],
      ['SAR-01', '2026-09-02', 'delivered', 2, 3200, 0, 6400, 'নুসরাত'],
      ['KRT-01', '2026-09-05', 'confirmed', 4, 850, 0, 1000, 'মিম'],
      ['SAR-01', '2026-09-08', 'pre_order', 3, 3200, 0, 2000, 'ফারহানা'],
      ['KRT-01', '2026-09-09', 'returned', 1, 850, 0, 0, 'রুমা'],
      ['PNJ-01', '2026-09-10', 'cancelled', 2, 1250, 0, 0, 'আরিফ'],
    ];
    const costBySku = Object.fromEntries(products.map(([, sku, , cost]) => [sku, cost]));
    for (const [sku, date, status, qty, price, discount, paid, customer] of orders) {
      await query(
        `INSERT INTO orders (client_id, product_id, order_date, status, qty, unit_price, unit_cost, discount, paid_amount, customer_name, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [client.id, productIds[sku], date, status, qty, price, costBySku[sku], discount, paid, customer, adminId],
      );
    }

    const expenses = [
      ['2026-09-01', 'delivery', 1200, 'কুরিয়ার চার্জ'],
      ['2026-09-02', 'packaging', 800, 'বক্স ও ব্যাগ'],
      ['2026-09-05', 'marketing', 1500, 'ইনফ্লুয়েন্সার পোস্ট'],
      ['2026-09-07', 'salary', 8000, 'প্যাকিং স্টাফ'],
    ];
    for (const [date, category, amount, note] of expenses) {
      await query(
        'INSERT INTO expenses (client_id, expense_date, category, amount, note, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [client.id, date, category, amount, note, adminId],
      );
    }
    console.log('[seed] demo client business ledger');
  }

  console.log('[seed] done');
};

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[seed] failed:', err);
    pool.end();
    process.exit(1);
  });
