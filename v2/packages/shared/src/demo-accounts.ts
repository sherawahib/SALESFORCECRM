/** Shared demo credentials — must match prisma/seed.ts */
export const DEMO_PASSWORD = 'demo123';

export const DEMO_ROLES = [
  { dept: 'sales', slug: 'lead_finder', name: 'Lead Finder', deptLabel: 'Sales' },
  { dept: 'sales', slug: 'project_manager', name: 'Project Manager', deptLabel: 'Sales' },
  { dept: 'sales', slug: 'sales_manager', name: 'Sales Manager', deptLabel: 'Sales' },
  { dept: 'production', slug: 'design_head', name: 'Design Head', deptLabel: 'Production' },
  { dept: 'production', slug: 'junior_designer', name: 'Junior Designer', deptLabel: 'Production' },
  { dept: 'production', slug: 'dev_head', name: 'Development Head', deptLabel: 'Production' },
  { dept: 'production', slug: 'junior_developer', name: 'Junior Developer', deptLabel: 'Production' },
  { dept: 'production', slug: 'production_manager', name: 'Production Manager', deptLabel: 'Production' },
  { dept: 'hr', slug: 'hr_executive', name: 'HR Executive', deptLabel: 'Human Resources' },
  { dept: 'hr', slug: 'hr_manager', name: 'HR Manager', deptLabel: 'Human Resources' },
  { dept: 'accounts', slug: 'accounts_exec', name: 'Accounts Executive', deptLabel: 'Accounts' },
  { dept: 'accounts', slug: 'accounts_manager', name: 'Accounts Manager', deptLabel: 'Accounts' },
  { dept: 'it', slug: 'it_support', name: 'IT Support', deptLabel: 'IT' },
  { dept: 'it', slug: 'it_admin', name: 'IT Admin', deptLabel: 'IT' },
  { dept: 'it', slug: 'super_admin', name: 'Super Admin', deptLabel: 'IT' },
  { dept: 'devops', slug: 'devops_engineer', name: 'DevOps Engineer', deptLabel: 'DevOps' },
  { dept: 'devops', slug: 'devops_lead', name: 'DevOps Lead', deptLabel: 'DevOps' },
] as const;

export function demoEmail(dept: string, slug: string) {
  return `${dept}.${slug}@ops.test`;
}

export const DEMO_ACCOUNTS = DEMO_ROLES.map((r) => ({
  department: r.deptLabel,
  role: r.name,
  email: demoEmail(r.dept, r.slug),
  password: DEMO_PASSWORD,
}));
