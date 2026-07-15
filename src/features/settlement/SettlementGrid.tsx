import {
  Box,
  ButtonBase,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  type SxProps,
  type Theme,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type {
  Absence,
  DailyValue,
  Department,
  Employee,
  EmployeeAssignment,
  ScheduleCorrection,
  DepartmentShiftCorrection,
  ShiftHoursVersion,
  IsoDate,
} from '../../types/firestore';
import { resolveGoverningAbsence } from '../../utils/absences';
import {
  resolveAttendanceWarnings,
  type AttendanceWarning,
} from '../../utils/attendance';
import {
  resolveDailyWorkTimeDeviation,
  type DailyWorkTimeDeviation,
} from '../../utils/payroll';
import {
  isDateInRangeSelection,
  type CalendarRangeSelection,
} from './calendarConstructor';
import {
  dailyValueLookupKey,
  resolveSettlementCellValue,
  type CalendarDay,
} from './monthUtils';
import {
  generateEmployeeMonthlySchedule,
  type PlannedScheduleDay,
} from '../../utils/schedule';

interface SettlementGridProps {
  employees: Employee[];
  days: CalendarDay[];
  dailyValues: DailyValue[];
  departments?: Department[];
  employeeAssignments?: EmployeeAssignment[];
  scheduleCorrections?: ScheduleCorrection[];
  departmentShiftCorrections?: DepartmentShiftCorrection[];
  shiftHoursVersions?: ShiftHoursVersion[];
  publicHolidays?: ReadonlySet<IsoDate>;
  publicHolidayNames?: ReadonlyMap<IsoDate, string>;
  absences?: Absence[];
  isSettled?: boolean;
  displayMode?: 'hours' | 'shifts';
  onEditCell?: (
    employee: Employee,
    day: CalendarDay,
    value: ReturnType<typeof resolveSettlementCellValue>,
    hasGoverningAbsence: boolean,
    plannedDay?: PlannedScheduleDay,
  ) => void;
  selection?: CalendarRangeSelection | null;
  onSelectCell?: (
    employee: Employee,
    day: CalendarDay,
    value: ReturnType<typeof resolveSettlementCellValue>,
    hasGoverningAbsence: boolean,
    plannedDay?: PlannedScheduleDay,
  ) => void;
  onOpenEmployeeCalendar?: (employee: Employee) => void;
}

const weekdayFormatter = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'short',
  timeZone: 'UTC',
});

const employeeColumnWidth = 220;
const dayColumnMinWidth = 30;
const detailedHoursColumnMinWidth = 58;

