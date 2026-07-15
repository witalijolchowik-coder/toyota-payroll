import type {
  Absence,
  DailyValue,
  Department,
  DepartmentShiftCorrection,
  Employee,
  EmployeeAssignment,
  IsoDate,
  MonthId,
  ScheduleCorrection,
  ShiftHoursVersion,
} from '../../types/firestore';
import {
  createPayrollMonthCalendar,
  resolveDailyWorkTimeDeviation,
} from '../payroll';
import {
  generateEmployeeMonthlySchedule,
  type PlannedScheduleDay,
} from './monthlySchedule';

export interface ShiftCorrectionProposal {
  departmentId: string;
  effectiveDate: IsoDate;
  shiftMode: DepartmentShiftCorrection['shiftMode'];
  groupAssignments: DepartmentShiftCorrection['groupAssignments'];
}

export interface ShiftCorrectionImpactDetail {
  employeeId: string;
  employeeName: string;
  tetaNumber: string;
  date: IsoDate;
  before: PlannedScheduleDay;
  after: PlannedScheduleDay;
  hasManualActual: boolean;
  hasOvertime: boolean;
  hasShortageOrPrivateTime: boolean;
  hasAbsence: boolean;
  hasConfirmedL4: boolean;
  requiresReview: boolean;
}

export interface ShiftCorrectionImpactSummary {
  departmentId: string;
  effectiveDate: IsoDate;
  rangeStart: IsoDate;
  rangeEnd: IsoDate;
  boundedByNextCorrection: boolean;
  previousCorrectionId: string | null;
  nextCorrectionId: string | null;
  employeeCount: number;
  changedPlanDayCount: number;
  manualActualCount: number;
  overtimeCount: number;
  shortageOrPrivateTimeCount: number;
  absenceCount: number;
  confirmedL4Count: number;
  reviewRequiredCount: number;
  details: ShiftCorrectionImpactDetail[];
}

export interface ShiftCorrectionImpactInput {
  proposal: ShiftCorrectionProposal;
  openMonthIds: readonly MonthId[];
  employees: readonly Employee[];
  departments: readonly Department[];
  assignments?: readonly EmployeeAssignment[];
  scheduleCorrections?: readonly ScheduleCorrection[];
  departmentShiftCorrections?: readonly DepartmentShiftCorrection[];
  shiftHoursVersions?: readonly ShiftHoursVersion[];
  dailyValues?: readonly DailyValue[];
  absences?: readonly Absence[];
}

