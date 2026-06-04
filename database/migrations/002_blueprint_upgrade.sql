-- Blueprint upgrade (run in phpMyAdmin on existing installs)
SET NAMES utf8mb4;

-- Roles display names
UPDATE roles SET name = 'Lead Finder' WHERE slug = 'lead_finer';
UPDATE roles SET name = 'Seller / Closer' WHERE slug = 'seller';
UPDATE roles SET name = 'Junior Designer' WHERE slug = 'designer';
UPDATE roles SET name = 'Junior Developer' WHERE slug = 'developer';

-- Leads: queue & callbacks
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS queue_tier ENUM('hot','cold','new') NOT NULL DEFAULT 'new' AFTER priority,
  ADD COLUMN IF NOT EXISTS callback_at DATETIME NULL AFTER assigned_at,
  ADD COLUMN IF NOT EXISTS follow_up_at DATETIME NULL AFTER callback_at,
  ADD COLUMN IF NOT EXISTS is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

-- Invoices: upsell linkage & payment tracking
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS parent_invoice_id INT UNSIGNED NULL AFTER invoice_number,
  ADD COLUMN IF NOT EXISTS parent_project_id INT UNSIGNED NULL AFTER lead_id,
  ADD COLUMN IF NOT EXISTS project_category ENUM('design','development','combo') NOT NULL DEFAULT 'development' AFTER service_category_id,
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total,
  ADD COLUMN IF NOT EXISTS is_upsell TINYINT(1) NOT NULL DEFAULT 0 AFTER amount_paid;

ALTER TABLE invoices MODIFY COLUMN status ENUM('unpaid','partial','paid','refunded','chargeback','cancelled','draft','sent') NOT NULL DEFAULT 'unpaid';

-- Projects: combo & freeze
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS parent_project_id INT UNSIGNED NULL AFTER project_code,
  ADD COLUMN IF NOT EXISTS combo_group_id VARCHAR(36) NULL AFTER parent_project_id,
  ADD COLUMN IF NOT EXISTS is_frozen TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN IF NOT EXISTS seller_brief TEXT NULL AFTER description;

ALTER TABLE projects DROP INDEX invoice_id;
ALTER TABLE projects ADD KEY invoice_id (invoice_id);

-- Assignments: proofs & review
ALTER TABLE project_assignments
  ADD COLUMN IF NOT EXISTS staging_url VARCHAR(500) NULL AFTER instructions,
  ADD COLUMN IF NOT EXISTS proof_notes TEXT NULL AFTER staging_url,
  ADD COLUMN IF NOT EXISTS task_checklist JSON NULL AFTER proof_notes;

ALTER TABLE project_assignments MODIFY COLUMN status ENUM('assigned','in_progress','review_pending','submitted','approved','rejected') NOT NULL DEFAULT 'assigned';

-- Revisions: ledger fields
ALTER TABLE project_revisions
  ADD COLUMN IF NOT EXISTS resolution_note TEXT NULL AFTER developer_notes,
  ADD COLUMN IF NOT EXISTS head_approved_at DATETIME NULL AFTER submitted_at,
  ADD COLUMN IF NOT EXISTS head_approved_by INT UNSIGNED NULL AFTER head_approved_at;

ALTER TABLE project_revisions MODIFY COLUMN status ENUM(
  'open','open_revision','in_production','review_pending','head_review','client_review',
  'submitted','approved','resolved','closed'
) NOT NULL DEFAULT 'open';

-- Import batches
CREATE TABLE IF NOT EXISTS lead_import_batches (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uploaded_by INT UNSIGNED NOT NULL,
  filename VARCHAR(255) NOT NULL,
  row_count INT UNSIGNED NOT NULL DEFAULT 0,
  success_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT lib_user_fk FOREIGN KEY (uploaded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO settings (setting_key, setting_value) VALUES
('assignment_mode', 'manual'),
('round_robin_last_seller_id', '0')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