export function SettlementGrid({
  employees,
  days,
  dailyValues,
  departments = [],
  employeeAssignments = [],
  scheduleCorrections = [],
  departmentShiftCorrections = [],
  shiftHoursVersions = [],
  publicHolidays,
  publicHolidayNames,
  absences = [],
  isSettled = false,
  displayMode = 'hours',
  onEditCell,
  selection = null,
  onSelectCell,
  onOpenEmployeeCalendar,
}: SettlementGridProps) {
  const t = useTranslations();
  const departmentsById = new Map(
    departments.map((department) => [department.id, department]),
  );
  const dailyValuesByEmployeeAndDate = new Map(
    dailyValues.map((value) => [
      dailyValueLookupKey(value.employeeId, value.date),
      value,
    ]),
  );
  const absencesByEmployee = new Map<string, Absence[]>();
  absences.forEach((absence) => {
    const employeeAbsences = absencesByEmployee.get(absence.employeeId) ?? [];
    employeeAbsences.push(absence);
    absencesByEmployee.set(absence.employeeId, employeeAbsences);
  });

  return (
    <Card>
      <TableContainer>
        <Table
          size="small"
          sx={{
            minWidth:
              employeeColumnWidth +
              days.length *
                (displayMode === 'hours'
                  ? detailedHoursColumnMinWidth
                  : dayColumnMinWidth),
            tableLayout: 'fixed',
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                sx={leadingCellSx({
                  left: 0,
                  width: employeeColumnWidth,
                  zIndex: 4,
                })}
              >
                {t.settlement.grid.employee}
              </TableCell>
              {days.map((day) => (
                <TableCell
                  key={day.isoDate}
                  align="center"
                  sx={{
                    width: `${100 / Math.max(days.length, 1)}%`,
                    minWidth:
                      displayMode === 'hours'
                        ? detailedHoursColumnMinWidth
                        : dayColumnMinWidth,
                    p: 0.35,
                    ...calendarBackground(day),
                  }}
                >
                  <Typography
                    variant="caption"
                    color={day.isFuture ? 'text.disabled' : 'text.secondary'}
                    sx={{ display: 'block', textTransform: 'capitalize' }}
                  >
                    {weekdayFormatter.format(day.date)}
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    color={day.isFuture ? 'text.disabled' : 'text.primary'}
                  >
                    {day.dayOfMonth}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee) => {
              const plannedScheduleByDate = new Map(
                generateEmployeeMonthlySchedule({
                  employee,
                  days,
                  departments,
                  options: {
                    assignments: employeeAssignments,
                    corrections: scheduleCorrections,
                    departmentShiftCorrections,
                    shiftHoursVersions,
                    publicHolidays,
                    publicHolidayNames,
                  },
                }).map((plannedDay) => [plannedDay.date, plannedDay]),
              );
              const department = employee.departmentId
                ? departmentsById.get(employee.departmentId)
                : null;
              const departmentLabel =
                department?.name ?? t.organization.departments.unassigned;
              const shiftLabel = employee.shiftAssignment
                ? t.organization.shifts[employee.shiftAssignment]
                : t.organization.shifts.unassigned;

              return (
                <TableRow hover key={employee.id}>
                  <TableCell
                    sx={leadingCellSx({
                      left: 0,
                      width: employeeColumnWidth,
                      zIndex: 2,
                    })}
                  >
                    <ButtonBase
                      onClick={() => onOpenEmployeeCalendar?.(employee)}
                      aria-label={interpolate(
                        t.settlement.grid.openEmployeeCalendar,
                        {
                          employee: `${employee.firstName} ${employee.lastName}`,
                        },
                      )}
                      sx={{
                        borderRadius: 1,
                        textAlign: 'left',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          fontWeight: 750,
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                        }}
                      >
                        {employee.firstName} {employee.lastName}
                      </Typography>
                    </ButtonBase>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: 'block' }}
                    >
                      {departmentLabel} · {shiftLabel}
                    </Typography>
                  </TableCell>
                  {days.map((day) => {
                    const persistedValue = dailyValuesByEmployeeAndDate.get(
                      dailyValueLookupKey(employee.id, day.isoDate),
                    );
                    const plannedDay = plannedScheduleByDate.get(day.isoDate);
                    const value = resolveSettlementCellValue({
                      employee,
                      day,
                      persistedValue,
                    });
                    const absenceResolution = resolveGoverningAbsence(
                      absencesByEmployee.get(employee.id) ?? [],
                      day.isoDate,
                    );
                    const absenceLabel =
                      absenceResolution.kind === 'governed'
                        ? absenceResolution.code === 'L4' &&
                          absenceResolution.confirmation === 'reported'
                          ? t.settlement.grid.reportedL4Label
                          : absenceResolution.code
                        : absenceResolution.kind === 'ambiguous'
                          ? absenceResolution.codes.join('/')
                          : null;
                    const hoursLabel =
                      value.hours === null
                        ? t.settlement.grid.empty
                        : interpolate(t.settlement.grid.hours, {
                            hours: value.hours.toLocaleString('pl-PL'),
                          });
                    const displayLabel = cellDisplayLabel({
                      value,
                      plannedDay,
                      hoursLabel,
                      emptyLabel: t.settlement.grid.empty,
                      displayMode,
                    });
                    const workTimeBreakdown = resolveGridWorkTimeBreakdown({
                      value,
                      day,
                      plannedDay,
                    });
                    const hasGoverningAbsence =
                      absenceResolution.kind !== 'none';
                    const warnings = resolveAttendanceWarnings({
                      hasExplicitValue: Boolean(persistedValue),
                      hasActiveAbsence: hasGoverningAbsence,
                      isWorkingDay: day.isWorkingDay,
                      isWithinEmployment:
                        value.calendarState !== 'outside-employment',
                    });
                    const tooltip = buildTooltip({
                      value,
                      plannedDay,
                      absenceResolution,
                      warnings,
                      isSettled,
                      workTimeBreakdown,
                      t,
                    });
                    const canEdit =
                      !isSettled &&
                      value.calendarState !== 'future' &&
                      value.calendarState !== 'outside-employment' &&
                      Boolean(onSelectCell ?? onEditCell);
                    const isSelected = isDateInRangeSelection(
                      selection,
                      employee.id,
                      day.isoDate,
                    );
                    const employeeName = `${employee.lastName} ${employee.firstName}`;
                    const editLabel = interpolate(t.settlement.grid.edit, {
                      employee: employeeName,
                      date: day.isoDate,
                    });

                    return (
                      <TableCell
                        key={day.isoDate}
                        align="center"
                        sx={{
                          width: `${100 / Math.max(days.length, 1)}%`,
                          minWidth:
                            displayMode === 'hours'
                              ? detailedHoursColumnMinWidth
                              : dayColumnMinWidth,
                          px: 0.5,
                          py: 0.75,
                          ...cellBackground(value.calendarState, day),
                          ...(warnings.length > 0
                            ? {
                                boxShadow: (theme) =>
                                  `inset 0 0 0 2px ${theme.palette.warning.main}`,
                              }
                            : {}),
                          ...(isSelected
                            ? {
                                outline: (theme) =>
                                  `3px solid ${theme.palette.primary.main}`,
                                outlineOffset: -3,
                              }
                            : {}),
                        }}
                      >
                        <Tooltip title={tooltip}>
                          <Box component="span" sx={{ display: 'block' }}>
                            <ButtonBase
                              disabled={!canEdit}
                              aria-label={canEdit ? editLabel : undefined}
                              onClick={() =>
                                (onSelectCell ?? onEditCell)?.(
                                  employee,
                                  day,
                                  value,
                                  hasGoverningAbsence,
                                  plannedDay,
                                )
                              }
                              sx={{
                                width: '100%',
                                minHeight: 28,
                                borderRadius: 1,
                                cursor: canEdit ? 'pointer' : 'default',
                                '&.Mui-disabled': { opacity: 1 },
                              }}
                            >
                              <Box
                                component="span"
                                sx={
                                  absenceLabel
                                    ? {
                                        color:
                                          absenceResolution.kind === 'ambiguous'
                                            ? 'warning.main'
                                            : absenceResolution.kind ===
                                                  'governed' &&
                                                absenceResolution.confirmation ===
                                                  'reported'
                                              ? 'warning.dark'
                                              : 'error.main',
                                        fontWeight: 800,
                                      }
                                    : {}
                                }
                              >
                                {absenceLabel ? (
                                  <>
                                    <Box
                                      component="span"
                                      sx={{ display: 'block', lineHeight: 1.1 }}
                                    >
                                      {absenceLabel}
                                    </Box>
                                    {persistedValue ? (
                                      <Box
                                        component="span"
                                        sx={{
                                          display: 'block',
                                          color: 'warning.dark',
                                          fontSize: '0.65rem',
                                          lineHeight: 1.1,
                                        }}
                                      >
                                        {hoursLabel}
                                      </Box>
                                    ) : null}
                                  </>
                                ) : (
                                  <CellHoursContent
                                    displayLabel={displayLabel}
                                    displayMode={displayMode}
                                    valueKind={value.kind}
                                    workTimeBreakdown={workTimeBreakdown}
                                    t={t}
                                  />
                                )}
                              </Box>
                            </ButtonBase>
                          </Box>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

function leadingCellSx({
  left,
  width,
  zIndex,
}: {
  left: number;
  width: number;
  zIndex: number;
}): SxProps<Theme> {
  return {
    position: 'sticky',
    left,
    width,
    minWidth: width,
    maxWidth: width,
    zIndex,
    bgcolor: 'background.paper',
    borderRight: 1,
    borderRightColor: 'divider',
  };
}

function cellBackground(
  state: ReturnType<typeof resolveSettlementCellValue>['calendarState'],
  day: CalendarDay,
): SxProps<Theme> {
  if (state === 'outside-employment') {
    return { bgcolor: 'action.disabledBackground', color: 'text.disabled' };
  }
  if (state === 'future') {
    return { bgcolor: 'action.disabledBackground', color: 'text.disabled' };
  }
  return calendarBackground(day);
}

function calendarBackground(day: CalendarDay): SxProps<Theme> {
  if (day.isFuture) {
    return { bgcolor: 'action.disabledBackground', color: 'text.disabled' };
  }
  if (day.isHoliday) {
    return {
      bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
    };
  }
  if (day.isWeekend) {
    return { bgcolor: 'action.hover' };
  }
  return { bgcolor: 'background.paper' };
}

function cellValueSx(
  kind: ReturnType<typeof resolveSettlementCellValue>['kind'],
): SxProps<Theme> {
  if (kind === 'virtual-default') {
    return { color: 'text.secondary', fontStyle: 'italic' };
  }
  if (kind === 'manual') {
    return {
      color: 'primary.main',
      fontWeight: 750,
      textDecoration: 'underline',
      textDecorationThickness: '2px',
      textUnderlineOffset: '3px',
    };
  }
  if (kind === 'imported') {
    return { color: 'secondary.main', fontWeight: 700 };
  }
  if (kind === 'imported-override') {
    return {
      color: 'warning.dark',
      fontWeight: 800,
      textDecoration: 'underline',
      textDecorationThickness: '2px',
      textUnderlineOffset: '3px',
    };
  }
  return { color: 'text.disabled' };
}

function cellDisplayLabel({
  value,
  plannedDay,
  hoursLabel,
  emptyLabel,
  displayMode,
}: {
  value: ReturnType<typeof resolveSettlementCellValue>;
  plannedDay?: PlannedScheduleDay;
  hoursLabel: string;
  emptyLabel: string;
  displayMode: 'hours' | 'shifts';
}): string {
  if (displayMode === 'hours') {
    return hoursLabel;
  }

  return plannedDay?.label ?? (value.hours === null ? emptyLabel : hoursLabel);
}

function resolveGridWorkTimeBreakdown({
  value,
  day,
  plannedDay,
}: {
  value: ReturnType<typeof resolveSettlementCellValue>;
  day: CalendarDay;
  plannedDay?: PlannedScheduleDay;
}): DailyWorkTimeDeviation | null {
  const correction = value.workTimeCorrection;
  if (!correction) return null;

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
    isWorkingDay:
      plannedDay?.status === 'WORKING' ||
      plannedDay?.status === 'BHP' ||
      day.isWorkingDay,
    isSaturday: day.date.getUTCDay() === 6,
    isSunday: day.date.getUTCDay() === 0,
    isPublicHoliday: day.isHoliday,
    classificationOverride: correction.classificationOverride,
  });
}

function CellHoursContent({
  displayLabel,
  displayMode,
  valueKind,
  workTimeBreakdown,
  t,
}: {
  displayLabel: string;
  displayMode: 'hours' | 'shifts';
  valueKind: ReturnType<typeof resolveSettlementCellValue>['kind'];
  workTimeBreakdown: DailyWorkTimeDeviation | null;
  t: ReturnType<typeof useTranslations>;
}) {
  const showBreakdown =
    displayMode === 'hours' &&
    workTimeBreakdown &&
    (workTimeBreakdown.overtime50Hours > 0 ||
      workTimeBreakdown.overtime100Hours > 0 ||
      workTimeBreakdown.nightAllowanceHours > 0);

  return (
    <Box
      component="span"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.3,
        py: showBreakdown ? 0.25 : 0,
      }}
    >
      <Box component="span" sx={cellValueSx(valueKind)}>
        {displayLabel}
      </Box>
      {showBreakdown ? (
        <Box
          component="span"
          sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}
        >
          {workTimeBreakdown.overtime50Hours > 0 ? (
            <WorkTimeBadge
              tone="warning"
              label={interpolate(t.settlement.grid.workTime.overtime50, {
                hours: formatCompactHours(workTimeBreakdown.overtime50Hours),
              })}
            />
          ) : null}
          {workTimeBreakdown.overtime100Hours > 0 ? (
            <WorkTimeBadge
              tone="error"
              label={interpolate(t.settlement.grid.workTime.overtime100, {
                hours: formatCompactHours(workTimeBreakdown.overtime100Hours),
              })}
            />
          ) : null}
          {workTimeBreakdown.nightAllowanceHours > 0 ? (
            <WorkTimeBadge
              tone="info"
              label={interpolate(t.settlement.grid.workTime.night, {
                hours: formatCompactHours(
                  workTimeBreakdown.nightAllowanceHours,
                ),
              })}
            />
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

function WorkTimeBadge({
  tone,
  label,
}: {
  tone: 'warning' | 'error' | 'info';
  label: string;
}) {
  return (
    <Box
      component="span"
      sx={{
        display: 'block',
        minWidth: 46,
        borderRadius: 0.75,
        border: 1,
        borderColor: `${tone}.main`,
        bgcolor: (theme) => alpha(theme.palette[tone].main, 0.08),
        color: `${tone}.dark`,
        fontSize: '0.56rem',
        fontWeight: 800,
        lineHeight: 1.2,
        letterSpacing: 0.1,
        px: 0.35,
        py: 0.15,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  );
}

function formatCompactHours(hours: number): string {
  return hours.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
}

function buildTooltip({
  value,
  plannedDay,
  absenceResolution,
  warnings,
  isSettled,
  workTimeBreakdown,
  t,
}: {
  value: ReturnType<typeof resolveSettlementCellValue>;
  plannedDay?: PlannedScheduleDay;
  absenceResolution: ReturnType<typeof resolveGoverningAbsence>;
  warnings: AttendanceWarning[];
  isSettled: boolean;
  workTimeBreakdown: DailyWorkTimeDeviation | null;
  t: ReturnType<typeof useTranslations>;
}): string {
  const parts: string[] = [];

  if (absenceResolution.kind === 'ambiguous') {
    parts.push(t.settlement.grid.absenceAmbiguous);
  } else if (absenceResolution.kind === 'governed') {
    parts.push(
      absenceResolution.code === 'L4' &&
        absenceResolution.confirmation === 'reported'
        ? t.settlement.grid.reportedL4Tooltip
        : interpolate(t.settlement.grid.absence, {
            code: absenceResolution.code,
          }),
    );
  }

  warnings.forEach((warning) => {
    parts.push(t.settlement.grid.warnings[warning]);
  });

  if (value.kind === 'imported-override') {
    parts.push(
      interpolate(t.settlement.grid.importedOverride, {
        original: (value.fallbackHours ?? 0).toLocaleString('pl-PL'),
      }),
    );
  } else if (value.kind === 'imported') {
    parts.push(t.settlement.grid.importedValue);
  } else if (value.kind === 'manual') {
    parts.push(t.settlement.grid.manualValue);
  }

  if (workTimeBreakdown) {
    parts.push(
      interpolate(t.settlement.grid.workTime.tooltip, {
        normal: formatCompactHours(workTimeBreakdown.normalWorkHours),
        overtime50: formatCompactHours(workTimeBreakdown.overtime50Hours),
        overtime100: formatCompactHours(workTimeBreakdown.overtime100Hours),
        night: formatCompactHours(workTimeBreakdown.nightAllowanceHours),
      }),
    );
  }

  if (plannedDay) {
    if (plannedDay.status === 'UNRESOLVED') {
      parts.push(t.settlement.grid.scheduleUnresolved);
    } else if (plannedDay.source === 'manual-correction') {
      parts.push(t.settlement.grid.scheduleManualCorrection);
    } else if (plannedDay.status === 'BHP') {
      parts.push(t.settlement.grid.scheduleBhp);
    } else if (plannedDay.status === 'PUBLIC_HOLIDAY') {
      parts.push(
        plannedDay.holidayName
          ? interpolate(t.settlement.grid.publicHolidayName, {
              holiday: plannedDay.holidayName,
            })
          : t.settlement.grid.publicHoliday,
      );
    } else if (plannedDay.status === 'WORKING') {
      parts.push(t.settlement.grid.scheduleAutomatic);
    }
  }

  if (value.workTimeCorrection) {
    parts.push(
      interpolate(t.settlement.employeeCalendar.actualInterval, {
        start: value.workTimeCorrection.actualStartTime,
        end: value.workTimeCorrection.actualEndTime,
      }),
    );
  }

  if (isSettled) {
    parts.push(t.settlement.grid.settledMonth);
  } else if (value.calendarState === 'future') {
    parts.push(t.settlement.grid.futureDay);
  } else if (value.calendarState === 'outside-employment') {
    parts.push(t.settlement.grid.outsideEmployment);
  } else if (
    value.kind === 'virtual-default' &&
    value.calendarState === 'non-working'
  ) {
    parts.push(t.settlement.grid.nonWorkingDay);
  } else if (value.kind === 'virtual-default') {
    parts.push(t.settlement.grid.virtualDefault);
  }

  return parts.join(' ');
}
