import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, DEMO_PASSWORD, DEMO_ROLES, demoEmail } from '@ops/shared';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const DEPT_DATA = [
  { slug: 'sales', name: 'Sales' },
  { slug: 'production', name: 'Production' },
  { slug: 'accounts', name: 'Accounts' },
  { slug: 'it', name: 'IT' },
  { slug: 'devops', name: 'DevOps' },
  { slug: 'hr', name: 'Human Resources' },
];

const DESIGNATIONS: { dept: string; slug: string; name: string; level: number; perms: string[] }[] = [
  { dept: 'sales', slug: 'lead_finder', name: 'Lead Finder', level: 10, perms: [PERMISSIONS.SALES_LEADS_READ, PERMISSIONS.SALES_LEADS_WRITE, PERMISSIONS.SALES_DASHBOARD] },
  {
    dept: 'sales',
    slug: 'project_manager',
    name: 'Project Manager',
    level: 20,
    perms: [
      PERMISSIONS.SALES_LEADS_READ,
      PERMISSIONS.SALES_PROJECTS_PM,
      PERMISSIONS.SALES_CLIENT_REVISIONS,
      PERMISSIONS.SALES_REVISIONS_ASSIGN,
      PERMISSIONS.SALES_INVOICES_READ,
      PERMISSIONS.SALES_CLIENTS_READ,
      PERMISSIONS.SALES_DASHBOARD,
    ],
  },
  {
    dept: 'sales',
    slug: 'sales_manager',
    name: 'Sales Manager',
    level: 50,
    perms: [
      PERMISSIONS.SALES_LEADS_READ,
      PERMISSIONS.SALES_LEADS_WRITE,
      PERMISSIONS.SALES_LEADS_ASSIGN,
      PERMISSIONS.SALES_LEADS_MANAGER,
      PERMISSIONS.SALES_CLIENTS_READ,
      PERMISSIONS.SALES_INVOICES_CREATE,
      PERMISSIONS.SALES_INVOICES_READ,
      PERMISSIONS.SALES_UPSELL,
      PERMISSIONS.SALES_DASHBOARD,
      PERMISSIONS.ACC_INVOICES_READ,
    ],
  },
  { dept: 'production', slug: 'design_head', name: 'Design Head', level: 40, perms: [PERMISSIONS.PROD_PROJECTS_READ, PERMISSIONS.PROD_PROJECTS_ASSIGN, PERMISSIONS.PROD_REVISIONS_MANAGE, PERMISSIONS.PROD_TASKS_READ] },
  { dept: 'production', slug: 'junior_designer', name: 'Junior Designer', level: 10, perms: [PERMISSIONS.PROD_TASKS_READ, PERMISSIONS.PROD_TASKS_SUBMIT] },
  { dept: 'production', slug: 'dev_head', name: 'Development Head', level: 40, perms: [PERMISSIONS.PROD_PROJECTS_READ, PERMISSIONS.PROD_PROJECTS_ASSIGN, PERMISSIONS.PROD_REVISIONS_MANAGE, PERMISSIONS.PROD_TASKS_READ] },
  { dept: 'production', slug: 'junior_developer', name: 'Junior Developer', level: 10, perms: [PERMISSIONS.PROD_TASKS_READ, PERMISSIONS.PROD_TASKS_SUBMIT] },
  { dept: 'production', slug: 'production_manager', name: 'Production Manager', level: 50, perms: [PERMISSIONS.PROD_PROJECTS_READ, PERMISSIONS.PROD_PROJECTS_ASSIGN, PERMISSIONS.PROD_REVISIONS_MANAGE, PERMISSIONS.PROD_TASKS_READ, PERMISSIONS.PROD_TASKS_SUBMIT] },
  { dept: 'accounts', slug: 'accounts_exec', name: 'Accounts Executive', level: 20, perms: [PERMISSIONS.ACC_INVOICES_READ, PERMISSIONS.ACC_PAYMENTS_RECORD, PERMISSIONS.ACC_REPORTS] },
  { dept: 'accounts', slug: 'accounts_manager', name: 'Accounts Manager', level: 50, perms: [PERMISSIONS.ACC_INVOICES_READ, PERMISSIONS.ACC_PAYMENTS_RECORD, PERMISSIONS.ACC_REFUND_APPROVE, PERMISSIONS.ACC_REPORTS] },
  {
    dept: 'hr',
    slug: 'hr_executive',
    name: 'HR Executive',
    level: 20,
    perms: [
      PERMISSIONS.HR_DASHBOARD,
      PERMISSIONS.HR_EMPLOYEES_READ,
      PERMISSIONS.HR_EMPLOYEES_WRITE,
      PERMISSIONS.HR_LEAVE_MANAGE,
      PERMISSIONS.HR_ATTENDANCE_MANAGE,
      PERMISSIONS.HR_PAYROLL_MANAGE,
      PERMISSIONS.HR_MENU_MANAGE,
      PERMISSIONS.HR_SELF_PORTAL,
    ],
  },
  {
    dept: 'hr',
    slug: 'hr_manager',
    name: 'HR Manager',
    level: 50,
    perms: [
      PERMISSIONS.HR_DASHBOARD,
      PERMISSIONS.HR_EMPLOYEES_READ,
      PERMISSIONS.HR_EMPLOYEES_WRITE,
      PERMISSIONS.HR_LEAVE_MANAGE,
      PERMISSIONS.HR_ATTENDANCE_MANAGE,
      PERMISSIONS.HR_PAYROLL_MANAGE,
      PERMISSIONS.HR_MENU_MANAGE,
      PERMISSIONS.HR_SELF_PORTAL,
      PERMISSIONS.ADMIN_DEPARTMENTS,
    ],
  },
  { dept: 'it', slug: 'it_support', name: 'IT Support', level: 10, perms: [PERMISSIONS.IT_AUDIT_READ] },
  { dept: 'it', slug: 'it_admin', name: 'IT Admin', level: 50, perms: [PERMISSIONS.IT_USERS_MANAGE, PERMISSIONS.IT_ROLES_MANAGE, PERMISSIONS.IT_AUDIT_READ, PERMISSIONS.IT_INTEGRATIONS, PERMISSIONS.ADMIN_DEPARTMENTS, PERMISSIONS.ADMIN_SETTINGS] },
  { dept: 'devops', slug: 'devops_engineer', name: 'DevOps Engineer', level: 20, perms: [PERMISSIONS.OPS_DEPLOYMENTS_READ, PERMISSIONS.OPS_DEPLOYMENTS_WRITE, PERMISSIONS.PROD_PROJECTS_READ] },
  { dept: 'devops', slug: 'devops_lead', name: 'DevOps Lead', level: 40, perms: [PERMISSIONS.OPS_DEPLOYMENTS_READ, PERMISSIONS.OPS_DEPLOYMENTS_WRITE, PERMISSIONS.PROD_PROJECTS_READ] },
  { dept: 'it', slug: 'super_admin', name: 'Super Admin', level: 100, perms: [PERMISSIONS.SUPER_ALL, PERMISSIONS.ADMIN_SETTINGS, PERMISSIONS.ADMIN_DEPARTMENTS, ...ALL_PERMISSIONS] },
];

