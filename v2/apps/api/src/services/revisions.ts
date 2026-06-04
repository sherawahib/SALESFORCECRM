import { prisma } from '../lib/prisma.js';
import { notify } from '../lib/notify.js';

export async function nextRevisionNumber(projectId: number) {
  const count = await prisma.projectRevision.count({ where: { projectId } });
  return count + 1;
}

export type ProductionDiscipline = 'design' | 'development';

export function disciplineForJunior(slug: string): ProductionDiscipline | null {
  if (slug === 'junior_designer') return 'design';
  if (slug === 'junior_developer') return 'development';
  return null;
}

export function headSlugForDiscipline(discipline: ProductionDiscipline): string {
  return discipline === 'design' ? 'design_head' : 'dev_head';
}

export function categoryAllowsDiscipline(projectCategory: string, discipline: ProductionDiscipline): boolean {
  if (projectCategory === 'combo') return true;
  return projectCategory === discipline;
}

export function defaultCrewIdForProject(
  project: { assignedDesignerId: number | null; assignedDeveloperId: number | null },
  discipline: ProductionDiscipline
): number | null {
  return discipline === 'design' ? project.assignedDesignerId : project.assignedDeveloperId;
}

export async function getHeadUserId(discipline: ProductionDiscipline): Promise<number | null> {
  const head = await prisma.user.findFirst({
    where: { isActive: true, designation: { slug: headSlugForDiscipline(discipline) } },
    select: { id: true },
  });
  return head?.id ?? null;
}

export async function assertHeadForDiscipline(userId: number, discipline: ProductionDiscipline) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { designation: true },
  });
  if (!user?.isActive) throw new Error('User not found');
  const allowed = [headSlugForDiscipline(discipline), 'super_admin', 'production_manager'];
  if (!allowed.includes(user.designation.slug)) {
    throw new Error('Only the department head for this discipline may perform this action');
  }
  return user;
}

/** List junior designers / developers. `anyDepartment` = PM can pick Design or Development regardless of project category. */
export async function listProductionCrewForProject(projectId: number, opts?: { anyDepartment?: boolean }) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  const juniors = await prisma.user.findMany({
    where: {
      isActive: true,
      designation: { slug: { in: ['junior_designer', 'junior_developer'] } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      designation: { select: { slug: true, name: true } },
      team: { select: { slug: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });

  const designers = juniors.filter((u) => u.designation.slug === 'junior_designer');
  const developers = juniors.filter((u) => u.designation.slug === 'junior_developer');

  const cat = project.projectCategory;
  const allowedDisciplines: ProductionDiscipline[] = opts?.anyDepartment
    ? ['design', 'development']
    : cat === 'combo'
      ? ['design', 'development']
      : cat === 'design'
        ? ['design']
        : ['development'];

  return {
    projectCategory: cat,
    anyDepartment: !!opts?.anyDepartment,
    allowedDisciplines,
    assignedDesignerId: project.assignedDesignerId,
    assignedDeveloperId: project.assignedDeveloperId,
    designers,
    developers,
  };
}

/** Head sets or changes the project's default designer or developer (any time). */
export async function setProjectDefaultCrew(
  projectId: number,
  headUserId: number,
  discipline: ProductionDiscipline,
  assigneeId: number,
  opts?: { allowAnyDepartment?: boolean }
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');
  if (!opts?.allowAnyDepartment && !categoryAllowsDiscipline(project.projectCategory, discipline)) {
    throw new Error(`Project category does not include ${discipline}`);
  }

  await assertHeadForDiscipline(headUserId, discipline);

  const assignee = await prisma.user.findUnique({
    where: { id: assigneeId },
    include: { designation: true, team: true },
  });
  if (!assignee?.isActive) throw new Error('Crew member not found');
  if (disciplineForJunior(assignee.designation.slug) !== discipline) {
    throw new Error('Crew member does not match discipline');
  }

  const data =
    discipline === 'design'
      ? { assignedDesignerId: assigneeId, teamId: assignee.teamId ?? project.teamId }
      : { assignedDeveloperId: assigneeId, teamId: assignee.teamId ?? project.teamId };

  const headId = await getHeadUserId(discipline);
  await prisma.project.update({
    where: { id: projectId },
    data: { ...data, headUserId: headId ?? project.headUserId },
  });

  if (project.projectManagerId) {
    await notify(
      project.projectManagerId,
      'crew_updated',
      `Default ${discipline} crew updated`,
      `${assignee.name} is now the ${discipline} owner on this project`,
      `/projects/${projectId}`
    );
  }
  await notify(assigneeId, 'project_crew', 'You are on this project', project.title, `/production`);

  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assignedDesigner: { select: { id: true, name: true } },
      assignedDeveloper: { select: { id: true, name: true } },
    },
  });
}

