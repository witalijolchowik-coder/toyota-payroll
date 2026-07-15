import type {
  Absence,
  DailyValue,
  Department,
  DepartmentShiftCorrection,
  Employee,
  EmployeeAssignment,
} from '../../types/firestore';
import {
  analyzeShiftCorrectionImpact,
  meaningfulPlanChanged,
} from './shiftCorrectionImpact';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'admin',
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  updatedBy: 'admin',
};

const department = (id = 'metal'): Department => ({
  id,
  name: id === 'metal' ? 'Metal' : 'Szwalnia',
  shiftMode: 'THREE_SHIFT',
  active: true,
  rotationAnchorWeekStart: '2026-06-29',
  rotationBaseAssignment: { RED: 'FIRST', WHITE: 'SECOND', BLUE: 'NIGHT' },
  ...metadata,
});

const employee = (id: string, departmentId = 'metal'): Employee => ({
  id,
  tetaNumber: `TETA-${id}`,
  firstName: 'Jan',
  lastName: `Pracownik ${id}`,
  pesel: null,
  passportNumber: null,
  foreignDocumentNumber: null,
  isActive: true,
  departmentId,
  shiftAssignment: 'RED',
  employmentStartDate: new Date('2026-01-01T00:00:00Z'),
  employmentEndDate: null,
  ...metadata,
});

const correction = (
  id: string,
  effectiveDate: string,
  assignments: DepartmentShiftCorrection['groupAssignments'],
): DepartmentShiftCorrection => ({
  id,
  departmentId: 'metal',
  effectiveDate,
  shiftMode: 'THREE_SHIFT',
  groupAssignments: assignments,
  status: 'ACTIVE',
  note: null,
  ...metadata,
});

const baseline = correction('previous', '2026-06-29', {
  RED: 'FIRST',
  WHITE: 'SECOND',
  BLUE: 'NIGHT',
});
const proposal = {
  departmentId: 'metal',
  effectiveDate: '2026-07-06',
  shiftMode: 'THREE_SHIFT' as const,
  groupAssignments: {
    RED: 'SECOND' as const,
    WHITE: 'NIGHT' as const,
    BLUE: 'FIRST' as const,
  },
};

