<?php
/**
 * Copy this file to config.php and update values for your cPanel hosting.
 */
return [
    'app_name' => 'Sales CRM',
    'app_url' => 'https://yourdomain.com', // no trailing slash
    'timezone' => 'UTC',

    'db' => [
        'host' => 'localhost',
        'name' => 'your_database_name',
        'user' => 'your_database_user',
        'pass' => 'your_database_password',
        'charset' => 'utf8mb4',
    ],

    'session_name' => 'sales_crm_session',
    'debug' => false,

    // Optional: override SMTP secrets outside the database (recommended on production)
    'mail' => [
        'from_email' => 'billing@yourdomain.com',
        'password' => '', // e.g. cPanel mailbox password
        'bcc' => 'accounts@yourdomain.com', // comma-separated, merged with Settings BCC
    ],
];