/** Dispatch revision work to a junior (creates assignment + notifies). */
async function dispatchRevisionToJunior(
  revisionId: number,
  projectId: number,
  revNum: number,
  discipline: ProductionDiscipline,
  assigneeId: number,
  instructions: string,
  assignedById: number
) {
  const assignee = await prisma.user.findUnique({
    where: { id: assigneeId },
    include: { designation: true, team: true },
  });
  if (!assignee) throw new Error('Assignee not found');

  await prisma.projectRevision.update({
    where: { id: revisionId },
    data: { assigneeId, productionDiscipline: discipline, status: 'assigned' },
  });

  await prisma.projectAssignment.create({
    data: {
      projectId,
      assignedById,
      assigneeId,
      instructions: `[Revision v${revNum} — ${discipline}]\n${instructions}`,
      status: 'assigned',
    },
  });

  const headId = await getHeadUserId(discipline);
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'in_progress', teamId: assignee.teamId ?? undefined, headUserId: headId ?? undefined },
  });

  await notify(assigneeId, 'revision_assigned', `Revision v${revNum}`, instructions, `/production`);
  if (headId) {
    await notify(headId, 'revision_routed', `Revision v${revNum} assigned`, `→ ${assignee.name}`, `/production`);
  }

  return prisma.projectRevision.findUnique({
    where: { id: revisionId },
    include: {
      assignee: { select: { id: true, name: true, designation: { select: { name: true } }, team: { select: { name: true } } } },
    },
  });
}

/** Head assigns a pending revision and sets project default crew for that discipline. */
export async function headAssignRevisionCrew(
  revisionId: number,
  headUserId: number,
  input: { assigneeId: number; instructions?: string }
) {
  const rev = await prisma.projectRevision.findUnique({
    where: { id: revisionId },
    include: { project: true },
  });
  if (!rev) throw new Error('Revision not found');
  if (rev.status !== 'pending_head_assignment') {
    throw new Error('Revision is not awaiting head assignment');
  }

  const discipline = rev.productionDiscipline as ProductionDiscipline;
  if (!discipline) throw new Error('Revision has no discipline');

  await assertHeadForDiscipline(headUserId, discipline);

  const allowAnyDepartment = !!rev.openedReason?.includes('[Additional revision');
  await setProjectDefaultCrew(rev.projectId, headUserId, discipline, input.assigneeId, { allowAnyDepartment });

  const instructions = input.instructions?.trim() || rev.openedReason || 'Client revision work';
  return dispatchRevisionToJunior(
    revisionId,
    rev.projectId,
    rev.revisionNumber,
    discipline,
    input.assigneeId,
    instructions,
    headUserId
  );
}

/** Project Manager opens revision → routes to Design/Dev head for junior assignment. */
export async function openRevisionFromClient(
  projectId: number,
  pmUserId: number,
  clientFeedback: string,
  input: { discipline: ProductionDiscipline; instructions: string },
  opts?: { allowAnyDepartment?: boolean }
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  if (project.projectManagerId !== pmUserId) {
    const override = await prisma.user.findFirst({
      where: { id: pmUserId, designation: { slug: 'super_admin' } },
    });
    if (!override) throw new Error('Only the assigned Project Manager may assign revisions');
  }

  if (!opts?.allowAnyDepartment && !categoryAllowsDiscipline(project.projectCategory, input.discipline)) {
    throw new Error(`This project category (${project.projectCategory}) does not allow ${input.discipline} work`);
  }

  const revNum = await nextRevisionNumber(projectId);
  const openedReason = `${clientFeedback}\n\n[Instructions for production head]\n${input.instructions}`;

  const rev = await prisma.projectRevision.create({
    data: {
      projectId,
      revisionNumber: revNum,
      openedById: pmUserId,
      openedReason,
      productionDiscipline: input.discipline,
      status: 'pending_head_assignment',
    },
  });

  await prisma.project.update({ where: { id: projectId }, data: { status: 'open_revision' } });

  const headId = await getHeadUserId(input.discipline);
  if (headId) {
    await notify(
      headId,
      'revision_pending',
      `Assign ${input.discipline} crew — revision v${revNum}`,
      `${project.title}: ${clientFeedback.slice(0, 120)}`,
      '/production?tab=head-queue'
    );
  }

  return rev;
}

