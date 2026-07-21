import { useState } from 'react';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Collapse,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import {
  AbsenceMenuItem,
  AbsenceOptionContent,
} from '../../components/absences/AbsenceOptionContent';
import { ABSENCE_SELECT_MENU_PROPS } from '../../components/absences/absenceSelect';
import { useTranslations } from '../../hooks/useTranslations';
import { useNotification } from '../../hooks/useNotification';
import { interpolate } from '../../i18n/pl';
import { createAbsence, saveDayAbsence } from '../../services/absencesService';
import {
  SettlementServiceError,
  type SettlementServiceErrorCode,
} from '../../services/settlementService';
import { saveSettlementReviewState } from '../../services/settlementReviewService';
import {
  clearManualDailyValue,
  saveManualDailyValue,
} from '../../services/dailyValueService';
import type {
  Employee,
  EmployeeColorShift,
  MonthId,
  SettlementReviewUpdateInput,
} from '../../types/firestore';
import {
  calculateMonthlyDrafts,
  isEmployeeActiveOnDate,
  resolveMonthlyEmployeeEntitlements,
} from '../../utils/payroll';
import type { AbsenceCode } from '../../utils/absences';
import { CalendarConstructorToolbar } from './CalendarConstructorToolbar';
import {
  calendarConstructorBlockedReason,
  calendarToolOperation,
  datesInRangeSelection,
  employeeMatchesCalendarConstructorOrganizationFilters,
  updateSingleEmployeeRangeSelection,
  type CalendarConstructorTool,
  type CalendarRangeSelection,
} from './calendarConstructor';
import { DailyValueEditorDialog } from './DailyValueEditorDialog';
import { EmployeeCalendarDialog } from './EmployeeCalendarDialog';
import {
  createCalendarDays,
  getMonthDateRange,
  isDayWithinEmployment,
  resolveMonthlyEmployeeParticipation,
  type CalendarDay,
  type SettlementCellValue,
} from './monthUtils';
import {
  generateEmployeeMonthlySchedule,
  type PlannedScheduleDay,
} from '../../utils/schedule';
import { parseDailyHoursInput } from './dailyValueEntry';
import { PayrollDraftPanel } from './PayrollDraftPanel';
import {
  getPublicHolidayNamesForYear,
  getPublicHolidaysForYear,
} from './publicHolidays';
import { SettlementReviewPanel } from './SettlementReviewPanel';
import { SettlementExportPanel } from './SettlementExportPanel';
import { SettlementGrid } from './SettlementGrid';
import { SettlementLegend } from './SettlementLegend';
import { useSettlementMonth } from './useSettlementMonth';
import { MonthlyCalculationStatusPanel } from './MonthlyCalculationStatusPanel';
import { createMonthlyCalculationInputHash } from '../../services/monthlyCalculationService';

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
  const {
    data,
    error,
    isLoading,
    loadingStage,
    isCreating,
    createMonth,
    reload,
  } = useSettlementMonth(monthId);
  const [editingCell, setEditingCell] = useState<{
    employee: Employee;
    day: CalendarDay;
    value: SettlementCellValue;
    hasGoverningAbsence: boolean;
    plannedDay?: PlannedScheduleDay;
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
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState<
    EmployeeColorShift | 'all' | 'unassigned'
  >('all');
  const [calendarFilter, setCalendarFilter] = useState('all');
  const [currentStateOnly, setCurrentStateOnly] = useState(false);
  const [calendarDisplayMode, setCalendarDisplayMode] = useState<
    'hours' | 'shifts'
  >('hours');
  const [focusedEmployee, setFocusedEmployee] = useState<Employee | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);

  if (isLoading) {
    return (
      <Card aria-label={t.settlement.loading}>
        <CardContent>
          <Stack spacing={2}>
            <Skeleton width={240} height={32} />
            <Typography color="text.secondary">
              {loadingStage
                ? t.settlement.loadingStages[loadingStage]
                : t.settlement.loading}
            </Typography>
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
  const publicHolidayNames = getPublicHolidayNamesForYear(range.year);
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

  const participation = resolveMonthlyEmployeeParticipation(
    data.employees,
    range,
  );
  const participatingEmployees = participation.participants;
  const participatingEmployeeIds = new Set(
    participatingEmployees.map((employee) => employee.id),
  );
  const participatingDailyValues = data.dailyValues.filter((value) =>
    participatingEmployeeIds.has(value.employeeId),
  );
  const participatingAbsences = data.absences.filter((absence) =>
    participatingEmployeeIds.has(absence.employeeId),
  );
  const entitlementsByEmployeeId = resolveMonthlyEmployeeEntitlements({
    monthId,
    employees: participatingEmployees,
    entitlements: data.employeeEntitlements,
  });
  const plannedSchedulesByEmployeeId = new Map(
    participatingEmployees.map((employee) => [
      employee.id,
      generateEmployeeMonthlySchedule({
        employee,
        days,
        departments: data.departments,
        options: {
          publicHolidays,
          publicHolidayNames,
          assignments: data.employeeAssignments,
          corrections: data.scheduleCorrections,
          departmentShiftCorrections: data.departmentShiftCorrections,
          shiftHoursVersions: data.shiftHoursVersions,
        },
      }),
    ]),
  );
  const calculationDraftsBase = calculateMonthlyDrafts({
    monthId,
    employees: participatingEmployees,
    dailyValues: participatingDailyValues,
    absences: participatingAbsences,
    payrollSettings: data.payrollSettings,
    adjustments: data.adjustments,
    entitlementsByEmployeeId,
    depositReturnOverridesByEmployeeId: new Map(
      data.reviewStates.map((state) => [
        state.employeeId,
        state.depositReturnOverride,
      ]),
    ),
    plannedSchedulesByEmployeeId,
    calendarOptions: { publicHolidays },
  });
  const calculationDrafts = data.sourceFailures.length
    ? calculationDraftsBase.map((draft) => ({
        ...draft,
        warnings: [
          ...draft.warnings,
          {
            code: 'critical-read-failure' as const,
            date: null,
            message: data.sourceFailures.join(', '),
          },
        ],
      }))
    : calculationDraftsBase;
  const calculationInputHash = createMonthlyCalculationInputHash({
    monthId,
    employees: participatingEmployees,
    dailyValues: participatingDailyValues,
    absences: participatingAbsences,
    payrollSettings: data.payrollSettings,
    adjustments: data.adjustments,
    entitlements: data.employeeEntitlements,
    assignments: data.employeeAssignments,
    scheduleCorrections: data.scheduleCorrections,
    departments: data.departments,
    shiftHoursVersions: data.shiftHoursVersions,
    departmentShiftCorrections: data.departmentShiftCorrections,
    sourceFailures: data.sourceFailures,
  });
  const draftsByEmployeeId = new Map(
    calculationDrafts.map((draft) => [draft.employeeId, draft]),
  );
  const filteredEmployees = participatingEmployees.filter((employee) => {
    if (currentStateOnly && !isEmployeeActiveOnDate(employee, new Date())) {
      return false;
    }
    const search = employeeSearch.trim().toLocaleLowerCase('pl-PL');
    const employeeName =
      `${employee.lastName} ${employee.firstName} ${employee.tetaNumber}`.toLocaleLowerCase(
        'pl-PL',
      );
    if (search && !employeeName.includes(search)) {
      return false;
    }

    if (
      !employeeMatchesCalendarConstructorOrganizationFilters(employee, {
        departmentId: departmentFilter,
        shiftAssignment: shiftFilter,
      })
    ) {
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

  const selectConstructorCell = (
    employee: Employee,
    day: CalendarDay,
    value: SettlementCellValue,
    hasGoverningAbsence: boolean,
    plannedDay?: PlannedScheduleDay,
  ) => {
    if (selectedTool === 'review') {
      setEditingCell({ employee, day, value, hasGoverningAbsence, plannedDay });
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

  const saveReviewState = async (input: SettlementReviewUpdateInput) => {
    try {
      await saveSettlementReviewState(monthId, input);
      await reload();
      notify({
        message: t.settlement.review.notifications.saved,
        severity: 'success',
      });
    } catch {
      notify({
        message: t.settlement.review.errors.saveFailed,
        severity: 'error',
      });
      throw new Error('review-save-failed');
    }
  };

  return (
    <Stack spacing={1.5}>
      {data.month.isSettled ? (
        <Alert severity="info">
          <strong>{t.settlement.settled.title}</strong>
          <br />
          {t.settlement.settled.description}
        </Alert>
      ) : null}

      {participation.missingContractHistory.length > 0 ? (
        <Alert severity="warning">
          <strong>
            {t.settlement.contractHistoryDiagnostics.missingTitle}
          </strong>
          <br />
          {interpolate(
            t.settlement.contractHistoryDiagnostics.missingDescription,
            {
              count: participation.missingContractHistory.length.toString(),
            },
          )}
        </Alert>
      ) : null}

      {participation.invalidContractHistory.length > 0 ? (
        <Alert severity="error">
          <strong>
            {t.settlement.contractHistoryDiagnostics.invalidTitle}
          </strong>
          <br />
          {interpolate(
            t.settlement.contractHistoryDiagnostics.invalidDescription,
            {
              count: participation.invalidContractHistory.length.toString(),
            },
          )}
        </Alert>
      ) : null}

      {participatingEmployees.length > 0 ? (
        <>
          <MonthlyCalculationStatusPanel
            monthId={monthId}
            month={data.month}
            drafts={calculationDrafts}
            inputHash={calculationInputHash}
            employeeCount={participatingEmployees.length}
            monthLabel={monthFormatter.format(range.start)}
            onReload={reload}
          />
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
            <CardContent sx={{ p: '12px !important' }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                useFlexGap
                spacing={1}
                sx={{
                  alignItems: { xs: 'stretch', md: 'center' },
                  flexWrap: { md: 'wrap', xl: 'nowrap' },
                }}
              >
                <TextField
                  label={t.settlement.constructor.filters.employee}
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  size="small"
                  sx={{ minWidth: { md: 210 } }}
                />
                <TextField
                  select
                  label={t.settlement.constructor.filters.department}
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  size="small"
                  sx={{ minWidth: { md: 170 } }}
                >
                  <MenuItem value="all">
                    {t.settlement.constructor.filters.allDepartments}
                  </MenuItem>
                  <MenuItem value="unassigned">
                    {t.settlement.constructor.filters.unassignedDepartment}
                  </MenuItem>
                  {data.departments.map((department) => (
                    <MenuItem key={department.id} value={department.id}>
                      {department.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label={t.settlement.constructor.filters.shift}
                  value={shiftFilter}
                  onChange={(event) =>
                    setShiftFilter(
                      event.target.value as
                        EmployeeColorShift | 'all' | 'unassigned',
                    )
                  }
                  size="small"
                  sx={{ minWidth: { md: 160 } }}
                >
                  <MenuItem value="all">
                    {t.settlement.constructor.filters.allShifts}
                  </MenuItem>
                  <MenuItem value="unassigned">
                    {t.settlement.constructor.filters.unassignedShift}
                  </MenuItem>
                  <MenuItem value="RED">{t.organization.shifts.RED}</MenuItem>
                  <MenuItem value="WHITE">
                    {t.organization.shifts.WHITE}
                  </MenuItem>
                  <MenuItem value="BLUE">{t.organization.shifts.BLUE}</MenuItem>
                </TextField>
                <TextField
                  select
                  label={t.settlement.constructor.filters.type}
                  value={calendarFilter}
                  onChange={(event) => setCalendarFilter(event.target.value)}
                  size="small"
                  sx={{ minWidth: { md: 190 } }}
                  slotProps={{
                    select: {
                      MenuProps: ABSENCE_SELECT_MENU_PROPS,
                      renderValue: (selected) => {
                        if (selected === 'all')
                          return t.settlement.constructor.filters.all;
                        if (selected === 'conflicts')
                          return t.settlement.constructor.filters.conflicts;
                        if (selected === 'warnings')
                          return t.settlement.constructor.filters.warnings;
                        const code = selected as AbsenceCode;
                        return (
                          <AbsenceOptionContent
                            code={code}
                            description={t.absences.typeDescriptions[code]}
                          />
                        );
                      },
                    },
                  }}
                >
                  <MenuItem value="all">
                    {t.settlement.constructor.filters.all}
                  </MenuItem>
                  {(['L4', 'UW', 'UZ', 'NN'] as const).map((code) => (
                    <AbsenceMenuItem
                      key={code}
                      code={code}
                      description={t.absences.typeDescriptions[code]}
                    />
                  ))}
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
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentStateOnly}
                      onChange={(_, checked) => setCurrentStateOnly(checked)}
                    />
                  }
                  label={t.settlement.constructor.filters.currentState}
                />
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={calendarDisplayMode}
                  onChange={(_, value: 'hours' | 'shifts' | null) => {
                    if (value) {
                      setCalendarDisplayMode(value);
                    }
                  }}
                  aria-label={t.settlement.grid.displayMode.label}
                  sx={{ ml: { md: 'auto' } }}
                >
                  <ToggleButton value="hours">
                    {t.settlement.grid.displayMode.hours}
                  </ToggleButton>
                  <ToggleButton value="shifts">
                    {t.settlement.grid.displayMode.shifts}
                  </ToggleButton>
                </ToggleButtonGroup>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<InfoOutlined />}
                  onClick={() => setLegendOpen((current) => !current)}
                >
                  {t.settlement.summary.legend}
                </Button>
              </Stack>
            </CardContent>
          </Card>
          <Collapse in={legendOpen} unmountOnExit>
            <Card sx={{ p: 1.5 }}>
              <SettlementLegend />
            </Card>
          </Collapse>
          <SettlementGrid
            employees={filteredEmployees}
            days={days}
            dailyValues={filteredDailyValues}
            departments={data.departments}
            employeeAssignments={data.employeeAssignments}
            scheduleCorrections={data.scheduleCorrections}
            departmentShiftCorrections={data.departmentShiftCorrections}
            shiftHoursVersions={data.shiftHoursVersions}
            publicHolidays={publicHolidays}
            publicHolidayNames={publicHolidayNames}
            absences={filteredAbsences}
            isSettled={data.month.isSettled}
            displayMode={calendarDisplayMode}
            selection={selection}
            onSelectCell={selectConstructorCell}
            onOpenEmployeeCalendar={setFocusedEmployee}
          />
          <SettlementReviewPanel
            drafts={calculationDrafts}
            employees={participatingEmployees}
            departments={data.departments}
            reviewStates={data.reviewStates}
            isSettled={data.month.isSettled}
            onOpenEmployeeCalendar={(employeeId) => {
              const employee = participatingEmployees.find(
                (item) => item.id === employeeId,
              );
              if (employee) {
                setFocusedEmployee(employee);
              }
            }}
            onSaveReview={saveReviewState}
          />
          <SettlementExportPanel
            monthId={monthId}
            employees={participatingEmployees}
            departments={data.departments}
            days={days}
            dailyValues={participatingDailyValues}
            drafts={calculationDrafts}
            reviewStates={data.reviewStates}
            publicHolidays={publicHolidays}
          />
          <PayrollDraftPanel
            drafts={filteredDrafts}
            employees={filteredEmployees}
            departments={data.departments}
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
          plannedDay={editingCell.plannedDay}
          governingAbsence={
            participatingAbsences.find(
              (absence) =>
                absence.employeeId === editingCell.employee.id &&
                absence.status === 'ACTIVE' &&
                absence.startDate <= editingCell.day.isoDate &&
                absence.endDate >= editingCell.day.isoDate,
            ) ?? null
          }
          onClose={() => setEditingCell(null)}
          onSave={async (hours, note, workTimeCorrection) => {
            const existingAbsence = participatingAbsences.find(
              (absence) =>
                absence.employeeId === editingCell.employee.id &&
                absence.status === 'ACTIVE' &&
                absence.startDate <= editingCell.day.isoDate &&
                absence.endDate >= editingCell.day.isoDate,
            );
            await saveManualDailyValue(
              monthId,
              {
                employeeId: editingCell.employee.id,
                tetaNumber: editingCell.employee.tetaNumber,
                date: editingCell.day.isoDate,
                hours,
                note,
                workTimeCorrection,
              },
              existingAbsence ?? null,
            );
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
          onSaveAbsence={async (code: AbsenceCode, note) => {
            const existing = participatingAbsences.find(
              (absence) =>
                absence.employeeId === editingCell.employee.id &&
                absence.status === 'ACTIVE' &&
                absence.startDate <= editingCell.day.isoDate &&
                absence.endDate >= editingCell.day.isoDate,
            );
            if (
              existing?.source === 'absence_import' ||
              (existing && existing.startDate !== existing.endDate)
            ) {
              throw new Error('read-only-record');
            }
            const absenceInput = {
              employeeId: editingCell.employee.id,
              tetaNumber: editingCell.employee.tetaNumber,
              absenceCode: code,
              startDate: editingCell.day.isoDate,
              endDate: editingCell.day.isoDate,
              hoursPerDay: null,
              note,
            };
            await saveDayAbsence({
              existingAbsence: existing,
              input: absenceInput,
            });
            await reload();
            notify({
              message:
                code === 'L4'
                  ? t.settlement.notifications.manualL4Saved
                  : t.settlement.notifications.absenceSaved,
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
          departments={data.departments}
          isSettled={data.month.isSettled}
          plannedSchedule={generateEmployeeMonthlySchedule({
            employee: focusedEmployee,
            days,
            departments: data.departments,
            options: {
              assignments: data.employeeAssignments,
              corrections: data.scheduleCorrections,
              departmentShiftCorrections: data.departmentShiftCorrections,
              shiftHoursVersions: data.shiftHoursVersions,
              publicHolidays,
              publicHolidayNames,
            },
          })}
          onClose={() => setFocusedEmployee(null)}
          onEditDay={(day, value, hasGoverningAbsence, plannedDay) =>
            setEditingCell({
              employee: focusedEmployee,
              day,
              value,
              hasGoverningAbsence,
              plannedDay,
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
  if (code === 'contract-history-unavailable') {
    return t.settlement.errors.contractHistoryUnavailable;
  }
  return t.settlement.errors.generic;
}
