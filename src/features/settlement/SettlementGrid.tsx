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
} from '../../types/firestore';
import { resolveGoverningAbsence } from '../../utils/absences';
import {
  resolveAttendanceWarnings,
  type AttendanceWarning,
} from '../../utils/attendance';
import {
  isDateInRangeSelection,
  type CalendarRangeSelection,
} from './calendarConstructor';
import {
  dailyValueLookupKey,
  resolveSettlementCellValue,
  type CalendarDay,
} from './monthUtils';

interface SettlementGridProps {
  employees: Employee[];
  days: CalendarDay[];
  dailyValues: DailyValue[];
  departments?: Department[];
  absences?: Absence[];
  isSettled?: boolean;
  onEditCell?: (
    employee: Employee,
    day: CalendarDay,
    value: ReturnType<typeof resolveSettlementCellValue>,
    hasGoverningAbsence: boolean,
  ) => void;
  selection?: CalendarRangeSelection | null;
  onSelectCell?: (
    employee: Employee,
    day: CalendarDay,
    value: ReturnType<typeof resolveSettlementCellValue>,
    hasGoverningAbsence: boolean,
  ) => void;
}

const weekdayFormatter = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'short',
  timeZone: 'UTC',
});

const employeeColumnWidth = 220;
const dayColumnMinWidth = 30;

export function SettlementGrid({
  employees,
  days,
  dailyValues,
  departments = [],
  absences = [],
  isSettled = false,
  onEditCell,
  selection = null,
  onSelectCell,
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
            minWidth: employeeColumnWidth + days.length * dayColumnMinWidth,
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
                    minWidth: dayColumnMinWidth,
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
                    <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                      {employee.firstName} {employee.lastName}
                    </Typography>
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
                        ? absenceResolution.code
                        : absenceResolution.kind === 'ambiguous'
                          ? absenceResolution.codes.join('/')
                          : null;
                    const hoursLabel =
                      value.hours === null
                        ? t.settlement.grid.empty
                        : interpolate(t.settlement.grid.hours, {
                            hours: value.hours.toLocaleString('pl-PL'),
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
                      absenceResolution,
                      warnings,
                      isSettled,
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
                          minWidth: dayColumnMinWidth,
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
                                            : 'error.main',
                                        fontWeight: 800,
                                      }
                                    : cellValueSx(value.kind)
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
                                  hoursLabel
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

function buildTooltip({
  value,
  absenceResolution,
  warnings,
  isSettled,
  t,
}: {
  value: ReturnType<typeof resolveSettlementCellValue>;
  absenceResolution: ReturnType<typeof resolveGoverningAbsence>;
  warnings: AttendanceWarning[];
  isSettled: boolean;
  t: ReturnType<typeof useTranslations>;
}): string {
  const parts: string[] = [];

  if (absenceResolution.kind === 'ambiguous') {
    parts.push(t.settlement.grid.absenceAmbiguous);
  } else if (absenceResolution.kind === 'governed') {
    parts.push(
      interpolate(t.settlement.grid.absence, {
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
