import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tooltip,
  Typography,
  alpha,
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
import { resolveAttendanceWarnings } from '../../utils/attendance';
import {
  intervalHours,
  resolveDailyWorkTimeDeviation,
} from '../../utils/payroll';
import {
  isDayWithinEmployment,
  resolveSettlementCellValue,
  type CalendarDay,
  type SettlementCellValue,
} from './monthUtils';

interface EmployeeCalendarDialogProps {
  employee: Employee;
  monthLabel: string;
  days: CalendarDay[];
  dailyValues: DailyValue[];
  absences: Absence[];
  departments: Department[];
  isSettled: boolean;
  onClose: () => void;
  onEditDay: (
    day: CalendarDay,
    value: SettlementCellValue,
    hasGoverningAbsence: boolean,
    plannedDay?: import('../../utils/schedule').PlannedScheduleDay,
  ) => void;
  plannedSchedule?: import('../../utils/schedule').PlannedScheduleDay[];
}

const weekdayLabels = ['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.'];
const formatter = new Intl.DateTimeFormat('pl-PL', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'UTC',
});

export function EmployeeCalendarDialog({
  employee,
  monthLabel,
  days,
  dailyValues,
  absences,
  departments,
  isSettled,
  onClose,
  onEditDay,
  plannedSchedule = [],
}: EmployeeCalendarDialogProps) {
  const t = useTranslations();
  const dailyValuesByDate = new Map(
    dailyValues
      .filter((value) => value.employeeId === employee.id)
      .map((value) => [value.date, value]),
  );
  const plannedScheduleByDate = new Map(
    plannedSchedule.map((day) => [day.date, day]),
  );
  const employeeAbsences = absences.filter(
    (absence) => absence.employeeId === employee.id,
  );
  const leadingEmptyDays =
    days.length > 0 ? (days[0]!.date.getUTCDay() + 6) % 7 : 0;
  const cells = [
    ...Array.from({ length: leadingEmptyDays }, (_, index) => ({
      kind: 'empty' as const,
      id: `empty-${index}`,
    })),
    ...days.map((day) => ({ kind: 'day' as const, day, id: day.isoDate })),
  ];
  const employeeName = `${employee.lastName} ${employee.firstName}`;
  const departmentsById = new Map(
    departments.map((department) => [department.id, department]),
  );
  const departmentLabel = employee.departmentId
    ? (departmentsById.get(employee.departmentId)?.name ??
      employee.departmentId)
    : t.organization.departments.unassigned;
  const shiftLabel = employee.shiftAssignment
    ? t.organization.shifts[employee.shiftAssignment]
    : t.organization.shifts.unassigned;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CalendarMonthOutlined color="primary" />
          <span>{t.settlement.employeeCalendar.title}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ flexWrap: 'wrap' }}
          >
            <Chip label={employeeName} />
            <Chip
              variant="outlined"
              label={interpolate(t.settlement.employeeCalendar.teta, {
                teta: employee.tetaNumber,
              })}
            />
            <Chip variant="outlined" label={monthLabel} />
            <Chip
              variant="outlined"
              label={interpolate(t.settlement.employeeCalendar.employment, {
                start: employee.employmentStartDate
                  ? formatter.format(employee.employmentStartDate)
                  : t.settlement.employeeCalendar.noStartDate,
                end: employee.employmentEndDate
                  ? formatter.format(employee.employmentEndDate)
                  : t.settlement.employeeCalendar.noEndDate,
              })}
            />
            <Chip
              variant="outlined"
              label={interpolate(
                t.settlement.employeeCalendar.departmentAndShift,
                {
                  department: departmentLabel,
                  shift: shiftLabel,
                },
              )}
            />
          </Stack>

          {isSettled ? (
            <Typography color="text.secondary">
              {t.settlement.employeeCalendar.settledReadOnly}
            </Typography>
          ) : (
            <Typography color="text.secondary">
              {t.settlement.employeeCalendar.helper}
            </Typography>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(92px, 1fr))',
              gap: 1,
            }}
          >
            {weekdayLabels.map((label) => (
              <Typography
                key={label}
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 800, textAlign: 'center' }}
              >
                {label}
              </Typography>
            ))}
            {cells.map((cell) => {
              if (cell.kind === 'empty') {
                return <Box key={cell.id} />;
              }
              const persistedValue = dailyValuesByDate.get(cell.day.isoDate);
              const plannedDay = plannedScheduleByDate.get(cell.day.isoDate);
              const value = resolveSettlementCellValue({
                employee,
                day: cell.day,
                persistedValue,
              });
              const absenceResolution = resolveGoverningAbsence(
                employeeAbsences,
                cell.day.isoDate,
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
              const warnings = resolveAttendanceWarnings({
                hasExplicitValue: Boolean(persistedValue),
                hasActiveAbsence: absenceResolution.kind !== 'none',
                isWorkingDay: cell.day.isWorkingDay,
                isWithinEmployment: isDayWithinEmployment(employee, cell.day),
              });
              const canEdit =
                !isSettled &&
                !cell.day.isFuture &&
                value.calendarState !== 'outside-employment';
              const hoursLabel =
                value.hours === null
                  ? t.settlement.grid.empty
                  : interpolate(t.settlement.grid.hours, {
                      hours: value.hours.toLocaleString('pl-PL'),
                    });
              const workTimeBreakdown = value.workTimeCorrection
                ? resolveDailyWorkTimeDeviation({
                    planned: {
                      shift: value.workTimeCorrection.plannedShift,
                      startTime: value.workTimeCorrection.plannedStartTime,
                      endTime: value.workTimeCorrection.plannedEndTime,
                    },
                    actual: {
                      startTime: value.workTimeCorrection.actualStartTime,
                      endTime: value.workTimeCorrection.actualEndTime,
                    },
                    isWorkingDay:
                      plannedDay?.status === 'WORKING' ||
                      plannedDay?.status === 'BHP',
                    isSaturday: cell.day.date.getUTCDay() === 6,
                    isSunday: cell.day.date.getUTCDay() === 0,
                    isPublicHoliday: cell.day.isHoliday,
                  })
                : null;

              return (
                <Tooltip
                  key={cell.id}
                  title={
                    warnings.length > 0
                      ? warnings
                          .map((warning) => t.settlement.grid.warnings[warning])
                          .join(' ')
                      : ''
                  }
                >
                  <Box component="span">
                    <ButtonBase
                      disabled={!canEdit}
                      onClick={() =>
                        onEditDay(
                          cell.day,
                          value,
                          absenceResolution.kind !== 'none',
                          plannedDay,
                        )
                      }
                      sx={{
                        display: 'block',
                        width: '100%',
                        minHeight: 94,
                        p: 1,
                        textAlign: 'left',
                        border: 1,
                        borderColor:
                          warnings.length > 0 ? 'warning.main' : 'divider',
                        borderRadius: 2,
                        bgcolor: (theme) =>
                          cell.day.isHoliday
                            ? alpha(theme.palette.error.main, 0.08)
                            : cell.day.isWeekend
                              ? theme.palette.action.hover
                              : theme.palette.background.paper,
                        opacity:
                          value.calendarState === 'outside-employment' ||
                          cell.day.isFuture
                            ? 0.55
                            : 1,
                        '&.Mui-disabled': { opacity: 0.7 },
                      }}
                    >
                      <Stack spacing={0.75}>
                        <Typography variant="subtitle2">
                          {cell.day.dayOfMonth}
                        </Typography>
                        {absenceLabel ? (
                          <Typography
                            variant="body2"
                            color={
                              absenceResolution.kind === 'governed' &&
                              absenceResolution.confirmation === 'reported'
                                ? 'warning.dark'
                                : 'error.main'
                            }
                            sx={{ fontWeight: 800 }}
                          >
                            {absenceLabel}
                          </Typography>
                        ) : null}
                        {plannedDay?.plannedStartTime &&
                        plannedDay.plannedEndTime &&
                        plannedDay.plannedDuration !== null ? (
                          <Typography variant="caption" color="text.secondary">
                            {interpolate(
                              t.settlement.editor.workTime.planDetails,
                              {
                                start: plannedDay.plannedStartTime,
                                end: plannedDay.plannedEndTime,
                                hours:
                                  plannedDay.plannedDuration.toLocaleString(
                                    'pl-PL',
                                  ),
                              },
                            )}
                          </Typography>
                        ) : null}
                        <Typography
                          variant="body2"
                          color={
                            value.kind === 'manual' ||
                            value.kind === 'imported-override'
                              ? 'primary.main'
                              : 'text.secondary'
                          }
                          sx={{
                            fontWeight:
                              value.kind === 'manual' ||
                              value.kind === 'imported-override'
                                ? 800
                                : 500,
                          }}
                        >
                          {hoursLabel}
                        </Typography>
                        {value.workTimeCorrection ? (
                          <Typography variant="caption" color="primary.main">
                            {interpolate(
                              t.settlement.employeeCalendar.actualInterval,
                              {
                                start: value.workTimeCorrection.actualStartTime,
                                end: value.workTimeCorrection.actualEndTime,
                              },
                            )}
                          </Typography>
                        ) : null}
                        {workTimeBreakdown ? (
                          <Typography variant="caption" color="text.secondary">
                            {interpolate(
                              t.settlement.editor.workTime.previewExtended,
                              {
                                planned: intervalHours({
                                  startTime:
                                    value.workTimeCorrection!.plannedStartTime,
                                  endTime:
                                    value.workTimeCorrection!.plannedEndTime,
                                }).toLocaleString('pl-PL'),
                                actual: intervalHours({
                                  startTime:
                                    value.workTimeCorrection!.actualStartTime,
                                  endTime:
                                    value.workTimeCorrection!.actualEndTime,
                                }).toLocaleString('pl-PL'),
                                private:
                                  workTimeBreakdown.privateTimeHours.toLocaleString(
                                    'pl-PL',
                                  ),
                                overtime50:
                                  workTimeBreakdown.overtime50Hours.toLocaleString(
                                    'pl-PL',
                                  ),
                                overtime100:
                                  workTimeBreakdown.overtime100Hours.toLocaleString(
                                    'pl-PL',
                                  ),
                                night:
                                  workTimeBreakdown.nightAllowanceHours.toLocaleString(
                                    'pl-PL',
                                  ),
                              },
                            )}
                          </Typography>
                        ) : null}
                        {warnings.length > 0 ? (
                          <Typography variant="caption" color="warning.dark">
                            {t.settlement.employeeCalendar.warning}
                          </Typography>
                        ) : null}
                      </Stack>
                    </ButtonBase>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.settlement.employeeCalendar.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