const JUNIOR_EDITABLE_REVISION = ['assigned', 'incomplete', 'missing_requirement'] as const;

export type JuniorRevisionCrewStatus = 'incomplete' | 'missing_requirement' | 'successfully_done';

/** Junior designer/developer updates revision progress status. */
export async function updateRevisionCrewStatus(
  revisionId: number,
  crewUserId: number,
  status: JuniorRevisionCrewStatus,
  notes?: string
) {
  const rev = await prisma.projectRevision.findUnique({
    where: { id: revisionId },
    include: { project: true },
  });
  if (!rev) throw new Error('Revision not found');
  if (rev.assigneeId !== crewUserId) {
    throw new Error('Only the assigned designer or developer may update this revision');
  }
  if (!JUNIOR_EDITABLE_REVISION.includes(rev.status as (typeof JUNIOR_EDITABLE_REVISION)[number])) {
    throw new Error('This revision can no longer be updated (already submitted or closed)');
  }

  const noteText = notes?.trim() || '';

  if (status === 'successfully_done') {
    await prisma.projectRevision.update({
      where: { id: revisionId },
      data: {
        status: 'review_pending',
        developerNotes: noteText || rev.developerNotes,
        resolutionNote: noteText || null,
        submittedAt: new Date(),
      },
    });
    await prisma.project.update({
      where: { id: rev.projectId },
      data: { status: 'review_pending' },
    });
    const headId = rev.productionDiscipline
      ? await getHeadUserId(rev.productionDiscipline as ProductionDiscipline)
      : rev.project.headUserId;
    if (headId) {
      await notify(
        headId,
        'head_review',
        'Revision successfully done',
        `v${rev.revisionNumber} ready for your review`,
        `/production?tab=head-queue`
      );
    }
    return prisma.projectRevision.findUnique({ where: { id: revisionId } });
  }

  if (status === 'missing_requirement') {
    if (!noteText) throw new Error('Describe what requirement is missing');
    await prisma.projectRevision.update({
      where: { id: revisionId },
      data: {
        status: 'missing_requirement',
        resolutionNote: noteText,
        developerNotes: noteText,
      },
    });
    if (rev.project.projectManagerId) {
      await notify(
        rev.project.projectManagerId,
        'revision_blocked',
        'Missing requirement on revision',
        `v${rev.revisionNumber}: ${noteText.slice(0, 160)}`,
        `/projects/${rev.projectId}`
      );
    }
    const headId = rev.productionDiscipline
      ? await getHeadUserId(rev.productionDiscipline as ProductionDiscipline)
      : rev.project.headUserId;
    if (headId) {
      await notify(headId, 'revision_blocked', 'Missing requirement', `v${rev.revisionNumber}`, `/production`);
    }
    return prisma.projectRevision.findUnique({ where: { id: revisionId } });
  }

  await prisma.projectRevision.update({
    where: { id: revisionId },
    data: {
      status: 'incomplete',
      developerNotes: noteText || rev.developerNotes,
      resolutionNote: noteText || null,
    },
  });
  return prisma.projectRevision.findUnique({ where: { id: revisionId } });
}

/** Additional revision — PM may route to Design or Development on any project type. */
export async function openAdditionalRevisionFromClient(
  projectId: number,
  pmUserId: number,
  clientFeedback: string,
  input: { discipline: ProductionDiscipline; instructions: string }
) {
  const note = `[Additional revision — ${input.discipline} department]\n${clientFeedback}`;
  return openRevisionFromClient(projectId, pmUserId, note, input, { allowAnyDepartment: true });
}
