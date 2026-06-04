<?php

declare(strict_types=1);

function mail_config(PDO $pdo): array
{
    global $appConfig;
    $cfg = [
        'enabled' => setting($pdo, 'smtp_enabled', '0') === '1',
        'notifications' => setting($pdo, 'email_notifications', '1') === '1',
        'host' => (string) setting($pdo, 'smtp_host', ''),
        'port' => (int) setting($pdo, 'smtp_port', '587'),
        'encryption' => (string) setting($pdo, 'smtp_encryption', 'tls'),
        'username' => (string) setting($pdo, 'smtp_username', ''),
        'password' => (string) setting($pdo, 'smtp_password', ''),
        'from_email' => (string) setting($pdo, 'smtp_from_email', ''),
        'from_name' => (string) setting($pdo, 'smtp_from_name', ''),
        'bcc_enabled' => setting($pdo, 'smtp_bcc_enabled', '0') === '1',
        'bcc_emails' => parse_bcc_emails((string) setting($pdo, 'smtp_bcc_emails', '')),
    ];
    if ($cfg['from_email'] === '') {
        $cfg['from_email'] = $appConfig['mail']['from_email'] ?? 'noreply@localhost';
    }
    if ($cfg['from_name'] === '') {
        $cfg['from_name'] = $appConfig['app_name'] ?? 'Sales CRM';
    }
    if (!empty($appConfig['mail']['password'])) {
        $cfg['password'] = $appConfig['mail']['password'];
    }
    if (!empty($appConfig['mail']['bcc'])) {
        $cfg['bcc_emails'] = array_merge($cfg['bcc_emails'], parse_bcc_emails((string) $appConfig['mail']['bcc']));
    }
    return $cfg;
}

function parse_bcc_emails(string $raw): array
{
    if ($raw === '') {
        return [];
    }
    $parts = preg_split('/[\s,;]+/', $raw, -1, PREG_SPLIT_NO_EMPTY);
    $valid = [];
    foreach ($parts as $email) {
        $email = strtolower(trim($email));
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $valid[$email] = $email;
        }
    }
    return array_values($valid);
}

function crm_send_email(PDO $pdo, string $to, string $subject, string $htmlBody, ?int $userId = null, ?array $extraBcc = null): bool
{
    $cfg = mail_config($pdo);
    if (!$cfg['enabled'] || $to === '') {
        log_email($pdo, $userId, $to, $subject, 'skipped', 'SMTP disabled or empty recipient', null);
        return false;
    }

    $bcc = [];
    if ($cfg['bcc_enabled'] && $cfg['bcc_emails']) {
        $bcc = $cfg['bcc_emails'];
    }
    if ($extraBcc) {
        foreach ($extraBcc as $e) {
            if (filter_var($e, FILTER_VALIDATE_EMAIL)) {
                $bcc[strtolower($e)] = strtolower($e);
            }
        }
        $bcc = array_values($bcc);
    }
    $bcc = array_values(array_filter($bcc, fn($e) => strtolower($e) !== strtolower($to)));

    $from = $cfg['from_email'];
    $fromName = $cfg['from_name'];
    $boundary = md5((string) time());
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'From: ' . encode_mail_address($fromName, $from),
        'Reply-To: ' . $from,
        'X-Mailer: SalesCRM',
    ];
    if ($bcc) {
        $headers[] = 'Bcc: ' . implode(', ', $bcc);
    }
    $plain = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $htmlBody));
    $body = "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{$plain}\r\n";
    $body .= "--{$boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n{$htmlBody}\r\n--{$boundary}--";

    $ok = smtp_send($cfg, $to, $subject, $body, implode("\r\n", $headers), $bcc);
    log_email($pdo, $userId, $to, $subject, $ok ? 'sent' : 'failed', $ok ? null : 'SMTP send failed', $bcc);
    return $ok;
}

function encode_mail_address(string $name, string $email): string
{
    return sprintf('%s <%s>', addcslashes($name, '"'), $email);
}

