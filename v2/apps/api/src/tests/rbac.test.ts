import { hasPermission } from '@ops/rbac';
import { PERMISSIONS } from '@ops/shared';

const perms = [PERMISSIONS.SALES_LEADS_READ];

if (!hasPermission(perms, PERMISSIONS.SALES_LEADS_READ)) {
  console.error('FAIL: should allow sales.leads.read');
  process.exit(1);
}
if (hasPermission(perms, PERMISSIONS.SUPER_ALL)) {
  console.error('FAIL: should deny super without grant');
  process.exit(1);
}
if (!hasPermission([PERMISSIONS.SUPER_ALL], PERMISSIONS.ACC_INVOICES_READ)) {
  console.error('FAIL: super should allow any');
  process.exit(1);
}
console.log('RBAC tests OK');
