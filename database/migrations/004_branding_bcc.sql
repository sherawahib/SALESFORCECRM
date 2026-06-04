-- Invoice branding + email BCC
INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES
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
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
