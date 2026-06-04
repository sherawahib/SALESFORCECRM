export {
  DEMO_PASSWORD,
  DEMO_ROLES,
  DEMO_ACCOUNTS,
  demoEmail,
} from './demo-accounts';

export const DEPARTMENTS = ['sales', 'production', 'accounts', 'hr', 'it', 'devops'] as const;
export type DepartmentSlug = (typeof DEPARTMENTS)[number];

export const PERMISSIONS = {
  SUPER_ALL: '*.*.*',
  // Sales
  SALES_LEADS_READ: 'sales.leads.read',
  SALES_LEADS_WRITE: 'sales.leads.write',
  SALES_LEADS_ASSIGN: 'sales.leads.assign',
  SALES_LEADS_MANAGER: 'sales.leads.manager',
  SALES_CLIENTS_READ: 'sales.clients.read',
  SALES_INVOICES_CREATE: 'sales.invoices.create',
  SALES_INVOICES_READ: 'sales.invoices.read',
  SALES_UPSELL: 'sales.upsell.create',
  SALES_PROJECTS_PM: 'sales.projects.pm',
  SALES_CLIENT_REVISIONS: 'sales.revisions.client',
  SALES_REVISIONS_ASSIGN: 'sales.revisions.assign',
  SALES_DASHBOARD: 'sales.dashboard.read',
  // Production
  PROD_PROJECTS_READ: 'production.projects.read',
  PROD_PROJECTS_ASSIGN: 'production.projects.assign',
  PROD_TASKS_READ: 'production.tasks.read',
  PROD_TASKS_SUBMIT: 'production.tasks.submit',
  PROD_REVISIONS_MANAGE: 'production.revisions.manage',
  // Accounts
  ACC_INVOICES_READ: 'accounts.invoices.read',
  ACC_PAYMENTS_RECORD: 'accounts.payments.record',
  ACC_REFUND_APPROVE: 'accounts.refunds.approve',
  ACC_REPORTS: 'accounts.reports.read',
  // IT
  IT_USERS_MANAGE: 'it.users.manage',
  IT_ROLES_MANAGE: 'it.roles.manage',
  IT_AUDIT_READ: 'it.audit.read',
  IT_INTEGRATIONS: 'it.integrations.manage',
  // DevOps
  OPS_DEPLOYMENTS_READ: 'devops.deployments.read',
  OPS_DEPLOYMENTS_WRITE: 'devops.deployments.write',
  // Admin
  ADMIN_SETTINGS: 'admin.settings.manage',
  ADMIN_DEPARTMENTS: 'admin.departments.manage',
  // HR / HRMS
  HR_DASHBOARD: 'hr.dashboard.read',
  HR_EMPLOYEES_READ: 'hr.employees.read',
  HR_EMPLOYEES_WRITE: 'hr.employees.write',
  HR_LEAVE_MANAGE: 'hr.leave.manage',
  HR_ATTENDANCE_MANAGE: 'hr.attendance.manage',
  HR_PAYROLL_MANAGE: 'hr.payroll.manage',
  HR_MENU_MANAGE: 'hr.menu.manage',
  /** Every employee — personal HRMS portal */
  HR_SELF_PORTAL: 'hr.self.portal',
} as const;

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

/** Junior designer/developer sets these on each assigned revision. */
export const REVISION_CREW_STATUS = {
  ASSIGNED: 'assigned',
  INCOMPLETE: 'incomplete',
  MISSING_REQUIREMENT: 'missing_requirement',
  SUCCESSFULLY_DONE: 'successfully_done',
  REVIEW_PENDING: 'review_pending',
  CLIENT_REVIEW: 'client_review',
  PENDING_HEAD: 'pending_head_assignment',
} as const;

export type RevisionCrewStatus = (typeof REVISION_CREW_STATUS)[keyof typeof REVISION_CREW_STATUS];

export const REVISION_CREW_STATUS_OPTIONS = [
  { value: REVISION_CREW_STATUS.INCOMPLETE, label: 'Incomplete revision' },
  { value: REVISION_CREW_STATUS.MISSING_REQUIREMENT, label: 'Missing requirement' },
  { value: REVISION_CREW_STATUS.SUCCESSFULLY_DONE, label: 'Successfully done' },
] as const;

export function revisionCrewStatusLabel(status: string): string {
  const found = REVISION_CREW_STATUS_OPTIONS.find((o) => o.value === status);
  if (found) return found.label;
  const map: Record<string, string> = {
    assigned: 'Assigned',
    review_pending: 'Awaiting head review',
    client_review: 'With client / PM',
    pending_head_assignment: 'Awaiting head assignment',
  };
  return map[status] || status.replace(/_/g, ' ');
}

export interface JwtPayload {
  sub: number;
  email: string;
  designationId: number;
  departmentId: number;
  permissions: string[];
}
