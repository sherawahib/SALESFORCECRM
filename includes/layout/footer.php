<?php if (current_user() && ($page ?? '') !== 'login'): ?>
        </main>
    </div>
</div>
<?php else: ?>
</main>
<?php endif; ?>

<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
<symbol id="icon-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor"/><rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor"/><rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor"/><rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor"/></symbol>
<symbol id="icon-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" fill="currentColor"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="currentColor"/><circle cx="17" cy="9" r="2.5" fill="currentColor" opacity=".6"/><path d="M14 20c.3-2.5 2.2-4.5 5-4.5" fill="currentColor" opacity=".6"/></symbol>
<symbol id="icon-phone" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="currentColor"/></symbol>
<symbol id="icon-briefcase" viewBox="0 0 24 24"><path d="M4 8h16v11H4V8zm2-3h12v3H6V5z" fill="currentColor"/></symbol>
<symbol id="icon-file-text" viewBox="0 0 24 24"><path d="M6 2h8l4 4v16H6V2zm8 0v4h4" fill="currentColor"/><rect x="8" y="10" width="8" height="2" fill="#fff" opacity=".5"/><rect x="8" y="14" width="8" height="2" fill="#fff" opacity=".5"/></symbol>
<symbol id="icon-folder" viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v11H3V6z" fill="currentColor"/></symbol>
<symbol id="icon-layers" viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5zm0 8l9 5-9 5-9-5 9-5z" fill="currentColor"/></symbol>
<symbol id="icon-check-square" viewBox="0 0 24 24"><path d="M4 4h16v16H4V4zm3 8l3 3 7-7" stroke="currentColor" stroke-width="2" fill="none"/></symbol>
<symbol id="icon-bell" viewBox="0 0 24 24"><path d="M12 22a2 2 0 002-2H10a2 2 0 002 2zm7-6V11a7 7 0 10-14 0v5l-2 2v1h18v-1l-2-2z" fill="currentColor"/></symbol>
<symbol id="icon-bar-chart" viewBox="0 0 24 24"><rect x="4" y="12" width="4" height="8" fill="currentColor"/><rect x="10" y="8" width="4" height="12" fill="currentColor"/><rect x="16" y="4" width="4" height="16" fill="currentColor"/></symbol>
<symbol id="icon-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" stroke="currentColor" stroke-width="2" fill="none"/></symbol>
<symbol id="icon-user-check" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" fill="currentColor"/><path d="M2 20c0-3.3 3.6-6 7-6" fill="currentColor"/><path d="M16 11l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none"/></symbol>
</svg>
<script src="<?= e(rtrim($appConfig['app_url'] ?? '', '/')) ?>/assets/js/app.js"></script>
</body>
</html>
