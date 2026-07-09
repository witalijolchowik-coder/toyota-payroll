import { useState } from 'react';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { useNotification } from '../../hooks/useNotification';
import { interpolate } from '../../i18n/pl';
import { createAbsence } from '../../services/absencesService';
import {
  SettlementServiceError,
  type SettlementServiceErrorCode,
} from '../../services/settlementService';
import {
  clearManualDailyValue,
  saveManualDailyValue,
} from '../../services/dailyValueService';
import type { Employee, MonthId } from '../../types/firestore';
import { calculateMonthlyDrafts } from '../../utils/payroll';
import { CalendarConstructorToolbar } from './CalendarConstructorToolbar';
import {
  calendarConstructorBlockedReason,
  calendarToolOperation,
  datesInRangeSelection,
  updateSingleEmployeeRangeSelection,
  type CalendarConstructorTool,
  type CalendarRangeSelection,
} from './calendarConstructor';
import { DailyValueEditorDialog } from './DailyValueEditorDialog';
import { EmployeeCalendarDialog } from './EmployeeCalendarDialog';
import {
  createCalendarDays,
  employeeParticipatesInMonth,
  getMonthDateRange,
  isDayWithinEmployment,
  type CalendarDay,
  type SettlementCellValue,
} from './monthUtils';
import { parseDailyHoursInput } from './dailyValueEntry';
import { PayrollDraftPanel } from './PayrollDraftPanel';
import { getPublicHolidaysForYear } from './publicHolidays';
import { SettlementGrid } from './SettlementGrid';
import { SettlementLegend } from './SettlementLegend';
import { useSettlementMonth } from './useSettlementMonth';

interface SettlementMonthViewProps {
  monthId: MonthId;
}