export function analyzeShiftCorrectionImpact({
  proposal,
  openMonthIds,
  employees,
  departments,
  assignments = [],
  scheduleCorrections = [],
  departmentShiftCorrections = [],
  shiftHoursVersions = [],
  dailyValues = [],
  absences = [],
}: ShiftCorrectionImpactInput): ShiftCorrectionImpactSummary {
  const activeDepartmentCorrections = departmentShiftCorrections
    .filter(
      (correction) =>
        correction.status === 'ACTIVE' &&
        correction.departmentId === proposal.departmentId,
    )
    .sort((first, second) =>
      first.effectiveDate.localeCompare(second.effectiveDate),
    );
  const previousCorrection = activeDepartmentCorrections
    .filter((correction) => correction.effectiveDate < proposal.effectiveDate)
    .at(-1);
  const nextCorrection = activeDepartmentCorrections.find(
    (correction) => correction.effectiveDate > proposal.effectiveDate,
  );
  const latestOpenDate = openMonthIds
    .map((monthId) => `${monthId}-${daysInMonth(monthId)}` as IsoDate)
    .sort()
    .at(-1);
  const boundedEnd = nextCorrection
    ? previousIsoDate(nextCorrection.effectiveDate)
    : (latestOpenDate ?? proposal.effectiveDate);
  const availableRangeEnd =
    latestOpenDate && boundedEnd > latestOpenDate ? latestOpenDate : boundedEnd;
  const rangeEnd =
    availableRangeEnd < proposal.effectiveDate
      ? proposal.effectiveDate
      : availableRangeEnd;
  const comparisonDays = openMonthIds
    .flatMap((monthId) => createPayrollMonthCalendar(monthId))
    .filter(
      (day) => day.isoDate >= proposal.effectiveDate && day.isoDate <= rangeEnd,
    )
    .sort((first, second) => first.isoDate.localeCompare(second.isoDate));
  const proposedCorrection = asDomainCorrection(proposal);
  const afterCorrections = [...departmentShiftCorrections, proposedCorrection];
  const dailyValueByEmployeeDate = new Map(
    dailyValues.map((value) => [
      employeeDateKey(value.employeeId, value.date),
      value,
    ]),
  );
  const details: ShiftCorrectionImpactDetail[] = [];

  employees.forEach((employee) => {
    const beforeSchedule = generateEmployeeMonthlySchedule({
      employee,
      days: comparisonDays,
      departments,
      options: {
        assignments,
        corrections: scheduleCorrections,
        departmentShiftCorrections,
        shiftHoursVersions,
      },
    });
    const afterSchedule = generateEmployeeMonthlySchedule({
      employee,
      days: comparisonDays,
      departments,
      options: {
        assignments,
        corrections: scheduleCorrections,
        departmentShiftCorrections: afterCorrections,
        shiftHoursVersions,
      },
    });

    beforeSchedule.forEach((before, index) => {
      const after = afterSchedule[index];
      if (
        !after ||
        before.departmentId !== proposal.departmentId ||
        !meaningfulPlanChanged(before, after)
      ) {
        return;
      }
      const dailyValue = dailyValueByEmployeeDate.get(
        employeeDateKey(employee.id, before.date),
      );
      const deviation = dailyValue?.workTimeCorrection
        ? resolveStoredDeviation(dailyValue)
        : null;
      const classification =
        dailyValue?.workTimeCorrection?.classificationOverride;
      const hasManualActual = Boolean(dailyValue?.workTimeCorrection);
      const hasOvertime = Boolean(
        positive(classification?.overtime50Hours) ||
        positive(classification?.overtime100Hours) ||
        positive(deviation?.overtime50Hours) ||
        positive(deviation?.overtime100Hours),
      );
      const hasShortageOrPrivateTime = Boolean(
        positive(classification?.privateTimeHours) ||
        positive(classification?.coverableNiHours) ||
        positive(deviation?.privateTimeHours),
      );
      const matchingAbsences = absences.filter(
        (absence) =>
          absence.status === 'ACTIVE' &&
          absence.employeeId === employee.id &&
          absence.startDate <= before.date &&
          absence.endDate >= before.date,
      );
      const hasAbsence = matchingAbsences.length > 0;
      const hasConfirmedL4 = matchingAbsences.some(
        (absence) =>
          absence.absenceCode === 'L4' && absence.source === 'absence_import',
      );
      const requiresReview = Boolean(dailyValue);

      details.push({
        employeeId: employee.id,
        employeeName: `${employee.lastName} ${employee.firstName}`.trim(),
        tetaNumber: employee.tetaNumber,
        date: before.date,
        before,
        after,
        hasManualActual,
        hasOvertime,
        hasShortageOrPrivateTime,
        hasAbsence,
        hasConfirmedL4,
        requiresReview,
      });
    });
  });

  details.sort(
    (first, second) =>
      first.employeeName.localeCompare(second.employeeName, 'pl') ||
      first.date.localeCompare(second.date),
  );
  return {
    departmentId: proposal.departmentId,
    effectiveDate: proposal.effectiveDate,
    rangeStart: proposal.effectiveDate,
    rangeEnd,
    boundedByNextCorrection: Boolean(nextCorrection),
    previousCorrectionId: previousCorrection?.id ?? null,
    nextCorrectionId: nextCorrection?.id ?? null,
    employeeCount: new Set(details.map((detail) => detail.employeeId)).size,
    changedPlanDayCount: details.length,
    manualActualCount: count(details, (detail) => detail.hasManualActual),
    overtimeCount: count(details, (detail) => detail.hasOvertime),
    shortageOrPrivateTimeCount: count(
      details,
      (detail) => detail.hasShortageOrPrivateTime,
    ),
    absenceCount: count(details, (detail) => detail.hasAbsence),
    confirmedL4Count: count(details, (detail) => detail.hasConfirmedL4),
    reviewRequiredCount: count(details, (detail) => detail.requiresReview),
    details,
  };
}

export function meaningfulPlanChanged(
  before: PlannedScheduleDay,
  after: PlannedScheduleDay,
): boolean {
  return (
    before.shift !== after.shift ||
    before.plannedStartTime !== after.plannedStartTime ||
    before.plannedEndTime !== after.plannedEndTime ||
    before.plannedDuration !== after.plannedDuration ||
    before.status !== after.status
  );
}

function resolveStoredDeviation(value: DailyValue) {
  const correction = value.workTimeCorrection!;
  return resolveDailyWorkTimeDeviation({
    planned: {
      shift: correction.plannedShift,
      startTime: correction.plannedStartTime,
      endTime: correction.plannedEndTime,
    },
    actual: {
      startTime: correction.actualStartTime,
      endTime: correction.actualEndTime,
    },
    isWorkingDay: true,
    classificationOverride: correction.classificationOverride,
  });
}

function asDomainCorrection(
  proposal: ShiftCorrectionProposal,
): DepartmentShiftCorrection {
  const timestamp = new Date(0);
  return {
    id: '__impact_preview__',
    ...proposal,
    status: 'ACTIVE',
    note: null,
    createdAt: timestamp,
    createdBy: '__preview__',
    updatedAt: timestamp,
    updatedBy: '__preview__',
  };
}

function employeeDateKey(employeeId: string, date: IsoDate): string {
  return `${employeeId}::${date}`;
}

function positive(value: number | null | undefined): boolean {
  return typeof value === 'number' && value > 0;
}

function count<T>(values: readonly T[], predicate: (value: T) => boolean) {
  return values.reduce((total, value) => total + Number(predicate(value)), 0);
}

function daysInMonth(monthId: MonthId): string {
  const [year, month] = monthId.split('-').map(Number);
  return String(new Date(Date.UTC(year!, month!, 0)).getUTCDate()).padStart(
    2,
    '0',
  );
}

function previousIsoDate(value: IsoDate): IsoDate {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10) as IsoDate;
}
