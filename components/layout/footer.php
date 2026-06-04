<?php if (current_user() && ($page ?? '') !== 'login'): ?>
        </main>
    </div>
</div>
<?php else: ?>
</main>
<?php endif; ?>
<script src="<?= e(asset_url('assets/js/app.js')) ?>"></script>
</body>
</html>
