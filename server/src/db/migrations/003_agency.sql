-- Staff ↔ client assignment. Only admins see every client; everyone else sees assigned ones.
CREATE TABLE IF NOT EXISTS client_staff (
  client_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, user_id),
  KEY idx_client_staff_user (user_id),
  CONSTRAINT fk_client_staff_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
  CONSTRAINT fk_client_staff_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO client_staff (client_id, user_id)
SELECT id, account_manager_id FROM clients WHERE account_manager_id IS NOT NULL;

ALTER TABLE orders ADD COLUMN source VARCHAR(160) NULL AFTER note;

CREATE TABLE IF NOT EXISTS ad_accounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id INT UNSIGNED NOT NULL,
  platform ENUM('meta','google','tiktok') NOT NULL DEFAULT 'meta',
  external_id VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'BDT',
  access_token_enc TEXT NULL,
  result_action VARCHAR(80) NULL,
  daily_budget DECIMAL(14,2) NULL,
  assigned_user_id INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_synced_at DATETIME NULL,
  last_sync_error VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ad_account_platform_ext (platform, external_id),
  KEY idx_ad_accounts_client (client_id),
  CONSTRAINT fk_ad_accounts_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
  CONSTRAINT fk_ad_accounts_user FOREIGN KEY (assigned_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_ad_accounts_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per (account, level, object, day). level = account | campaign | adset.
CREATE TABLE IF NOT EXISTS ad_insights (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ad_account_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  level ENUM('account','campaign','adset') NOT NULL,
  object_id VARCHAR(64) NOT NULL,
  object_name VARCHAR(255) NULL,
  parent_id VARCHAR(64) NULL,
  stat_date DATE NOT NULL,
  spend DECIMAL(14,2) NOT NULL DEFAULT 0,
  impressions BIGINT UNSIGNED NOT NULL DEFAULT 0,
  clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  results INT UNSIGNED NOT NULL DEFAULT 0,
  purchase_value DECIMAL(14,2) NOT NULL DEFAULT 0,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_insight (ad_account_id, level, object_id, stat_date),
  KEY idx_insight_client_date (client_id, level, stat_date),
  CONSTRAINT fk_insight_account FOREIGN KEY (ad_account_id) REFERENCES ad_accounts (id) ON DELETE CASCADE,
  CONSTRAINT fk_insight_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id INT UNSIGNED NOT NULL,
  invoice_no VARCHAR(40) NOT NULL,
  period_month DATE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  agency_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
  other_charges DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('issued','cancelled') NOT NULL DEFAULT 'issued',
  note VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_no (invoice_no),
  KEY idx_invoices_client_period (client_id, period_month),
  KEY idx_invoices_due (due_date),
  CONSTRAINT fk_invoices_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
  CONSTRAINT fk_invoices_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  paid_on DATE NOT NULL,
  method VARCHAR(40) NULL,
  reference VARCHAR(120) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_invoice (invoice_id),
  KEY idx_payments_paid_on (paid_on),
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The agency's own running costs; never visible to client logins.
CREATE TABLE IF NOT EXISTS agency_expenses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  expense_date DATE NOT NULL,
  category ENUM('salary','software','rent','utility','tax','marketing','other') NOT NULL DEFAULT 'other',
  amount DECIMAL(14,2) NOT NULL,
  note VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agency_expenses_date (expense_date),
  CONSTRAINT fk_agency_expenses_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-recipient in-app notifications. dedupe_key stops scheduled jobs repeating an alert.
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  client_id INT UNSIGNED NULL,
  type VARCHAR(40) NOT NULL,
  data JSON NULL,
  link VARCHAR(255) NULL,
  dedupe_key VARCHAR(120) NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_dedupe (user_id, dedupe_key),
  KEY idx_notifications_user (user_id, read_at, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- kind: message (both sides), announcement (agency → client), note (agency-internal, hidden from client).
CREATE TABLE IF NOT EXISTS client_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NULL,
  kind ENUM('message','announcement','note') NOT NULL DEFAULT 'message',
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_client (client_id, created_at),
  CONSTRAINT fk_messages_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agency_tasks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  client_id INT UNSIGNED NULL,
  assignee_id INT UNSIGNED NULL,
  due_date DATE NULL,
  priority ENUM('low','normal','high') NOT NULL DEFAULT 'normal',
  status ENUM('open','done') NOT NULL DEFAULT 'open',
  completed_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agency_tasks_assignee (assignee_id, status),
  KEY idx_agency_tasks_due (status, due_date),
  CONSTRAINT fk_agency_tasks_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
  CONSTRAINT fk_agency_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_agency_tasks_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
