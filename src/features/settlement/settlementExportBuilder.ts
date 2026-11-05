import type {
  DailyValue,
  Department,
  Employee,
  MonthId,
  SettlementReviewState,
} from '../../types/firestore';
import {
  buildSettlementReviewItems,
  calculateMonthNominalHours,
  type EmployeeMonthlyCalculationDraft,
} from '../../utils/payroll';
import { canonicalDepartmentOfficialName } from '../../utils/organization';
import { prepareSettlementExportPackage } from '../../utils/reports';
import type { PlannedScheduleDay } from '../../utils/schedule';
import { compactBrigadeShiftLabel } from './compactBrigadeShiftLabel';
import { monthlyScheduleReportingContext } from '../../utils/reports/monthlyNominalPresentation';
import {
  dailyValueLookupKey,
  resolveSettlementCellValue,
  type CalendarDay,
} from './monthUtils';

export interface SettlementExportBuildInput {
  monthId: MonthId;
  employees: Employee[];
  departments: Department[];
  days: CalendarDay[];
  dailyValues: DailyValue[];
  drafts: EmployeeMonthlyCalculationDraft[];
  reviewStates: SettlementReviewState[];
  publicHolidays: ReadonlySet<string>;
  plannedSchedulesByEmployeeId?: ReadonlyMap<
    string,
    readonly PlannedScheduleDay[]
  >;
  mode?: 'preview' | 'final';
}

export function buildSettlementExportPackageForMonth({
  monthId,
  employees,
  departments,
  days,
  dailyValues,
  drafts,
  reviewStates,
  publicHolidays,
  plannedSchedulesByEmployeeId,
  mode = 'preview',
}: SettlementExportBuildInput) {
  const departmentsById = new Map(
    departments.map((department) => [department.id, department]),
  );
  const dailyValuesByEmployeeAndDate = new Map(
    dailyValues.map((value) => [
      dailyValueLookupKey(value.employeeId, value.date),
      value,
    ]),
  );
  const reviewItems = buildSettlementReviewItems({ drafts, reviewStates });
  const reviewItemsByEmployeeId = new Map(
    reviewItems.map((item) => [item.draft.employeeId, item]),
  );
  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee]),
  );
  const records = drafts.flatMap((draft) => {
    const employee = employeesById.get(draft.employeeId);
    if (!employee) return [];
    const reviewItem = reviewItemsByEmployeeId.get(employee.id);
    const planByDate = new Map(
      plannedSchedulesByEmployeeId
        ?.get(employee.id)
        ?.map((day) => [day.date, day]),
    );
    return [
      {
        monthlyScheduleContext: monthlyScheduleReportingContext(
          plannedSchedulesByEmployeeId?.get(employee.id) ?? [],
        ),
        employee,
        departmentName:
          canonicalDepartmentOfficialName(employee.departmentId) ??
          (employee.departmentId
            ? departmentsById.get(employee.departmentId)?.name
            : null),
        identity: {
          pesel: employee.pesel,
          passport: employee.passportNumber,
          foreignDocument: employee.foreignDocumentNumber,
        },
        draft,
        reviewStatus: reviewItem?.effectiveStatus,
        unresolvedIssueCount: reviewItem?.unresolvedIssueCount ?? 0,
        dailyCells: days.map((day) => {
          const planned = planByDate.get(day.isoDate);
          return {
            dayOfMonth: day.dayOfMonth,
            hours: resolveSettlementCellValue({
              employee,
              day,
              persistedValue: dailyValuesByEmployeeAndDate.get(
                dailyValueLookupKey(employee.id, day.isoDate),
              ),
            }).hours,
            ...(planned?.brigadeScheduled && planned.hours !== null
              ? {
                  planCode: compactBrigadeShiftLabel(planned) ?? planned.label,
                  plannedHours: planned.hours,
                }
              : {}),
          };
        }),
      },
    ];
  });

  return prepareSettlementExportPackage({
    monthId,
    records,
    monthNominalHours: calculateMonthNominalHours(monthId, { publicHolidays }),
    mode,
  });
}
