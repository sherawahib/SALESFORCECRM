-- Sales CRM - MySQL Schema (cPanel / MariaDB compatible)
-- Charset: utf8mb4

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `roles` (
  `id` TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(32) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `departments` (
  `id` TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(32) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_id` TINYINT UNSIGNED NOT NULL,
  `department_id` TINYINT UNSIGNED NULL,
  `manager_id` INT UNSIGNED NULL,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `phone` VARCHAR(40) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  KEY `manager_id` (`manager_id`),
  CONSTRAINT `users_role_fk` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `users_dept_fk` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_manager_fk` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_categories` (
  `id` TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(32) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `department_id` TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `department_id` (`department_id`),
  CONSTRAINT `cat_dept_fk` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `leads` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `lead_code` VARCHAR(20) NOT NULL,
  `created_by` INT UNSIGNED NOT NULL,
  `assigned_seller_id` INT UNSIGNED NULL,
  `company_name` VARCHAR(190) NULL,
  `contact_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(190) NULL,
  `phone` VARCHAR(40) NULL,
  `website` VARCHAR(255) NULL,
  `country` VARCHAR(80) NULL,
  `source` VARCHAR(80) NULL,
  `service_interest` VARCHAR(255) NULL,
  `budget_range` VARCHAR(80) NULL,
  `notes` TEXT NULL,
  `status` ENUM('new','assigned','contacted','qualified','won','lost','on_hold','archived') NOT NULL DEFAULT 'new',
  `priority` ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `queue_tier` ENUM('hot','cold','new') NOT NULL DEFAULT 'new',
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  `assigned_at` DATETIME NULL,
  `callback_at` DATETIME NULL,
  `follow_up_at` DATETIME NULL,
  `won_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lead_code` (`lead_code`),
  KEY `created_by` (`created_by`),
  KEY `assigned_seller_id` (`assigned_seller_id`),
  KEY `status` (`status`),
  CONSTRAINT `leads_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `leads_seller_fk` FOREIGN KEY (`assigned_seller_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lead_activities` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `lead_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `activity_type` ENUM('note','call','email','status_change','assignment') NOT NULL,
  `subject` VARCHAR(255) NULL,
  `body` TEXT NULL,
  `meta_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  CONSTRAINT `lead_act_lead_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lead_act_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `clients` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `lead_id` INT UNSIGNED NULL,
  `seller_id` INT UNSIGNED NOT NULL,
  `company_name` VARCHAR(190) NULL,
  `contact_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(190) NULL,
  `phone` VARCHAR(40) NULL,
  `billing_address` TEXT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `seller_id` (`seller_id`),
  CONSTRAINT `clients_lead_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `clients_seller_fk` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `conversations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `lead_id` INT UNSIGNED NOT NULL,
  `seller_id` INT UNSIGNED NOT NULL,
  `channel` ENUM('call','email','meeting','whatsapp','other') NOT NULL DEFAULT 'call',
  `outcome` ENUM('no_answer','voicemail','follow_up','callback_scheduled','not_interested','interested','ready_to_buy','negotiation') NOT NULL,
  `summary` TEXT NOT NULL,
  `next_follow_up` DATE NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  CONSTRAINT `conv_lead_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conv_seller_fk` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invoices` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_number` VARCHAR(30) NOT NULL,
  `parent_invoice_id` INT UNSIGNED NULL,
  `client_id` INT UNSIGNED NOT NULL,
  `lead_id` INT UNSIGNED NULL,
  `parent_project_id` INT UNSIGNED NULL,
  `seller_id` INT UNSIGNED NOT NULL,
  `service_category_id` TINYINT UNSIGNED NOT NULL,
  `project_category` ENUM('design','development','combo') NOT NULL DEFAULT 'development',
  `is_upsell` TINYINT(1) NOT NULL DEFAULT 0,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `amount_paid` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `currency` CHAR(3) NOT NULL DEFAULT 'USD',
  `status` ENUM('unpaid','partial','paid','refunded','chargeback','cancelled','draft','sent') NOT NULL DEFAULT 'unpaid',
  `due_date` DATE NULL,
  `paid_at` DATETIME NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `inv_client_fk` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `inv_lead_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inv_seller_fk` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`),
  CONSTRAINT `inv_cat_fk` FOREIGN KEY (`service_category_id`) REFERENCES `service_categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id` INT UNSIGNED NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(10,2) NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `line_total` DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `invoice_id` (`invoice_id`),
  CONSTRAINT `inv_item_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `projects` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_code` VARCHAR(20) NOT NULL,
  `parent_project_id` INT UNSIGNED NULL,
  `combo_group_id` VARCHAR(36) NULL,
  `invoice_id` INT UNSIGNED NOT NULL,
  `client_id` INT UNSIGNED NOT NULL,
  `seller_id` INT UNSIGNED NOT NULL,
  `service_category_id` TINYINT UNSIGNED NOT NULL,
  `department_id` TINYINT UNSIGNED NOT NULL,
  `head_user_id` INT UNSIGNED NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `seller_brief` TEXT NULL,
  `status` ENUM('pending_assignment','in_progress','review_pending','head_review','awaiting_client_review','client_review','revision_requested','open_revision','completed','on_hold','chargeback','refunded','cancelled') NOT NULL DEFAULT 'pending_assignment',
  `is_frozen` TINYINT(1) NOT NULL DEFAULT 0,
  `budget_total` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `budget_spent` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `started_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `closed_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_code` (`project_code`),
  KEY `invoice_id` (`invoice_id`),
  KEY `combo_group_id` (`combo_group_id`),
  KEY `client_id` (`client_id`),
  KEY `status` (`status`),
  CONSTRAINT `proj_invoice_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`),
  CONSTRAINT `proj_client_fk` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  CONSTRAINT `proj_seller_fk` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`),
  CONSTRAINT `proj_cat_fk` FOREIGN KEY (`service_category_id`) REFERENCES `service_categories` (`id`),
  CONSTRAINT `proj_dept_fk` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`),
  CONSTRAINT `proj_head_fk` FOREIGN KEY (`head_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_budget_lines` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` INT UNSIGNED NOT NULL,
  `line_type` ENUM('original','upsell','adjustment','refund') NOT NULL DEFAULT 'original',
  `description` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `invoice_id` INT UNSIGNED NULL,
  `created_by` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `budget_proj_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `budget_inv_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `budget_user_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_assignments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` INT UNSIGNED NOT NULL,
  `assigned_by` INT UNSIGNED NOT NULL,
  `assignee_id` INT UNSIGNED NOT NULL,
  `instructions` TEXT NOT NULL,
  `staging_url` VARCHAR(500) NULL,
  `proof_notes` TEXT NULL,
  `task_checklist` JSON NULL,
  `status` ENUM('assigned','in_progress','review_pending','submitted','approved','rejected') NOT NULL DEFAULT 'assigned',
  `due_date` DATE NULL,
  `submitted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `assignee_id` (`assignee_id`),
  CONSTRAINT `assign_proj_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `assign_by_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`),
  CONSTRAINT `assign_to_fk` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_revisions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` INT UNSIGNED NOT NULL,
  `revision_number` INT UNSIGNED NOT NULL,
  `opened_by` INT UNSIGNED NOT NULL,
  `opened_reason` TEXT NULL,
  `assignee_id` INT UNSIGNED NULL,
  `developer_notes` TEXT NULL,
  `resolution_note` TEXT NULL,
  `status` ENUM('open','open_revision','in_production','review_pending','head_review','client_review','submitted','approved','resolved','closed') NOT NULL DEFAULT 'open',
  `head_approved_at` DATETIME NULL,
  `head_approved_by` INT UNSIGNED NULL,
  `notify_seller` TINYINT(1) NOT NULL DEFAULT 0,
  `seller_notified_at` DATETIME NULL,
  `submitted_at` DATETIME NULL,
  `closed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_revision` (`project_id`,`revision_number`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `rev_proj_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rev_opened_fk` FOREIGN KEY (`opened_by`) REFERENCES `users` (`id`),
  CONSTRAINT `rev_assignee_fk` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project_status_log` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `old_status` VARCHAR(40) NULL,
  `new_status` VARCHAR(40) NOT NULL,
  `note` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `psl_proj_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `psl_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `type` VARCHAR(40) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `link` VARCHAR(255) NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `is_read` (`is_read`),
  CONSTRAINT `notif_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL,
  `entity_type` VARCHAR(40) NOT NULL,
  `entity_id` INT UNSIGNED NOT NULL,
  `action` VARCHAR(40) NOT NULL,
  `details` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `entity` (`entity_type`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lead_import_batches` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uploaded_by` INT UNSIGNED NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `row_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `success_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `lib_user_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_log` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL,
  `to_email` VARCHAR(190) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `status` ENUM('sent','failed','skipped') NOT NULL DEFAULT 'sent',
  `error_message` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `revision_files` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` INT UNSIGNED NOT NULL,
  `revision_id` INT UNSIGNED NULL,
  `assignment_id` INT UNSIGNED NULL,
  `uploaded_by` INT UNSIGNED NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `stored_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_size` INT UNSIGNED NOT NULL DEFAULT 0,
  `mime_type` VARCHAR(120) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `revision_id` (`revision_id`),
  CONSTRAINT `rf_proj_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rf_rev_fk` FOREIGN KEY (`revision_id`) REFERENCES `project_revisions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rf_assign_fk` FOREIGN KEY (`assignment_id`) REFERENCES `project_assignments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rf_user_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(64) NOT NULL,
  `setting_value` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed data
INSERT INTO `roles` (`slug`, `name`) VALUES
('admin', 'Administrator'),
('lead_finer', 'Lead Finder'),
('seller', 'Seller / Closer'),
('design_head', 'Design Head'),
('designer', 'Junior Designer'),
('dev_head', 'Development Head'),
('developer', 'Junior Developer')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `departments` (`slug`, `name`) VALUES
('design', 'Design'),
('development', 'Development'),
('sales', 'Sales')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `service_categories` (`slug`, `name`, `department_id`) VALUES
('logo_branding', 'Logo & Branding', 1),
('ui_ux', 'UI/UX Design', 1),
('web_design', 'Web Design', 1),
('wordpress', 'WordPress Development', 2),
('custom_web', 'Custom Web Development', 2),
('mobile_app', 'Mobile App Development', 2),
('ecommerce', 'E-Commerce Development', 2)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES
('company_name', 'Your Company Name'),
('currency_default', 'USD'),
('tax_rate', '0'),
('invoice_prefix', 'INV'),
('project_prefix', 'PRJ'),
('lead_prefix', 'LD'),
('assignment_mode', 'manual'),
('round_robin_last_seller_id', '0'),
('smtp_enabled', '0'),
('smtp_host', ''),
('smtp_port', '587'),
('smtp_encryption', 'tls'),
('smtp_username', ''),
('smtp_password', ''),
('smtp_from_email', ''),
('smtp_from_name', ''),
('email_notifications', '1'),
('company_tagline', ''),
('company_address', ''),
('company_phone', ''),
('company_email', ''),
('company_website', ''),
('company_logo_path', ''),
('bank_account_name', ''),
('bank_name', ''),
('bank_account_number', ''),
('bank_routing_number', ''),
('bank_iban', ''),
('bank_swift', ''),
('invoice_payment_terms', 'Payment due within 14 days. Thank you for your business.'),
('invoice_footer_text', ''),
('smtp_bcc_enabled', '0'),
('smtp_bcc_emails', '')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
