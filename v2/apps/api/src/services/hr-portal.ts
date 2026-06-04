import { prisma } from '../lib/prisma.js';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function buildMyHrmsPortal(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      designation: true,
      team: true,
      manager: { select: { id: true, name: true, email: true } },
      employeeProfile: true,
      leaveBalance: true,
      payroll: true,
      salarySlips: { orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }], take: 24 },
      leaveRequests: { orderBy: { createdAt: 'desc' }, take: 20 },
      attendance: {
        where: {
          workDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        orderBy: { workDate: 'desc' },
        take: 31,
      },
    },
  });
  if (!user) throw new Error('User not found');

  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayAttendance, todayMenu] = await Promise.all([
    prisma.attendanceRecord.findUnique({
      where: { userId_workDate: { userId, workDate: today } },
    }),
    prisma.cafeteriaMenu.findUnique({ where: { menuDate: today } }),
  ]);

  const annualUsedDb = user.leaveBalance?.annualUsed ?? 0;
  const sickUsedDb = user.leaveBalance?.sickUsed ?? 0;
  const approvedAnnual = user.leaveRequests
    .filter((l) => l.status === 'approved' && l.leaveType === 'annual')
    .reduce((s, l) => s + l.days, 0);
  const approvedSick = user.leaveRequests
    .filter((l) => l.status === 'approved' && l.leaveType === 'sick')
    .reduce((s, l) => s + l.days, 0);

  const annualAllowance = user.leaveBalance?.annualAllowance ?? 20;
  const sickAllowance = user.leaveBalance?.sickAllowance ?? 10;
  const annualUsed = Math.max(annualUsedDb, approvedAnnual);
  const sickUsed = Math.max(sickUsedDb, approvedSick);

  const latestSlip = user.salarySlips[0];
  const ytdNet = user.salarySlips
    .filter((s) => s.periodYear === new Date().getFullYear())
    .reduce((sum, s) => sum + Number(s.netPay), 0);

  return {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      department: user.department,
      designation: user.designation,
      team: user.team,
      manager: user.manager,
      employee: user.employeeProfile,
      employmentStatus: user.employeeProfile?.employmentStatus ?? (user.isActive ? 'active' : 'terminated'),
    },
    leave: {
      balance: {
        annual: { allowance: annualAllowance, used: annualUsed, remaining: Math.max(0, annualAllowance - annualUsed) },
        sick: { allowance: sickAllowance, used: sickUsed, remaining: Math.max(0, sickAllowance - sickUsed) },
      },
      requests: user.leaveRequests,
      pendingCount: user.leaveRequests.filter((l) => l.status === 'pending').length,
    },
    payroll: user.payroll
      ? {
          baseSalary: Number(user.payroll.baseSalary),
          currency: user.payroll.currency,
          payFrequency: user.payroll.payFrequency,
          bankName: user.payroll.bankName,
          bankLast4: user.payroll.bankLast4,
          latestNet: latestSlip ? Number(latestSlip.netPay) : null,
          ytdNet,
        }
      : null,
    salarySlips: user.salarySlips.map((s) => ({
      id: s.id,
      periodLabel: s.periodLabel,
      periodMonth: s.periodMonth,
      periodYear: s.periodYear,
      grossPay: Number(s.grossPay),
      deductions: Number(s.deductions),
      netPay: Number(s.netPay),
      allowances: s.allowances,
      notes: s.notes,
      issuedAt: s.issuedAt,
    })),
    attendance: {
      today: todayAttendance,
      thisMonth: user.attendance,
    },
    cafeteria: todayMenu
      ? {
          menuDate: todayMenu.menuDate,
          breakfast: todayMenu.breakfast,
          lunch: todayMenu.lunch,
          dinner: todayMenu.dinner,
          snacks: todayMenu.snacks,
          notes: todayMenu.notes,
        }
      : null,
  };
}