describe('shift correction impact', () => {
  it('counts only changed employee-days in the selected department', () => {
    const result = analyzeShiftCorrectionImpact({
      proposal,
      openMonthIds: ['2026-07'],
      employees: [employee('one'), employee('other', 'szwalnia')],
      departments: [department(), department('szwalnia')],
      departmentShiftCorrections: [baseline],
    });

    expect(result.employeeCount).toBe(1);
    expect(result.changedPlanDayCount).toBeGreaterThan(0);
    expect(result.details.every((detail) => detail.employeeId === 'one')).toBe(
      true,
    );
    expect(
      result.details.every((detail) => detail.before.departmentId === 'metal'),
    ).toBe(true);
  });

  it('ends the impact segment before the next correction point', () => {
    const next = correction('next', '2026-07-15', {
      RED: 'NIGHT',
      WHITE: 'FIRST',
      BLUE: 'SECOND',
    });
    const result = analyzeShiftCorrectionImpact({
      proposal,
      openMonthIds: ['2026-07', '2026-08'],
      employees: [employee('one')],
      departments: [department()],
      departmentShiftCorrections: [baseline, next],
    });

    expect(result.rangeEnd).toBe('2026-07-14');
    expect(result.nextCorrectionId).toBe('next');
    expect(result.boundedByNextCorrection).toBe(true);
    expect(result.details.every((detail) => detail.date <= '2026-07-14')).toBe(
      true,
    );
  });

  it('respects effective department assignments', () => {
    const assignment: EmployeeAssignment = {
      id: 'assignment',
      employeeId: 'one',
      tetaNumber: 'TETA-one',
      departmentId: 'szwalnia',
      shiftAssignment: 'RED',
      validFrom: '2026-07-01',
      validTo: null,
      status: 'ACTIVE',
      note: null,
      ...metadata,
    };
    const result = analyzeShiftCorrectionImpact({
      proposal,
      openMonthIds: ['2026-07'],
      employees: [employee('one')],
      departments: [department(), department('szwalnia')],
      assignments: [assignment],
      departmentShiftCorrections: [baseline],
    });

    expect(result.changedPlanDayCount).toBe(0);
  });

  it('does not count BHP days overridden by the correction', () => {
    const starter = {
      ...employee('starter'),
      employmentStartDate: new Date('2026-07-06T00:00:00Z'),
    };
    const result = analyzeShiftCorrectionImpact({
      proposal,
      openMonthIds: ['2026-07'],
      employees: [starter],
      departments: [department()],
      departmentShiftCorrections: [baseline],
    });

    expect(result.details.some((detail) => detail.date === '2026-07-06')).toBe(
      false,
    );
    expect(result.details.some((detail) => detail.date === '2026-07-07')).toBe(
      false,
    );
  });

  it('counts each employee-day once while keeping all protection markers', () => {
    const value: DailyValue = {
      id: 'value',
      monthId: '2026-07',
      employeeId: 'one',
      tetaNumber: 'TETA-one',
      date: '2026-07-08',
      hours: 10,
      source: 'manual',
      importId: null,
      note: null,
      manualOverride: null,
      workTimeCorrection: {
        plannedShift: 'FIRST',
        plannedStartTime: '06:00',
        plannedEndTime: '14:00',
        actualStartTime: '05:00',
        actualEndTime: '16:00',
        classificationOverride: {
          privateTimeHours: 1,
          overtime50Hours: 1,
          overtime100Hours: 2,
          coverableNiHours: null,
          note: null,
          actorUid: 'admin',
          updatedAt: new Date('2026-07-08T16:00:00Z'),
        },
      },
      ...metadata,
    };
    const absence: Absence = {
      id: 'l4',
      monthId: '2026-07',
      employeeId: 'one',
      tetaNumber: 'TETA-one',
      absenceCode: 'L4',
      startDate: '2026-07-08',
      endDate: '2026-07-08',
      hoursPerDay: 8,
      source: 'absence_import',
      importId: 'import',
      status: 'ACTIVE',
      note: null,
      ...metadata,
    };
    const result = analyzeShiftCorrectionImpact({
      proposal,
      openMonthIds: ['2026-07'],
      employees: [employee('one')],
      departments: [department()],
      departmentShiftCorrections: [baseline],
      dailyValues: [value],
      absences: [absence],
    });
    const detail = result.details.find((item) => item.date === '2026-07-08');

    expect(detail).toMatchObject({
      hasManualActual: true,
      hasOvertime: true,
      hasShortageOrPrivateTime: true,
      hasAbsence: true,
      hasConfirmedL4: true,
      requiresReview: true,
    });
    expect(result.manualActualCount).toBe(1);
    expect(result.overtimeCount).toBe(1);
    expect(result.shortageOrPrivateTimeCount).toBe(1);
    expect(result.absenceCount).toBe(1);
    expect(result.confirmedL4Count).toBe(1);
    expect(result.reviewRequiredCount).toBe(1);
  });

  it('reports a calm zero-impact result when no plan changes', () => {
    const result = analyzeShiftCorrectionImpact({
      proposal,
      openMonthIds: ['2026-07'],
      employees: [],
      departments: [department()],
      departmentShiftCorrections: [baseline],
    });

    expect(result.employeeCount).toBe(0);
    expect(result.changedPlanDayCount).toBe(0);
    expect(result.details).toEqual([]);
  });

  it('does not count an unchanged plan and detects interval or duration changes', () => {
    const result = analyzeShiftCorrectionImpact({
      proposal,
      openMonthIds: ['2026-07'],
      employees: [employee('without-group')],
      departments: [department()],
      departmentShiftCorrections: [baseline],
      assignments: [
        {
          id: 'no-group',
          employeeId: 'without-group',
          tetaNumber: 'TETA-without-group',
          departmentId: 'metal',
          shiftAssignment: null,
          validFrom: '2026-01-01',
          validTo: null,
          status: 'ACTIVE',
          note: null,
          ...metadata,
        },
      ],
    });
    expect(result.changedPlanDayCount).toBe(0);

    const day = {
      employeeId: 'one',
      date: '2026-07-08',
      status: 'WORKING' as const,
      source: 'automatic' as const,
      hours: 8,
      shift: 'FIRST' as const,
      label: '1',
      departmentId: 'metal',
      shiftAssignment: 'RED' as const,
      reason: null,
      holidayName: null,
      plannedStartTime: '06:00',
      plannedEndTime: '14:00',
      plannedDuration: 8,
    };
    expect(meaningfulPlanChanged(day, { ...day })).toBe(false);
    expect(
      meaningfulPlanChanged(day, {
        ...day,
        plannedEndTime: '15:00',
        plannedDuration: 9,
      }),
    ).toBe(true);
  });

  it('supports a department mode change from three to two shifts', () => {
    const result = analyzeShiftCorrectionImpact({
      proposal: {
        departmentId: 'metal',
        effectiveDate: '2026-07-06',
        shiftMode: 'TWO_SHIFT',
        groupAssignments: { RED: 'SECOND', WHITE: 'FIRST' },
      },
      openMonthIds: ['2026-07'],
      employees: [employee('one')],
      departments: [department()],
      departmentShiftCorrections: [baseline],
    });

    expect(result.changedPlanDayCount).toBeGreaterThan(0);
    expect(
      result.details.some((detail) => detail.after.shift === 'SECOND'),
    ).toBe(true);
  });
});