const monthFormatter = new Intl.DateTimeFormat('pl-PL', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function SettlementMonthView({ monthId }: SettlementMonthViewProps) {
  const t = useTranslations();
  const { notify } = useNotification();
  const { data, error, isLoading, isCreating, createMonth, reload } =
    useSettlementMonth(monthId);
  const [editingCell, setEditingCell] = useState<{
    employee: Employee;
    day: CalendarDay;
    value: SettlementCellValue;
    hasGoverningAbsence: boolean;
  } | null>(null);
  const [selectedTool, setSelectedTool] =
    useState<CalendarConstructorTool>('review');
  const [selection, setSelection] = useState<CalendarRangeSelection | null>(
    null,
  );
  const [hoursInput, setHoursInput] = useState('8');
  const [constructorNote, setConstructorNote] = useState('');
  const [isApplyingConstructor, setIsApplyingConstructor] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [calendarFilter, setCalendarFilter] = useState('all');
  const [focusedEmployee, setFocusedEmployee] = useState<Employee | null>(null);

  if (isLoading) {
    return (
      <Card aria-label={t.settlement.loading}>
        <CardContent>
          <Stack spacing={2}>
            <Skeleton width={240} height={32} />
            <Skeleton variant="rounded" height={220} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        <strong>{t.settlement.errors.title}</strong>
        <br />
        {settlementErrorMessage(error, t)}
      </Alert>
    );
  }

  const range = getMonthDateRange(monthId);
  const publicHolidays = getPublicHolidaysForYear(range.year);
  const days = createCalendarDays(monthId, {
    publicHolidays,
  });

  if (!data) {
    const handleCreateMonth = () => {
      void createMonth()
        .then(() => {
          notify({
            message: t.settlement.notifications.created,
            severity: 'success',
          });
        })
        .catch(() => undefined);
    };

    return (
      <Stack spacing={2}>
        <Card>
          <CardContent sx={{ py: 2.5 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
              }}
            >
              <div>
                <Typography variant="h6">
                  {t.settlement.missingMonth.title}
                </Typography>
                <Typography color="text.secondary">
                  {t.settlement.missingMonth.description}
                </Typography>
              </div>
              <Button
                variant="contained"
                onClick={handleCreateMonth}
                disabled={isCreating}
                startIcon={
                  isCreating ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <CalendarMonthOutlined />
                  )
                }
              >
                {t.settlement.missingMonth.create}
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <SettlementGrid employees={[]} days={days} dailyValues={[]} />
      </Stack>
    );
  }

  const employeesWithoutStartDate = data.employees.filter(
    (employee) => !employee.employmentStartDate,
  );
  const participatingEmployees = data.employees.filter((employee) =>
    employeeParticipatesInMonth(employee, range),
  );
  const participatingEmployeeIds = new Set(
    participatingEmployees.map((employee) => employee.id),
  );
  const participatingDailyValues = data.dailyValues.filter((value) =>
    participatingEmployeeIds.has(value.employeeId),
  );
  const participatingAbsences = data.absences.filter((absence) =>
    participatingEmployeeIds.has(absence.employeeId),
  );
  const calculationDrafts = calculateMonthlyDrafts({
    monthId,
    employees: participatingEmployees,
    dailyValues: participatingDailyValues,
    absences: participatingAbsences,
    payrollSettings: data.payrollSettings,
    adjustments: data.adjustments,
    calendarOptions: { publicHolidays },
  });
  const draftsByEmployeeId = new Map(
    calculationDrafts.map((draft) => [draft.employeeId, draft]),
  );
  const filteredEmployees = participatingEmployees.filter((employee) => {
    const search = employeeSearch.trim().toLocaleLowerCase('pl-PL');
    const employeeName =
      `${employee.lastName} ${employee.firstName} ${employee.tetaNumber}`.toLocaleLowerCase(
        'pl-PL',
      );
    if (search && !employeeName.includes(search)) {
      return false;
    }

    if (calendarFilter === 'all') {
      return true;
    }
    const draft = draftsByEmployeeId.get(employee.id);
    if (calendarFilter === 'warnings') {
      return Boolean(draft && draft.warnings.length > 0);
    }
    if (calendarFilter === 'conflicts') {
      return Boolean(draft && draft.attendance.conflictDays.length > 0);
    }
    return participatingAbsences.some(
      (absence) =>
        absence.employeeId === employee.id &&
        absence.status === 'ACTIVE' &&
        absence.absenceCode === calendarFilter,
    );
  });
  const filteredEmployeeIds = new Set(
    filteredEmployees.map((employee) => employee.id),
  );
  const filteredDailyValues = participatingDailyValues.filter((value) =>
    filteredEmployeeIds.has(value.employeeId),
  );
  const filteredAbsences = participatingAbsences.filter((absence) =>
    filteredEmployeeIds.has(absence.employeeId),
  );
  const filteredDrafts = calculationDrafts.filter((draft) =>
    filteredEmployeeIds.has(draft.employeeId),
  );
  const selectedEmployee =
    selection &&
    participatingEmployees.find(
      (employee) => employee.id === selection.employeeId,
    )
      ? participatingEmployees.find(
          (employee) => employee.id === selection.employeeId,
        )!
      : null;
  const selectedDays =
    selection && selectedEmployee ? datesInRangeSelection(days, selection) : [];
  const containsOutsideEmployment =
    Boolean(selectedEmployee) &&
    selectedDays.some((day) => !isDayWithinEmployment(selectedEmployee!, day));
  const blockedReason = calendarConstructorBlockedReason({
    isSettled: data.month.isSettled,
    selectedTool,
    containsOutsideEmployment,
  });

  const selectConstructorCell = (employee: Employee, day: CalendarDay) => {
    if (selectedTool === 'review') {
      setFocusedEmployee(employee);
      return;
    }
    setSelection((current) =>
      updateSingleEmployeeRangeSelection({
        current,
        employeeId: employee.id,
        date: day.isoDate,
      }),
    );
  };

  const applyConstructorTool = async () => {
    if (!selection || !selectedEmployee || blockedReason) {
      return;
    }
    const operation = calendarToolOperation(selectedTool);
    if (operation.kind === 'review') {
      return;
    }

    setIsApplyingConstructor(true);
    try {
      if (operation.kind === 'hours') {
        const parsed = parseDailyHoursInput(hoursInput);
        if (parsed.kind !== 'value') {
          notify({
            message: t.settlement.constructor.errors.invalidHours,
            severity: 'error',
          });
          return;
        }
        await Promise.all(
          selectedDays.map((day) =>
            saveManualDailyValue(monthId, {
              employeeId: selectedEmployee.id,
              tetaNumber: selectedEmployee.tetaNumber,
              date: day.isoDate,
              hours: parsed.hours,
              note: constructorNote.trim() || null,
            }),
          ),
        );
      } else if (operation.kind === 'absence') {
        await createAbsence({
          employeeId: selectedEmployee.id,
          tetaNumber: selectedEmployee.tetaNumber,
          absenceCode: operation.absenceCode,
          startDate: selection.startDate,
          endDate: selection.endDate,
          hoursPerDay: null,
          note: constructorNote.trim() || null,
        });
      } else {
        await Promise.all(
          selectedDays.map((day) =>
            clearManualDailyValue(monthId, selectedEmployee.id, day.isoDate),
          ),
        );
      }

      await reload();
      setSelection(null);
      notify({
        message: t.settlement.constructor.notifications.applied,
        severity: 'success',
      });
    } catch {
      notify({
        message: t.settlement.constructor.errors.applyFailed,
        severity: 'error',
      });
    } finally {
      setIsApplyingConstructor(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      {data.month.isSettled ? (
        <Alert severity="info">
          <strong>{t.settlement.settled.title}</strong>
          <br />
          {t.settlement.settled.description}
        </Alert>
      ) : null}

      {employeesWithoutStartDate.length > 0 ? (
        <Alert severity="warning">
          <strong>{t.settlement.incompleteEmployment.title}</strong>
          <br />
          {interpolate(t.settlement.incompleteEmployment.description, {
            count: employeesWithoutStartDate.length.toString(),
          })}
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
            }}
          >
            <div>
              <Typography
                variant="overline"
                color="primary"
                sx={{ fontWeight: 750 }}
              >
                {monthFormatter.format(range.start)}
              </Typography>
              <Typography variant="h6">
                {interpolate(t.settlement.summary.employees, {
                  count: participatingEmployees.length.toString(),
                })}
              </Typography>
            </div>
            <Chip
              variant="outlined"
              label={interpolate(t.settlement.summary.calculationVersion, {
                version: data.month.calculationVersion.toString(),
              })}
            />
          </Stack>
          <Box sx={{ mt: 2.5 }}>
            <SettlementLegend />
          </Box>
        </CardContent>
      </Card>

      {participatingEmployees.length > 0 ? (
        <>
          <CalendarConstructorToolbar
            selectedTool={selectedTool}
            onSelectedToolChange={(tool) => {
              setSelectedTool(tool);
              setSelection(null);
            }}
            selection={selection}
            selectedEmployee={selectedEmployee}
            hoursInput={hoursInput}
            onHoursInputChange={setHoursInput}
            note={constructorNote}
            onNoteChange={setConstructorNote}
            blockedReason={blockedReason}
            isApplying={isApplyingConstructor}
            onApply={() => void applyConstructorTool()}
            onClearSelection={() => setSelection(null)}
            isSettled={data.month.isSettled}
          />
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
              >
                <TextField
                  label={t.settlement.constructor.filters.employee}
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  size="small"
                  sx={{ minWidth: { md: 280 } }}
                />
                <TextField
                  select
                  label={t.settlement.constructor.filters.type}
                  value={calendarFilter}
                  onChange={(event) => setCalendarFilter(event.target.value)}
                  size="small"
                  sx={{ minWidth: { md: 260 } }}
                >
                  <MenuItem value="all">
                    {t.settlement.constructor.filters.all}
                  </MenuItem>
                  <MenuItem value="L4">L4</MenuItem>
                  <MenuItem value="UW">UW</MenuItem>
                  <MenuItem value="UZ">{t.absences.types.UZ}</MenuItem>
                  <MenuItem value="NN">NN</MenuItem>
                  <MenuItem value="conflicts">
                    {t.settlement.constructor.filters.conflicts}
                  </MenuItem>
                  <MenuItem value="warnings">
                    {t.settlement.constructor.filters.warnings}
                  </MenuItem>
                </TextField>
                <Typography color="text.secondary">
                  {interpolate(t.settlement.constructor.filters.result, {
                    count: filteredEmployees.length.toString(),
                  })}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
          <SettlementGrid
            employees={filteredEmployees}
            days={days}
            dailyValues={filteredDailyValues}
            absences={filteredAbsences}
            isSettled={data.month.isSettled}
            selection={selection}
            onSelectCell={(employee, day) =>
              selectConstructorCell(employee, day)
            }
          />
          <PayrollDraftPanel
            drafts={filteredDrafts}
            employees={filteredEmployees}
          />
        </>
      ) : (
        <Card>
          <CardContent sx={{ py: 7, textAlign: 'center' }}>
            <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
              <GroupsOutlined color="disabled" sx={{ fontSize: 48 }} />
              <Typography variant="h6">{t.settlement.empty.title}</Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 560 }}>
                {t.settlement.empty.description}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {editingCell ? (
        <DailyValueEditorDialog
          employee={editingCell.employee}
          day={editingCell.day}
          value={editingCell.value}
          hasGoverningAbsence={editingCell.hasGoverningAbsence}
          onClose={() => setEditingCell(null)}
          onSave={async (hours, note) => {
            await saveManualDailyValue(monthId, {
              employeeId: editingCell.employee.id,
              tetaNumber: editingCell.employee.tetaNumber,
              date: editingCell.day.isoDate,
              hours,
              note,
            });
            await reload();
            notify({
              message: t.settlement.notifications.dailyValueSaved,
              severity: 'success',
            });
          }}
          onClear={async () => {
            await clearManualDailyValue(
              monthId,
              editingCell.employee.id,
              editingCell.day.isoDate,
            );
            await reload();
            notify({
              message: t.settlement.notifications.dailyValueCleared,
              severity: 'success',
            });
          }}
        />
      ) : null}

      {focusedEmployee ? (
        <EmployeeCalendarDialog
          employee={focusedEmployee}
          monthLabel={monthFormatter.format(range.start)}
          days={days}
          dailyValues={participatingDailyValues}
          absences={participatingAbsences}
          isSettled={data.month.isSettled}
          onClose={() => setFocusedEmployee(null)}
          onEditDay={(day, value, hasGoverningAbsence) =>
            setEditingCell({
              employee: focusedEmployee,
              day,
              value,
              hasGoverningAbsence,
            })
          }
        />
      ) : null}
    </Stack>
  );
}

function settlementErrorMessage(
  error: Error | null,
  t: ReturnType<typeof useTranslations>,
): string {
  const code = error instanceof SettlementServiceError ? error.code : undefined;
  return serviceErrorMessage(code, t);
}

function serviceErrorMessage(
  code: SettlementServiceErrorCode | undefined,
  t: ReturnType<typeof useTranslations>,
): string {
  if (code === 'firebase-unavailable') {
    return t.settlement.errors.firebaseUnavailable;
  }
  if (code === 'authentication-required') {
    return t.settlement.errors.authenticationRequired;
  }
  if (code === 'month-unavailable') {
    return t.settlement.errors.monthUnavailable;
  }
  return t.settlement.errors.generic;
}
