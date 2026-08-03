import type {
  DepartmentId,
  EmployeeAssignment,
  EmployeeColorShift,
  EmployeeContract,
  IsoDate,
} from '../../types/firestore';

export interface AssignmentSelection {
  departmentId: DepartmentId | null;
  shiftAssignment: EmployeeColorShift | null;
  validFrom: IsoDate;
}

export function isAssignmentDateOnOrAfterEmploymentStart(
  contracts: readonly Pick<EmployeeContract, 'startDate' | 'status'>[],
  effectiveDate: IsoDate,
): boolean {
  const firstEmploymentDate = contracts
    .filter((contract) => contract.status === 'ACTIVE')
    .map((contract) => contract.startDate)
    .sort()[0];
  return !firstEmploymentDate || effectiveDate >= firstEmploymentDate;
}

export interface AssignmentHistoryUpdate {
  assignmentId: string;
  validTo: IsoDate | null;
  status: 'ACTIVE' | 'CANCELLED';
}

export interface AssignmentTransitionPlan {
  create: (AssignmentSelection & { validTo: IsoDate | null }) | null;
  updates: AssignmentHistoryUpdate[];
  effectiveToday: Pick<
    AssignmentSelection,
    'departmentId' | 'shiftAssignment'
  > | null;
  replacedAssignmentIds: string[];
}

function previousIsoDate(value: IsoDate): IsoDate {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function sameSelection(
  assignment: Pick<EmployeeAssignment, 'departmentId' | 'shiftAssignment'>,
  selection: Pick<AssignmentSelection, 'departmentId' | 'shiftAssignment'>,
): boolean {
  return (
    assignment.departmentId === selection.departmentId &&
    assignment.shiftAssignment === selection.shiftAssignment
  );
}

function modificationTime(
  assignment: Pick<EmployeeAssignment, 'createdAt' | 'updatedAt'>,
): number {
  return (
    assignment.updatedAt?.getTime() ??
    assignment.createdAt?.getTime() ??
    Number.NEGATIVE_INFINITY
  );
}

/**
 * Plans one authoritative, effective-dated assignment without deleting history.
 * A later assignment remains planned; a same-date save replaces the earlier
 * version, and every assignment covering the chosen date is ended/cancelled.
 */
export function planEmployeeAssignmentTransition({
  assignments,
  selection,
  today,
}: {
  assignments: readonly EmployeeAssignment[];
  selection: AssignmentSelection;
  today: IsoDate;
}): AssignmentTransitionPlan {
  const active = assignments.filter(
    (assignment) => assignment.status === 'ACTIVE',
  );
  const covering = active.filter(
    (assignment) =>
      assignment.validFrom <= selection.validFrom &&
      (!assignment.validTo || assignment.validTo >= selection.validFrom),
  );
  const future = active
    .filter((assignment) => assignment.validFrom > selection.validFrom)
    .sort(
      (first, second) =>
        first.validFrom.localeCompare(second.validFrom) ||
        modificationTime(second) - modificationTime(first) ||
        second.id.localeCompare(first.id),
    );
  const nextDate = future[0]?.validFrom ?? null;

  const alreadyAuthoritative =
    covering.length === 1 && sameSelection(covering[0]!, selection);
  const updates: AssignmentHistoryUpdate[] = [];
  const replacedAssignmentIds: string[] = [];
  const setUpdate = (update: AssignmentHistoryUpdate) => {
    const index = updates.findIndex(
      (item) => item.assignmentId === update.assignmentId,
    );
    if (index >= 0) updates[index] = update;
    else updates.push(update);
  };

  if (!alreadyAuthoritative) {
    for (const assignment of covering) {
      const startsEarlier = assignment.validFrom < selection.validFrom;
      setUpdate({
        assignmentId: assignment.id,
        validTo: startsEarlier
          ? previousIsoDate(selection.validFrom)
          : assignment.validTo,
        status: startsEarlier ? 'ACTIVE' : 'CANCELLED',
      });
      replacedAssignmentIds.push(assignment.id);
    }
  }

  // Duplicate active versions on an already planned future date are resolved
  // by the most recently modified explicit version. Older versions stay in
  // history as cancelled and cannot control the calendar.
  for (let index = 0; index < future.length;) {
    const sameDate = future.filter(
      (assignment) => assignment.validFrom === future[index]!.validFrom,
    );
    for (const duplicate of sameDate.slice(1)) {
      setUpdate({
        assignmentId: duplicate.id,
        validTo: duplicate.validTo,
        status: 'CANCELLED',
      });
      replacedAssignmentIds.push(duplicate.id);
    }
    index += sameDate.length;
  }

  const futureWinners = future.filter(
    (assignment, index) =>
      index === 0 || assignment.validFrom !== future[index - 1]!.validFrom,
  );
  for (let index = 0; index < futureWinners.length - 1; index += 1) {
    const current = futureWinners[index]!;
    const next = futureWinners[index + 1]!;
    if (!current.validTo || current.validTo >= next.validFrom) {
      setUpdate({
        assignmentId: current.id,
        validTo: previousIsoDate(next.validFrom),
        status: 'ACTIVE',
      });
      replacedAssignmentIds.push(current.id);
    }
  }

  if (nextDate) {
    for (const assignment of covering) {
      if (
        alreadyAuthoritative &&
        (!assignment.validTo || assignment.validTo >= nextDate)
      ) {
        setUpdate({
          assignmentId: assignment.id,
          validTo: previousIsoDate(nextDate),
          status: 'ACTIVE',
        });
      }
    }
  }

  const create = alreadyAuthoritative
    ? null
    : {
        ...selection,
        validTo: nextDate ? previousIsoDate(nextDate) : null,
      };

  const projected = active
    .map((assignment) => {
      const update = updates.find(
        (item) => item.assignmentId === assignment.id,
      );
      return update
        ? { ...assignment, validTo: update.validTo, status: update.status }
        : assignment;
    })
    .filter((assignment) => assignment.status === 'ACTIVE');

  const projectedWithCreate: Array<
    Pick<
      EmployeeAssignment,
      | 'id'
      | 'departmentId'
      | 'shiftAssignment'
      | 'validFrom'
      | 'validTo'
      | 'status'
      | 'createdAt'
      | 'updatedAt'
    >
  > = projected;
  if (create) {
    projectedWithCreate.push({
      id: '__new__',
      departmentId: create.departmentId,
      shiftAssignment: create.shiftAssignment,
      validFrom: create.validFrom,
      validTo: create.validTo,
      status: 'ACTIVE',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
  }

  const effectiveTodayAssignment = projectedWithCreate
    .filter(
      (assignment) =>
        assignment.validFrom <= today &&
        (!assignment.validTo || assignment.validTo >= today),
    )
    .sort(
      (first, second) =>
        second.validFrom.localeCompare(first.validFrom) ||
        modificationTime(second) - modificationTime(first) ||
        second.id.localeCompare(first.id),
    )[0];

  return {
    create,
    updates,
    effectiveToday: effectiveTodayAssignment
      ? {
          departmentId: effectiveTodayAssignment.departmentId,
          shiftAssignment: effectiveTodayAssignment.shiftAssignment,
        }
      : null,
    replacedAssignmentIds,
  };
}
