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
  type SxProps,
  type Theme,
} from '@mui/material';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import BuildOutlined from '@mui/icons-material/BuildOutlined';
import CheckroomOutlined from '@mui/icons-material/CheckroomOutlined';
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import LayersOutlined from '@mui/icons-material/LayersOutlined';
import PrecisionManufacturingOutlined from '@mui/icons-material/PrecisionManufacturingOutlined';
import ViewStreamOutlined from '@mui/icons-material/ViewStreamOutlined';
import { Fragment, useState, type ReactNode } from 'react';

import { useTranslations } from '../../hooks/useTranslations';
import { useCalendarAppearance } from '../../hooks/useCalendarAppearance';
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
import {
  appearanceKeyForAbsence,
  appearanceKeyForPlannedDay,
  type CalendarAppearanceKey,
  type CalendarAppearancePalette,
} from '../../utils/calendarAppearance';
import { buildCalendarEmployeeRows } from './settlementCalendarLayout';

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

const employeeColumnWidth = 196;
const dayColumnMinWidth = 34;
const detailedHoursColumnMinWidth = 46;

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
  const { palette } = useCalendarAppearance();
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
  const employeeRows = buildCalendarEmployeeRows({
    employees,
    departments,
    assignments: employeeAssignments,
    referenceDate: days[0]?.isoDate ?? ('1970-01-01' as IsoDate),
    unassignedLabel: t.settlement.grid.unassignedDepartment,
  });
  const [collapsedDepartments, setCollapsedDepartments] = useState<
    ReadonlySet<string>
  >(new Set());
  const departmentCounts = employeeRows.reduce((counts, row) => {
    const key = departmentGroupKey(row.departmentId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  const toggleDepartment = (departmentId: string | null) => {
    const key = departmentGroupKey(departmentId);
    setCollapsedDepartments((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card sx={{ overflow: 'visible' }}>
      <TableContainer
        data-testid="settlement-calendar-scroll"
        sx={{ maxHeight: 'calc(100vh - 92px)', overflow: 'auto' }}
      >
        <Table
          stickyHeader
          size="small"
          sx={{
            width: '100%',
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
                  zIndex: 7,
                })}
              >
                {t.settlement.grid.employee}
              </TableCell>
              {days.map((day) => (
                <TableCell
                  key={day.isoDate}
                  align="center"
                  sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 5,
                    width:
                      displayMode === 'hours'
                        ? detailedHoursColumnMinWidth
                        : dayColumnMinWidth,
                    minWidth:
                      displayMode === 'hours'
                        ? detailedHoursColumnMinWidth
                        : dayColumnMinWidth,
                    p: 0.35,
                    ...calendarBackground(day, palette),
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: 'inherit',
                      opacity: day.isFuture ? 0.7 : 0.82,
                      textTransform: 'capitalize',
                    }}
                  >
                    {weekdayFormatter.format(day.date)}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ color: 'inherit' }}>
                    {day.dayOfMonth}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {employeeRows.map((row) => {
              const { employee } = row;
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
              const department = row.departmentId
                ? departmentsById.get(row.departmentId)
                : null;
              const departmentLabel = department?.name ?? row.departmentLabel;
              const shiftLabel = employee.shiftAssignment
                ? t.organization.shifts[employee.shiftAssignment]
                : t.organization.shifts.unassigned;
              const groupKey = departmentGroupKey(row.departmentId);
              const isDepartmentCollapsed = collapsedDepartments.has(groupKey);

              return (
                <Fragment key={employee.id}>
                  {row.isFirstInDepartment ? (
                    <DepartmentGroupRow
                      departmentId={row.departmentId}
                      label={departmentLabel}
                      count={departmentCounts.get(groupKey) ?? 0}
                      isCollapsed={isDepartmentCollapsed}
                      columnCount={days.length + 1}
                      collapseLabel={interpolate(
                        t.settlement.grid.collapseDepartment,
                        { department: departmentLabel },
                      )}
                      expandLabel={interpolate(
                        t.settlement.grid.expandDepartment,
                        { department: departmentLabel },
                      )}
                      onToggle={() => toggleDepartment(row.departmentId)}
                    />
                  ) : null}
                  {isDepartmentCollapsed ? null : (
                    <TableRow hover>
                      <TableCell
                        sx={{
                          ...leadingCellSx({
                            left: 0,
                            width: employeeColumnWidth,
                            zIndex: 3,
                          }),
                          pl: 2,
                        }}
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
                          {shiftLabel}
                        </Typography>
                      </TableCell>
                      {days.map((day) => {
                        const persistedValue = dailyValuesByEmployeeAndDate.get(
                          dailyValueLookupKey(employee.id, day.isoDate),
                        );
                        const plannedDay = plannedScheduleByDate.get(
                          day.isoDate,
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
                            ? absenceResolution.code === 'L4' &&
                              absenceResolution.confirmation === 'reported'
                              ? t.settlement.grid.reportedL4Label
                              : absenceResolution.code
                            : absenceResolution.kind === 'ambiguous'
                              ? absenceResolution.codes.join('/')
                              : null;
                        const appearanceKey =
                          absenceResolution.kind === 'governed'
                            ? appearanceKeyForAbsence(
                                absenceResolution.code,
                                absenceResolution.confirmation,
                              )
                            : appearanceKeyForPlannedDay(plannedDay);
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
                              width:
                                displayMode === 'hours'
                                  ? detailedHoursColumnMinWidth
                                  : dayColumnMinWidth,
                              minWidth:
                                displayMode === 'hours'
                                  ? detailedHoursColumnMinWidth
                                  : dayColumnMinWidth,
                              px: 0.2,
                              py: 0.35,
                              ...cellBackground(
                                value.calendarState,
                                day,
                                palette,
                                appearanceKey,
                                Boolean(absenceLabel),
                              ),
                              ...(warnings.length > 0
                                ? {
                                    boxShadow: `inset 0 0 0 2px ${palette.warning.text}`,
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
                                              absenceResolution.kind ===
                                              'ambiguous'
                                                ? palette.warning.text
                                                : palette[appearanceKey].text,
                                            fontWeight: 800,
                                          }
                                        : {}
                                    }
                                  >
                                    {absenceLabel ? (
                                      <>
                                        <Box
                                          component="span"
                                          sx={{
                                            display: 'block',
                                            lineHeight: 1.1,
                                          }}
                                        >
                                          {absenceLabel}
                                        </Box>
                                        {persistedValue ? (
                                          <Box
                                            component="span"
                                            sx={{
                                              display: 'block',
                                              color: palette.warning.text,
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
                                        appearanceKey={appearanceKey}
                                        palette={palette}
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
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

function DepartmentGroupRow({
  departmentId,
  label,
  count,
  isCollapsed,
  columnCount,
  collapseLabel,
  expandLabel,
  onToggle,
}: {
  departmentId: string | null;
  label: string;
  count: number;
  isCollapsed: boolean;
  columnCount: number;
  collapseLabel: string;
  expandLabel: string;
  onToggle: () => void;
}) {
  const groupKey = departmentGroupKey(departmentId);
  return (
    <TableRow
      data-testid={`settlement-department-group-${groupKey}`}
      sx={{ bgcolor: '#fffafb' }}
    >
      <TableCell
        colSpan={columnCount}
        sx={{
          p: 0,
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <ButtonBase
          data-testid={`settlement-department-toggle-${groupKey}`}
          aria-label={isCollapsed ? expandLabel : collapseLabel}
          aria-expanded={!isCollapsed}
          onClick={onToggle}
          sx={{
            position: 'sticky',
            left: 0,
            width: 'calc(100vw - 120px)',
            maxWidth: '100%',
            minHeight: 54,
            px: 2,
            display: 'flex',
            justifyContent: 'flex-start',
            textAlign: 'left',
            '&:hover': { bgcolor: 'rgba(210, 16, 30, 0.045)' },
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: '0 0 auto',
              '& svg': { fontSize: 19 },
            }}
          >
            {departmentIcon(departmentId, label)}
          </Box>
          <Typography
            variant="subtitle2"
            color="primary"
            sx={{
              ml: 1.25,
              fontWeight: 800,
              letterSpacing: '0.045em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </Typography>
          <Box
            component="span"
            sx={{
              ml: 1,
              minWidth: 26,
              height: 24,
              px: 0.75,
              borderRadius: 1.25,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.78rem',
              fontWeight: 750,
            }}
          >
            {count}
          </Box>
          <Box
            component="span"
            sx={{
              ml: 'auto',
              display: 'inline-flex',
              color: 'text.primary',
            }}
          >
            {isCollapsed ? <KeyboardArrowDown /> : <KeyboardArrowUp />}
          </Box>
        </ButtonBase>
      </TableCell>
    </TableRow>
  );
}

function departmentGroupKey(departmentId: string | null): string {
  return departmentId ?? 'unassigned';
}

function departmentIcon(
  departmentId: string | null,
  departmentLabel: string,
): ReactNode {
  const key = `${departmentId ?? ''} ${departmentLabel}`.toLocaleLowerCase(
    'pl-PL',
  );
  if (key.includes('szwal')) return <CheckroomOutlined />;
  if (key.includes('monta')) return <BuildOutlined />;
  if (key.includes('metal')) return <PrecisionManufacturingOutlined />;
  if (key.includes('magaz')) return <Inventory2Outlined />;
  if (key.includes('headliner')) return <ViewStreamOutlined />;
  if (key.includes('pu')) return <LayersOutlined />;
  return <HelpOutlineOutlined />;
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
    top: zIndex >= 7 ? 0 : undefined,
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
  palette: CalendarAppearancePalette,
  appearanceKey: CalendarAppearanceKey,
  hasAbsence: boolean,
): SxProps<Theme> {
  if (state === 'outside-employment') {
    return {
      bgcolor: palette.outsideEmployment.background,
      color: palette.outsideEmployment.text,
    };
  }
  if (state === 'future') {
    return { bgcolor: palette.future.background, color: palette.future.text };
  }
  if (hasAbsence) {
    return {
      bgcolor: palette[appearanceKey].background,
      color: palette[appearanceKey].text,
    };
  }
  if (appearanceKey === 'dayOff') {
    return {
      bgcolor: palette.dayOff.background,
      color: palette.dayOff.text,
    };
  }
  return calendarBackground(day, palette);
}

function calendarBackground(
  day: CalendarDay,
  palette: CalendarAppearancePalette,
): SxProps<Theme> {
  if (day.isFuture) {
    return { bgcolor: palette.future.background, color: palette.future.text };
  }
  if (day.isHoliday) {
    return {
      bgcolor: palette.publicHoliday.background,
      color: palette.publicHoliday.text,
    };
  }
  if (day.isWeekend) {
    return {
      bgcolor: palette.weekend.background,
      color: palette.weekend.text,
    };
  }
  return { bgcolor: palette.worked.background, color: palette.worked.text };
}

function cellValueSx(
  kind: ReturnType<typeof resolveSettlementCellValue>['kind'],
  appearanceKey: CalendarAppearanceKey,
  palette: CalendarAppearancePalette,
): SxProps<Theme> {
  if (kind === 'virtual-default') {
    return { color: palette[appearanceKey].text, fontStyle: 'italic' };
  }
  if (kind === 'manual') {
    return {
      color: palette.manualCorrection.text,
      fontWeight: 750,
      textDecoration: 'underline',
      textDecorationThickness: '2px',
      textUnderlineOffset: '3px',
    };
  }
  if (kind === 'imported') {
    return { color: palette[appearanceKey].text, fontWeight: 700 };
  }
  if (kind === 'imported-override') {
    return {
      color: palette.manualCorrection.text,
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
  appearanceKey,
  palette,
  t,
}: {
  displayLabel: string;
  displayMode: 'hours' | 'shifts';
  valueKind: ReturnType<typeof resolveSettlementCellValue>['kind'];
  workTimeBreakdown: DailyWorkTimeDeviation | null;
  appearanceKey: CalendarAppearanceKey;
  palette: CalendarAppearancePalette;
  t: ReturnType<typeof useTranslations>;
}) {
  const overtime = workTimeBreakdown
    ? resolveOvertimePresentation(workTimeBreakdown)
    : null;
  const showBreakdown =
    displayMode === 'hours' &&
    overtime &&
    (overtime.dayHours > 0 || overtime.nightHours > 0);

  return (
    <Box
      component="span"
      sx={{
        display: 'grid',
        gridTemplateRows: '1.1rem 0.85rem',
        alignItems: 'center',
        justifyItems: 'center',
        width: '100%',
        minHeight: 31,
      }}
    >
      <Box
        component="span"
        sx={
          showBreakdown
            ? { color: palette[appearanceKey].text, fontStyle: 'italic' }
            : cellValueSx(valueKind, appearanceKey, palette)
        }
      >
        {displayLabel}
      </Box>
      {showBreakdown ? (
        <Box
          component="span"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.7,
            whiteSpace: 'nowrap',
          }}
        >
          {overtime.dayHours > 0 ? (
            <OvertimeIndicator
              kind="day"
              hours={overtime.dayHours}
              label={interpolate(t.settlement.grid.workTime.dayAriaLabel, {
                hours: formatCompactHours(overtime.dayHours),
              })}
              palette={palette}
            />
          ) : null}
          {overtime.nightHours > 0 ? (
            <OvertimeIndicator
              kind="night"
              hours={overtime.nightHours}
              label={interpolate(t.settlement.grid.workTime.nightAriaLabel, {
                hours: formatCompactHours(overtime.nightHours),
              })}
              palette={palette}
            />
          ) : null}
        </Box>
      ) : (
        <Box component="span" aria-hidden="true" />
      )}
    </Box>
  );
}

function OvertimeIndicator({
  kind,
  hours,
  label,
  palette,
}: {
  kind: 'day' | 'night';
  hours: number;
  label: string;
  palette: CalendarAppearancePalette;
}) {
  const Icon = kind === 'day' ? WbSunnyRoundedIcon : DarkModeRoundedIcon;

  return (
    <Box
      component="span"
      aria-label={label}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.15,
        color:
          kind === 'day' ? palette.overtime50.text : palette.nightHours.text,
      }}
    >
      <Icon sx={{ fontSize: 12 }} />
      <Box
        component="span"
        sx={{ fontSize: '0.63rem', fontWeight: 750, lineHeight: 1 }}
      >
        +{formatCompactHours(hours)}h
      </Box>
    </Box>
  );
}

function resolveOvertimePresentation(breakdown: DailyWorkTimeDeviation): {
  dayHours: number;
  nightHours: number;
} {
  const nightHours = Math.min(
    breakdown.extraHours,
    breakdown.nightOvertimeHours,
  );
  return {
    dayHours: Math.max(0, breakdown.extraHours - nightHours),
    nightHours,
  };
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
    const overtime = resolveOvertimePresentation(workTimeBreakdown);
    parts.push(
      interpolate(t.settlement.grid.workTime.tooltip, {
        normal: formatCompactHours(workTimeBreakdown.normalWorkHours),
        day: formatCompactHours(overtime.dayHours),
        night: formatCompactHours(overtime.nightHours),
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