async function main() {
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { slug: p },
      create: { slug: p, description: p },
      update: {},
    });
  }

  const deptMap: Record<string, number> = {};
  for (const d of DEPT_DATA) {
    const dept = await prisma.department.upsert({
      where: { slug: d.slug },
      create: d,
      update: { name: d.name },
    });
    deptMap[d.slug] = dept.id;
  }

  const prodId = deptMap.production;
  const designTeam = await prisma.productionTeam.upsert({
    where: { departmentId_slug: { departmentId: prodId, slug: 'design' } },
    create: { departmentId: prodId, slug: 'design', name: 'Design Team' },
    update: {},
  });
  const devTeam = await prisma.productionTeam.upsert({
    where: { departmentId_slug: { departmentId: prodId, slug: 'development' } },
    create: { departmentId: prodId, slug: 'development', name: 'Development Team' },
    update: {},
  });

  const permRecords = await prisma.permission.findMany();
  const permBySlug = Object.fromEntries(permRecords.map((p) => [p.slug, p.id]));

  const desigMap: Record<string, number> = {};
  for (const d of DESIGNATIONS) {
    const deptId = deptMap[d.dept];
    const designation = await prisma.designation.upsert({
      where: { departmentId_slug: { departmentId: deptId, slug: d.slug } },
      create: { departmentId: deptId, slug: d.slug, name: d.name, level: d.level },
      update: { name: d.name, level: d.level },
    });
    desigMap[`${d.dept}.${d.slug}`] = designation.id;
    await prisma.designationPermission.deleteMany({ where: { designationId: designation.id } });
    const uniquePerms = [...new Set(d.perms)];
    for (const slug of uniquePerms) {
      const pid = permBySlug[slug];
      if (pid) {
        await prisma.designationPermission.create({
          data: { designationId: designation.id, permissionId: pid },
        });
      }
    }
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const teamBySlug: Record<string, number> = { design: designTeam.id, development: devTeam.id };

  for (const role of DEMO_ROLES) {
    const email = demoEmail(role.dept, role.slug);
    const desigKey = `${role.dept}.${role.slug}`;
    let teamId: number | undefined;
    if (role.slug === 'junior_designer') teamId = teamBySlug.design;
    if (role.slug === 'junior_developer') teamId = teamBySlug.development;

    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: role.name,
        passwordHash: hash,
        departmentId: deptMap[role.dept],
        designationId: desigMap[desigKey],
        teamId,
      },
      update: {
        passwordHash: hash,
        name: role.name,
        departmentId: deptMap[role.dept],
        designationId: desigMap[desigKey],
        teamId: teamId ?? null,
        isActive: true,
      },
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: 'company_name' },
    create: { key: 'company_name', value: 'Ops Platform Demo' },
    update: {},
  });

  const { createLeadWithProject, assignProjectManager } = await import('../src/services/crm-project.js');
  const finder = await prisma.user.findUnique({ where: { email: 'sales.lead_finder@ops.test' } });
  const manager = await prisma.user.findUnique({ where: { email: 'sales.sales_manager@ops.test' } });
  const pm = await prisma.user.findUnique({ where: { email: 'sales.project_manager@ops.test' } });

  if (finder && manager && pm) {
    const pending = await createLeadWithProject({
      createdById: finder.id,
      contactName: 'Sarah Mitchell',
      companyName: 'Bright Retail Co',
      phone: '+1-555-0101',
      email: 'sarah@brightretail.com',
      notes: 'E-commerce redesign — awaiting manager',
      projectCategory: 'combo',
    });
    const active = await createLeadWithProject({
      createdById: finder.id,
      contactName: 'Maria Lopez',
      companyName: 'Lopez Legal',
      phone: '+1-555-0103',
      notes: 'Assigned to PM — active engagement',
      projectCategory: 'development',
    });
    await assignProjectManager(active.lead.id, pm.id, manager.id);

    if (active.project) {
      const invoiceNumber = `INV-${new Date().getFullYear()}-9001`;
      let inv = await prisma.invoice.findUnique({ where: { invoiceNumber } });
      if (!inv) {
        inv = await prisma.invoice.create({
          data: {
            invoiceNumber,
            clientId: active.project.clientId,
            leadId: active.lead.id,
            projectId: active.project.id,
            sellerId: pm.id,
            projectCategory: 'development',
            subtotal: 4500,
            total: 4500,
            amountPaid: 4500,
            status: 'paid',
            paidAt: new Date(),
            items: { create: [{ description: 'Website development', quantity: 1, unitPrice: 4500, lineTotal: 4500 }] },
          },
        });
        const { createProjectsFromInvoice } = await import('../src/services/projects.js');
        await createProjectsFromInvoice(inv.id, pm.id);
      }
    }
    void pending;
  }

  const selfPortalPid = permBySlug[PERMISSIONS.HR_SELF_PORTAL];
  if (selfPortalPid) {
    const allDesigs = await prisma.designation.findMany();
    for (const d of allDesigs) {
      const link = await prisma.designationPermission.findFirst({
        where: { designationId: d.id, permissionId: selfPortalPid },
      });
      if (!link) {
        await prisma.designationPermission.create({
          data: { designationId: d.id, permissionId: selfPortalPid },
        });
      }
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.cafeteriaMenu.upsert({
    where: { menuDate: today },
    create: {
      menuDate: today,
      breakfast: 'Oatmeal, fresh fruit, tea & coffee',
      lunch: 'Grilled chicken, rice, seasonal vegetables, salad bar',
      dinner: 'Vegetable pasta, garlic bread (cafeteria closes 7pm)',
      snacks: 'Cookies & seasonal fruit (3pm)',
      notes: 'Vegetarian options available at all stations',
    },
    update: {},
  });

  const allUsers = await prisma.user.findMany({ include: { designation: true } });
  const year = new Date().getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (const u of allUsers) {
    if (!u.isActive) continue;
    const has = await prisma.employeeProfile.findUnique({ where: { userId: u.id } });
    if (!has) {
      await prisma.employeeProfile.create({
        data: {
          userId: u.id,
          employeeCode: `EMP-${u.id}-${year}`,
          dateOfJoining: new Date(),
          employmentStatus: 'active',
        },
      });
    }

    const baseSalary = 3000 + (u.designation.level * 800);
    await prisma.employeePayroll.upsert({
      where: { userId: u.id },
      create: {
        userId: u.id,
        baseSalary,
        currency: 'USD',
        payFrequency: 'monthly',
        bankName: 'Demo Bank',
        bankLast4: String(1000 + u.id).slice(-4),
      },
      update: { baseSalary },
    });

    await prisma.leaveBalance.upsert({
      where: { userId: u.id },
      create: { userId: u.id, annualAllowance: 20, sickAllowance: 10, annualUsed: u.id % 3, sickUsed: u.id % 2 },
      update: {},
    });

    for (let m = 1; m <= 3; m++) {
      const pm = ((year * 12 + m - 1 - 3) % 12) + 1;
      const py = pm > m ? year : year - 1;
      const gross = baseSalary;
      const ded = Math.round(gross * 0.12);
      await prisma.salarySlip.upsert({
        where: { userId_periodYear_periodMonth: { userId: u.id, periodYear: py, periodMonth: pm } },
        create: {
          userId: u.id,
          periodMonth: pm,
          periodYear: py,
          periodLabel: `${months[pm - 1]} ${py}`,
          grossPay: gross,
          deductions: ded,
          netPay: gross - ded,
          allowances: 'Transport $100',
          notes: 'Demo payslip',
        },
        update: {},
      });
    }
  }

  console.log(`Seed complete. ${DEMO_ROLES.length} users — password for all: ${DEMO_PASSWORD}`);
  console.log('Example: it.super_admin@ops.test');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
