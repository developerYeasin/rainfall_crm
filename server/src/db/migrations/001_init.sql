CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','manager','media_buyer','designer','viewer') NOT NULL DEFAULT 'viewer',
  phone VARCHAR(40) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_hash (token_hash),
  KEY idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  company VARCHAR(160) NULL,
  contact_person VARCHAR(120) NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(40) NULL,
  industry VARCHAR(120) NULL,
  status ENUM('lead','onboarding','active','paused','churned') NOT NULL DEFAULT 'onboarding',
  onboarded_at DATE NULL,
  monthly_retainer DECIMAL(14,2) NULL,
  account_manager_id INT UNSIGNED NULL,
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clients_status (status),
  KEY idx_clients_name (name),
  CONSTRAINT fk_clients_manager FOREIGN KEY (account_manager_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_clients_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cycles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  month_start DATE NOT NULL,
  weeks_count TINYINT UNSIGNED NOT NULL DEFAULT 4,
  status ENUM('planned','running','closed') NOT NULL DEFAULT 'running',
  monthly_budget DECIMAL(14,2) NOT NULL DEFAULT 0,
  expected_ctr DECIMAL(9,6) NOT NULL DEFAULT 0.02,
  expected_cpc DECIMAL(12,4) NOT NULL DEFAULT 3.5,
  expected_conversion_rate DECIMAL(9,6) NOT NULL DEFAULT 0.02,
  aov DECIMAL(14,2) NOT NULL DEFAULT 900,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cycle_client_month (client_id, month_start),
  KEY idx_cycles_status (status),
  CONSTRAINT fk_cycles_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
  CONSTRAINT fk_cycles_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS target_weeks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cycle_id INT UNSIGNED NOT NULL,
  week_no TINYINT UNSIGNED NOT NULL,
  label VARCHAR(60) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  budget DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_week_cycle_no (cycle_id, week_no),
  CONSTRAINT fk_weeks_cycle FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS performance_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cycle_id INT UNSIGNED NOT NULL,
  entry_date DATE NOT NULL,
  week_no TINYINT UNSIGNED NOT NULL DEFAULT 1,
  platform VARCHAR(40) NOT NULL DEFAULT 'Facebook',
  spend DECIMAL(14,2) NOT NULL DEFAULT 0,
  impressions BIGINT UNSIGNED NOT NULL DEFAULT 0,
  clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  conversions INT UNSIGNED NOT NULL DEFAULT 0,
  revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
  note VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_perf_cycle_date (cycle_id, entry_date),
  KEY idx_perf_cycle_week (cycle_id, week_no),
  CONSTRAINT fk_perf_cycle FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE,
  CONSTRAINT fk_perf_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_compliance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cycle_id INT UNSIGNED NOT NULL,
  task_date DATE NOT NULL,
  task_name VARCHAR(160) NOT NULL,
  owner_label VARCHAR(120) NULL,
  assignee_id INT UNSIGNED NULL,
  morning_check TINYINT(1) NOT NULL DEFAULT 0,
  ad_monitoring_done TINYINT(1) NOT NULL DEFAULT 0,
  report_updated TINYINT(1) NOT NULL DEFAULT 0,
  client_update_sent TINYINT(1) NOT NULL DEFAULT 0,
  comment VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_task_cycle_date_name (cycle_id, task_date, task_name),
  KEY idx_task_assignee (assignee_id),
  CONSTRAINT fk_task_cycle FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE,
  CONSTRAINT fk_task_assignee FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_calendar (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cycle_id INT UNSIGNED NOT NULL,
  plan_date DATE NOT NULL,
  platform VARCHAR(40) NOT NULL DEFAULT 'Facebook',
  content_type VARCHAR(60) NOT NULL,
  topic VARCHAR(300) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'আইডিয়া',
  designer_id INT UNSIGNED NULL,
  designer_name VARCHAR(120) NULL,
  publish_date DATE NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_content_cycle_date (cycle_id, plan_date),
  CONSTRAINT fk_content_cycle FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE,
  CONSTRAINT fk_content_designer FOREIGN KEY (designer_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id VARCHAR(60) NULL,
  meta JSON NULL,
  ip VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_log_entity (entity_type, entity_id),
  KEY idx_log_created (created_at),
  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
