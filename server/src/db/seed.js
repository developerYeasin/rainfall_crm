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

  // The media buyer works on the demo client (tenant scoping: staff only see assigned clients).
  await query('INSERT IGNORE INTO client_staff (client_id, user_id) VALUES (?, ?), (?, ?)', [client.id, managerId, client.id, buyerId]);

  // A second client nobody but the admin is assigned to — useful for checking data isolation.
  let other = await queryOne('SELECT id FROM clients WHERE name = ?', ['Glow Cosmetics']);
  if (!other) {
    const res = await query(
      `INSERT INTO clients (name, company, contact_person, industry, status, onboarded_at, monthly_retainer, created_by)
       VALUES ('Glow Cosmetics', 'Glow Cosmetics Ltd', 'Sadia Rahman', 'Beauty', 'active', '2026-08-15', 30000, ?)`,
      [adminId],
    );
    other = { id: res.insertId };
    await upsertUser({ name: 'Sadia Rahman', email: 'glow@client.com', password: 'Client@123', role: 'client', clientId: other.id });
    console.log('[seed] second client (isolation check)');
  }

  // Sample synced Meta data so the Ads dashboard has something to show before a real token is connected.
  const hasAccount = await queryOne('SELECT id FROM ad_accounts WHERE client_id = ? LIMIT 1', [client.id]);
  if (!hasAccount) {
    const res = await query(
      `INSERT INTO ad_accounts (client_id, platform, external_id, name, currency, daily_budget, assigned_user_id, is_active, last_synced_at, created_by)
       VALUES (?, 'meta', 'DEMO0001', 'Demo Fashion BD — sample data', 'BDT', 2000, ?, 0, NOW(), ?)`,
      [client.id, buyerId, adminId],
    );
    const accountId = res.insertId;
    const campaigns = [
      { id: 'demo_c1', name: 'Eid Collection — Sales', adsets: [['demo_s1', 'Dhaka 18-34 Women'], ['demo_s2', 'Lookalike Buyers 1%']], share: 0.65 },
      { id: 'demo_c2', name: 'Retargeting — Catalog', adsets: [['demo_s3', 'Viewed 30d'], ['demo_s4', 'Add to cart 14d']], share: 0.35 },
    ];
    const rows = [];
    for (let d = 29; d >= 0; d -= 1) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      // Deterministic wobble so re-seeding gives the same chart.
      const wobble = 0.8 + ((d * 37) % 40) / 100;
      const day = { spend: 0, impressions: 0, clicks: 0, results: 0, value: 0 };
      for (const c of campaigns) {
        const camp = { spend: 0, impressions: 0, clicks: 0, results: 0, value: 0 };
        c.adsets.forEach(([sid, sname], i) => {
          const spend = Math.round(1900 * c.share * wobble * (i ? 0.45 : 0.55));
          const impressions = Math.round(spend * 22);
          const clicks = Math.round(impressions * 0.019);
          const results = Math.round(clicks * (c.id === 'demo_c2' ? 0.05 : 0.03));
          const value = results * 1350;
          rows.push([accountId, client.id, 'adset', sid, sname, c.id, date, spend, impressions, clicks, results, value]);
          for (const [k, v] of Object.entries({ spend, impressions, clicks, results, value })) camp[k] += v;
        });
        rows.push([accountId, client.id, 'campaign', c.id, c.name, null, date, camp.spend, camp.impressions, camp.clicks, camp.results, camp.value]);
        for (const k of Object.keys(day)) day[k] += camp[k];
      }
      rows.push([accountId, client.id, 'account', 'DEMO0001', null, null, date, day.spend, day.impressions, day.clicks, day.results, day.value]);
    }
    for (const r of rows) {
      await query(
        `INSERT INTO ad_insights (ad_account_id, client_id, level, object_id, object_name, parent_id, stat_date, spend, impressions, clicks, results, purchase_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r,
      );
    }
    console.log('[seed] demo ad account + 30 days of insights');
  }

  const hasInvoice = await queryOne('SELECT id FROM invoices WHERE client_id = ? LIMIT 1', [client.id]);
  if (!hasInvoice) {
    const res = await query(
      `INSERT INTO invoices (client_id, invoice_no, period_month, issue_date, due_date, agency_fee, other_charges, note, created_by)
       VALUES (?, 'RF-202609-DEMO', '2026-09-01', '2026-09-01', '2026-09-10', 25000, 0, 'Monthly retainer', ?)`,
      [client.id, adminId],
    );
    await query(
      "INSERT INTO invoice_payments (invoice_id, client_id, amount, paid_on, method, created_by) VALUES (?, ?, 15000, '2026-09-05', 'bKash', ?)",
      [res.insertId, client.id, adminId],
    );
    await query(
      "INSERT INTO agency_expenses (expense_date, category, amount, note, created_by) VALUES ('2026-09-01', 'software', 4500, 'Design tools', ?), ('2026-09-01', 'salary', 60000, 'Team salaries', ?)",
      [adminId, adminId],
    );
    await query(
      `INSERT INTO agency_tasks (title, client_id, assignee_id, due_date, priority, created_by)
       VALUES ('Refresh Eid creatives', ?, ?, CURDATE() + INTERVAL 2 DAY, 'high', ?)`,
      [client.id, buyerId, managerId],
    );
    await query("INSERT INTO client_messages (client_id, user_id, kind, body) VALUES (?, ?, 'announcement', ?)", [
      client.id,
      managerId,
      'Retargeting budget increased from this week — expect more catalog sales.',
    ]);
    console.log('[seed] demo invoice, agency expenses, task, announcement');
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
