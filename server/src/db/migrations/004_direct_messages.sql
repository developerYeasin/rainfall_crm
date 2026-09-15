-- One-to-one chat between any two logins (staff ↔ staff, staff ↔ client).
CREATE TABLE IF NOT EXISTS direct_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_id INT UNSIGNED NOT NULL,
  recipient_id INT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dm_pair (sender_id, recipient_id, id),
  KEY idx_dm_inbox (recipient_id, read_at),
  CONSTRAINT fk_dm_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_dm_recipient FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
