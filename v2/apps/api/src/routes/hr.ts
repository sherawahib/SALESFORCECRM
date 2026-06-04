import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth, requirePerm } from '../plugins/authenticate.js';
import { PERMISSIONS } from '@ops/shared';
import { audit } from '../lib/audit.js';
import { buildMyHrmsPortal } from '../services/hr-portal.js';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function employeeCode() {
  return `EMP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
}

const employeeInclude = {
  department: true,
  designation: true,
  team: true,
  employeeProfile: true,
  manager: { select: { id: true, name: true } },
} as const;

export async function hrRoutes(app: FastifyInstance) {
  app.get('/dashboard', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_DASHBOARD)] }, async () => {
    const [total, active, onLeave, pendingLeave, todayAttendance] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.employeeProfile.count({ where: { employmentStatus: 'on_leave' } }),
      prisma.leaveRequest.count({ where: { status: 'pending' } }),
      (() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return prisma.attendanceRecord.count({ where: { workDate: { gte: start, lt: end } } });
      })(),
    ]);
    const byDept = await prisma.department.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
    return { total, active, onLeave, pendingLeave, todayAttendance, byDept };
  });

  app.get('/org-structure', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_EMPLOYEES_READ)] }, async () => {
    const departments = await prisma.department.findMany({
      include: { designations: { orderBy: { level: 'desc' } } },
      orderBy: { name: 'asc' },
    });
    const teams = await prisma.productionTeam.findMany({
      include: { department: { select: { slug: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    const managers = await prisma.user.findMany({
      where: { isActive: true, designation: { level: { gte: 40 } } },
      select: { id: true, name: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return { departments, teams, managers };
  });

  app.get('/employees', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_EMPLOYEES_READ)] }, async () => {
    return prisma.user.findMany({
      include: employeeInclude,
      orderBy: { name: 'asc' },
    });
  });

  app.get('/employees/:id', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_EMPLOYEES_READ)] }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const user = await prisma.user.findUnique({ where: { id }, include: employeeInclude });
    if (!user) return reply.status(404).send({ error: 'Employee not found' });
    return user;
  });

  app.post('/employees', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_EMPLOYEES_WRITE)] }, async (request, reply) => {
    const auth = getAuth(request);
    const body = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        departmentId: z.number(),
        designationId: z.number(),
        teamId: z.number().optional().nullable(),
        managerId: z.number().optional().nullable(),
        employeeCode: z.string().optional(),
        phone: z.string().optional(),
        personalEmail: z.string().email().optional(),
        dateOfJoining: z.string().optional(),
        employmentType: z.enum(['full_time', 'part_time', 'contract']).default('full_time'),
        employmentStatus: z.enum(['active', 'on_leave', 'terminated']).default('active'),
        address: z.string().optional(),
        emergencyContact: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) return reply.status(400).send({ error: 'Email already in use' });

    const designation = await prisma.designation.findUnique({ where: { id: body.designationId } });
    if (!designation || designation.departmentId !== body.departmentId) {
      return reply.status(400).send({ error: 'Role does not belong to selected department' });
    }

    const code = body.employeeCode || employeeCode();
    const hash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash: hash,
        departmentId: body.departmentId,
        designationId: body.designationId,
        teamId: body.teamId ?? null,
        managerId: body.managerId ?? null,
        isActive: body.employmentStatus !== 'terminated',
        employeeProfile: {
          create: {
            employeeCode: code,
            phone: body.phone,
            personalEmail: body.personalEmail,
            dateOfJoining: body.dateOfJoining ? new Date(body.dateOfJoining) : new Date(),
            employmentType: body.employmentType,
            employmentStatus: body.employmentStatus,
            address: body.address,
            emergencyContact: body.emergencyContact,
            notes: body.notes,
          },
        },
      },
      include: employeeInclude,
    });

    await audit(auth.id, 'user', user.id, 'hr_employee_created', { email: user.email, code }, request.ip);
    return { user, loginEmail: user.email, temporaryPassword: body.password };
  });

  app.patch('/employees/:id', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_EMPLOYEES_WRITE)] }, async (request, reply) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        departmentId: z.number().optional(),
        designationId: z.number().optional(),
        teamId: z.number().optional().nullable(),
        managerId: z.number().optional().nullable(),
        isActive: z.boolean().optional(),
        phone: z.string().optional(),
        personalEmail: z.string().email().optional().nullable(),
        dateOfJoining: z.string().optional(),
        employmentType: z.enum(['full_time', 'part_time', 'contract']).optional(),
        employmentStatus: z.enum(['active', 'on_leave', 'terminated']).optional(),
        address: z.string().optional(),
        emergencyContact: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(request.body);

    const current = await prisma.user.findUnique({ where: { id }, include: { employeeProfile: true } });
    if (!current) return reply.status(404).send({ error: 'Employee not found' });

    if (body.email && body.email.toLowerCase() !== current.email) {
      const clash = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (clash) return reply.status(400).send({ error: 'Email already in use' });
    }

    if (body.departmentId && body.designationId) {
      const designation = await prisma.designation.findUnique({ where: { id: body.designationId } });
      if (!designation || designation.departmentId !== body.departmentId) {
        return reply.status(400).send({ error: 'Role does not belong to selected department' });
      }
    }

    const userData: Record<string, unknown> = {};
    if (body.name) userData.name = body.name;
    if (body.email) userData.email = body.email.toLowerCase();
    if (body.password) userData.passwordHash = await bcrypt.hash(body.password, 10);
    if (body.departmentId) userData.departmentId = body.departmentId;
    if (body.designationId) userData.designationId = body.designationId;
    if (body.teamId !== undefined) userData.teamId = body.teamId;
    if (body.managerId !== undefined) userData.managerId = body.managerId;
    if (body.isActive !== undefined) userData.isActive = body.isActive;
    if (body.employmentStatus === 'terminated') userData.isActive = false;

    const profileData: Record<string, unknown> = {};
    if (body.phone !== undefined) profileData.phone = body.phone;
    if (body.personalEmail !== undefined) profileData.personalEmail = body.personalEmail;
    if (body.dateOfJoining) profileData.dateOfJoining = new Date(body.dateOfJoining);
    if (body.employmentType) profileData.employmentType = body.employmentType;
    if (body.employmentStatus) profileData.employmentStatus = body.employmentStatus;
    if (body.address !== undefined) profileData.address = body.address;
    if (body.emergencyContact !== undefined) profileData.emergencyContact = body.emergencyContact;
    if (body.notes !== undefined) profileData.notes = body.notes;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...userData,
        employeeProfile: current.employeeProfile
          ? { update: profileData }
          : {
              create: {
                employeeCode: employeeCode(),
                dateOfJoining: new Date(),
                ...profileData,
              },
            },
      },
      include: employeeInclude,
    });

    await audit(auth.id, 'user', id, 'hr_employee_updated', {}, request.ip);
    return user;
  });

  app.get('/leave', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_LEAVE_MANAGE)] }, async () => {
    return prisma.leaveRequest.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  });

  app.post('/leave', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_LEAVE_MANAGE)] }, async (request) => {
    const auth = getAuth(request);
    const body = z
      .object({
        userId: z.number(),
        leaveType: z.enum(['annual', 'sick', 'unpaid', 'other']),
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().optional(),
      })
      .parse(request.body);
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    return prisma.leaveRequest.create({
      data: {
        userId: body.userId,
        leaveType: body.leaveType,
        startDate: start,
        endDate: end,
        days,
        reason: body.reason,
        status: 'pending',
      },
      include: { user: { select: { name: true } } },
    });
  });

  app.post('/leave/:id/resolve', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_LEAVE_MANAGE)] }, async (request) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const body = z.object({ approve: z.boolean() }).parse(request.body);
    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: body.approve ? 'approved' : 'rejected',
        approvedById: auth.id,
        resolvedAt: new Date(),
      },
      include: { user: true },
    });
    if (body.approve) {
      await prisma.employeeProfile.updateMany({
        where: { userId: leave.userId },
        data: { employmentStatus: 'on_leave' },
      });
    }
    return leave;
  });

  app.get('/attendance', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_ATTENDANCE_MANAGE)] }, async (request) => {
    const month = (request.query as { month?: string }).month;
    const where = month
      ? {
          workDate: {
            gte: new Date(`${month}-01`),
            lt: new Date(new Date(`${month}-01`).getFullYear(), new Date(`${month}-01`).getMonth() + 1, 1),
          },
        }
      : {};
    return prisma.attendanceRecord.findMany({
      where,
      include: { user: { select: { id: true, name: true, employeeProfile: { select: { employeeCode: true } } } } },
      orderBy: { workDate: 'desc' },
      take: 300,
    });
  });

  app.post('/attendance', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_ATTENDANCE_MANAGE)] }, async (request, reply) => {
    const body = z
      .object({
        userId: z.number(),
        workDate: z.string(),
        status: z.enum(['present', 'absent', 'remote', 'half_day', 'holiday']),
        checkIn: z.string().optional(),
        checkOut: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(request.body);
    const workDate = new Date(body.workDate.slice(0, 10));
    try {
      return await prisma.attendanceRecord.upsert({
        where: { userId_workDate: { userId: body.userId, workDate } },
        create: {
          userId: body.userId,
          workDate,
          status: body.status,
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          notes: body.notes,
        },
        update: {
          status: body.status,
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          notes: body.notes,
        },
        include: { user: { select: { name: true } } },
      });
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Failed' });
    }
  });

  /** ——— Employee self-service HRMS (every logged-in user) ——— */

  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const auth = getAuth(request);
    try {
      return await buildMyHrmsPortal(auth.id);
    } catch (e) {
      return reply.status(404).send({ error: e instanceof Error ? e.message : 'Not found' });
    }
  });

  app.post('/me/leave', { preHandler: authenticate }, async (request, reply) => {
    const auth = getAuth(request);
    const body = z
      .object({
        leaveType: z.enum(['annual', 'sick', 'unpaid', 'other']),
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().optional(),
      })
      .parse(request.body);
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);

    const balance = await prisma.leaveBalance.findUnique({ where: { userId: auth.id } });
    if (body.leaveType === 'annual' && balance) {
      const remaining = balance.annualAllowance - balance.annualUsed;
      if (days > remaining) {
        return reply.status(400).send({ error: `Only ${remaining} annual leave day(s) remaining` });
      }
    }
    if (body.leaveType === 'sick' && balance) {
      const remaining = balance.sickAllowance - balance.sickUsed;
      if (days > remaining) {
        return reply.status(400).send({ error: `Only ${remaining} sick leave day(s) remaining` });
      }
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: auth.id,
        leaveType: body.leaveType,
        startDate: start,
        endDate: end,
        days,
        reason: body.reason,
        status: 'pending',
      },
    });
    return leave;
  });

  app.get('/me/salary-slips/:id', { preHandler: authenticate }, async (request, reply) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const slip = await prisma.salarySlip.findFirst({ where: { id, userId: auth.id } });
    if (!slip) return reply.status(404).send({ error: 'Salary slip not found' });
    return {
      ...slip,
      grossPay: Number(slip.grossPay),
      deductions: Number(slip.deductions),
      netPay: Number(slip.netPay),
    };
  });

  /** HR — company cafeteria menu */
  app.get('/meal-menu', { preHandler: authenticate }, async (request) => {
    const dateStr = (request.query as { date?: string }).date;
    const menuDate = dateStr ? startOfDay(new Date(dateStr)) : startOfDay();
    return prisma.cafeteriaMenu.findUnique({ where: { menuDate } });
  });

  app.put('/meal-menu', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_MENU_MANAGE)] }, async (request) => {
    const body = z
      .object({
        menuDate: z.string().optional(),
        breakfast: z.string().optional(),
        lunch: z.string().optional(),
        dinner: z.string().optional(),
        snacks: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(request.body);
    const menuDate = body.menuDate ? startOfDay(new Date(body.menuDate)) : startOfDay();
    return prisma.cafeteriaMenu.upsert({
      where: { menuDate },
      create: {
        menuDate,
        breakfast: body.breakfast,
        lunch: body.lunch,
        dinner: body.dinner,
        snacks: body.snacks,
        notes: body.notes,
      },
      update: {
        breakfast: body.breakfast,
        lunch: body.lunch,
        dinner: body.dinner,
        snacks: body.snacks,
        notes: body.notes,
      },
    });
  });

  app.put('/employees/:id/payroll', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_PAYROLL_MANAGE)] }, async (request, reply) => {
    const userId = Number((request.params as { id: string }).id);
    const body = z
      .object({
        baseSalary: z.number().positive(),
        currency: z.string().default('USD'),
        payFrequency: z.enum(['monthly', 'biweekly']).default('monthly'),
        bankName: z.string().optional(),
        bankLast4: z.string().optional(),
        taxId: z.string().optional(),
      })
      .parse(request.body);
    return prisma.employeePayroll.upsert({
      where: { userId },
      create: { userId, ...body, baseSalary: body.baseSalary },
      update: body,
    });
  });

  app.post('/employees/:id/salary-slips', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_PAYROLL_MANAGE)] }, async (request, reply) => {
    const userId = Number((request.params as { id: string }).id);
    const body = z
      .object({
        periodMonth: z.number().min(1).max(12),
        periodYear: z.number(),
        grossPay: z.number(),
        deductions: z.number().default(0),
        allowances: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(request.body);
    const net = body.grossPay - body.deductions;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const periodLabel = `${months[body.periodMonth - 1]} ${body.periodYear}`;
    try {
      return await prisma.salarySlip.create({
        data: {
          userId,
          periodMonth: body.periodMonth,
          periodYear: body.periodYear,
          periodLabel,
          grossPay: body.grossPay,
          deductions: body.deductions,
          netPay: net,
          allowances: body.allowances,
          notes: body.notes,
        },
      });
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Failed — slip may already exist for this month' });
    }
  });

  app.put('/employees/:id/leave-balance', { preHandler: [authenticate, requirePerm(PERMISSIONS.HR_LEAVE_MANAGE)] }, async (request) => {
    const userId = Number((request.params as { id: string }).id);
    const body = z
      .object({
        annualAllowance: z.number().optional(),
        annualUsed: z.number().optional(),
        sickAllowance: z.number().optional(),
        sickUsed: z.number().optional(),
      })
      .parse(request.body);
    return prisma.leaveBalance.upsert({
      where: { userId },
      create: { userId, ...body },
      update: body,
    });
  });
}