function smtp_send(array $cfg, string $to, string $subject, string $body, string $headers, array $bcc = []): bool
{
    $host = $cfg['host'];
    $port = $cfg['port'];
    $enc = strtolower($cfg['encryption'] ?? 'tls');
    $remote = ($enc === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;

    $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if (!$fp) {
        return false;
    }
    stream_set_timeout($fp, 15);

    $read = function () use ($fp): string {
        $data = '';
        while ($line = fgets($fp, 515)) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };
    $cmd = function (string $command, array $expectCodes = ['250']) use ($fp, $read): bool {
        fwrite($fp, $command . "\r\n");
        $resp = $read();
        $code = (int) substr($resp, 0, 3);
        return in_array((string) $code, $expectCodes, true) || in_array($code, array_map('intval', $expectCodes), true);
    };

    $read();
    if (!$cmd('EHLO ' . gethostname(), ['250'])) {
        fclose($fp);
        return false;
    }
    if ($enc === 'tls') {
        if (!$cmd('STARTTLS', ['220'])) {
            fclose($fp);
            return false;
        }
        stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $cmd('EHLO ' . gethostname(), ['250']);
    }
    if ($cfg['username'] !== '') {
        if (!$cmd('AUTH LOGIN', ['334']) || !$cmd(base64_encode($cfg['username']), ['334']) || !$cmd(base64_encode($cfg['password']), ['235'])) {
            fclose($fp);
            return false;
        }
    }
    $from = $cfg['from_email'];
    if (!$cmd('MAIL FROM:<' . $from . '>', ['250'])) {
        fclose($fp);
        return false;
    }
    if (!$cmd('RCPT TO:<' . $to . '>', ['250', '251'])) {
        fclose($fp);
        return false;
    }
    foreach ($bcc as $bccAddr) {
        if (!$cmd('RCPT TO:<' . $bccAddr . '>', ['250', '251'])) {
            fclose($fp);
            return false;
        }
    }
    if (!$cmd('DATA', ['354'])) {
        fclose($fp);
        return false;
    }
    $message = "Subject: {$subject}\r\n{$headers}\r\n\r\n{$body}\r\n.\r\n";
    fwrite($fp, $message);
    $read();
    $cmd('QUIT', ['221']);
    fclose($fp);
    return true;
}

function log_email(PDO $pdo, ?int $userId, string $to, string $subject, string $status, ?string $error, ?array $bcc = null): void
{
    try {
        $note = $error;
        if ($bcc) {
            $note = ($note ? $note . ' | ' : '') . 'BCC: ' . implode(', ', $bcc);
        }
        $pdo->prepare('INSERT INTO email_log (user_id, to_email, subject, status, error_message) VALUES (?, ?, ?, ?, ?)')
            ->execute([$userId, $to, $subject, $status, $note]);
    } catch (Throwable $e) {
    }
}

function crm_email_user(PDO $pdo, int $userId, string $title, string $message, ?string $link = null): void
{
    $cfg = mail_config($pdo);
    if (!$cfg['notifications']) {
        return;
    }
    $stmt = $pdo->prepare('SELECT email, name FROM users WHERE id = ? AND is_active = 1');
    $stmt->execute([$userId]);
    $u = $stmt->fetch();
    if (!$u || empty($u['email'])) {
        return;
    }
    $html = '<div style="font-family:Inter,Arial,sans-serif;max-width:560px">';
    $html .= '<h2 style="color:#0f172a">' . htmlspecialchars($title) . '</h2>';
    $html .= '<p style="color:#334155">' . nl2br(htmlspecialchars($message)) . '</p>';
    if ($link) {
        $html .= '<p><a href="' . htmlspecialchars($link) . '" style="background:#4f46e5;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px">Open in CRM</a></p>';
    }
    $html .= '</div>';
    crm_send_email($pdo, $u['email'], $title, $html, $userId);
}

function crm_send_test_email(PDO $pdo, string $to): bool
{
    $bccNote = '';
    $cfg = mail_config($pdo);
    if ($cfg['bcc_enabled'] && $cfg['bcc_emails']) {
        $bccNote = '<p style="font-size:12px;color:#64748b">BCC recipients: ' . htmlspecialchars(implode(', ', $cfg['bcc_emails'])) . '</p>';
    }
    return crm_send_email($pdo, $to, 'CRM Test Email', '<p>Your SMTP settings are working correctly.</p>' . $bccNote, null);
}
