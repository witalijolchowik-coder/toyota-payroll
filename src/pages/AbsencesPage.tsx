import { useMemo, useState } from 'react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { PageHeader } from '../components/layout/PageHeader';
import { AbsenceFormDialog } from '../features/absences/AbsenceFormDialog';
import { useAbsences } from '../features/absences/useAbsences';
import { useNotification } from '../hooks/useNotification';
import { useTranslations } from '../hooks/useTranslations';
import { interpolate } from '../i18n/pl';
import { AbsenceServiceError } from '../services/absencesService';
import type {
  Absence,
  AbsenceCreateInput,
  Employee,
  MonthId,
} from '../types/firestore';
import {
  ABSENCE_CODES,
  EXCUSED_ABSENCE_CODES,
  UNEXPLAINED_ABSENCE_CODES,
  absenceCoversDate,
  absenceEmploymentIssue,
  normalizeAbsenceCode,
} from '../utils/absences';
import { currentPayrollMonthId } from '../utils/payroll';

type FormState = { mode: 'add' } | { mode: 'edit'; absence: Absence } | null;

function localIsoDate(date = new Date()) {
  return `${date.getFullYear().toString().padStart(4, '0')}-${(
    date.getMonth() + 1
  )
    .toString()
    .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

export function AbsencesPage() {
  const t = useTranslations();
  const { notify } = useNotification();
  const [monthId, setMonthId] = useState<MonthId>(() =>
    currentPayrollMonthId(new Date()),
  );
  const {
    absences,
    currentAbsences,
    employees,
    isLoading,
    error,
    createAbsence,
    updateAbsence,
    cancelAbsence,
  } = useAbsences(monthId);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [formState, setFormState] = useState<FormState>(null);
  const [cancelTarget, setCancelTarget] = useState<Absence | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const filteredAbsences = useMemo(
    () =>
      absences.filter(
        (absence) =>
          (employeeFilter === 'all' || absence.employeeId === employeeFilter) &&
          (typeFilter === 'all' ||
            normalizeAbsenceCode(absence.absenceCode) === typeFilter) &&
          (statusFilter === 'all' || absence.status === statusFilter),
      ),
    [absences, employeeFilter, statusFilter, typeFilter],
  );

  const today = localIsoDate();
  const currentActive = currentAbsences.filter(
    (absence) =>
      absence.status === 'ACTIVE' && absenceCoversDate(absence, today),
  );
  const summary = {
    l4: countEmployees(currentActive, (code) => code === 'L4'),
    excused: countEmployees(currentActive, (code) =>
      EXCUSED_ABSENCE_CODES.has(code),
    ),
    unexplained: countEmployees(currentActive, (code) =>
      UNEXPLAINED_ABSENCE_CODES.has(code),
    ),
  };

  const handleSubmit = async (input: AbsenceCreateInput) => {
    if (formState?.mode === 'edit') {
      await updateAbsence(formState.absence, input);
      notify({
        message: t.absences.notifications.updated,
        severity: 'success',
      });
    } else {
      await createAbsence(input);
      notify({
        message: t.absences.notifications.created,
        severity: 'success',
      });
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await cancelAbsence(cancelTarget);
      setCancelTarget(null);
      notify({
        message: t.absences.notifications.cancelled,
        severity: 'success',
      });
    } catch {
      notify({ message: t.absences.errors.cancelFailed, severity: 'error' });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={t.absences.page.eyebrow}
        title={t.absences.page.title}
        description={t.absences.page.description}
        action={
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setFormState({ mode: 'add' })}
          >
            {t.absences.page.add}
          </Button>
        }
      />

      {error ? (
        <Alert severity="error">
          <strong>{t.absences.errors.loadTitle}</strong>
          <br />
          {loadErrorMessage(error, t)}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        <SummaryCard title={t.absences.summary.l4} value={summary.l4} />
        <SummaryCard
          title={t.absences.summary.excused}
          value={summary.excused}
        />
        <SummaryCard
          title={t.absences.summary.unexplained}
          value={summary.unexplained}
        />
      </Box>

      <Card>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          sx={{ p: 2, alignItems: { lg: 'center' } }}
        >
          <TextField
            type="month"
            label={t.absences.filters.month}
            value={monthId}
            onChange={(event) => setMonthId(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            label={t.absences.filters.employee}
            value={employeeFilter}
            onChange={(event) => setEmployeeFilter(event.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="all">{t.absences.filters.allEmployees}</MenuItem>
            {employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.tetaNumber} — {employee.lastName} {employee.firstName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t.absences.filters.type}
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="all">{t.absences.filters.allTypes}</MenuItem>
            {ABSENCE_CODES.map((code) => (
              <MenuItem key={code} value={code}>
                {code === 'UZ' ? t.absences.types.UZ : code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t.absences.filters.status}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">{t.absences.filters.allStatuses}</MenuItem>
            <MenuItem value="ACTIVE">{t.absences.status.ACTIVE}</MenuItem>
            <MenuItem value="CANCELLED">{t.absences.status.CANCELLED}</MenuItem>
          </TextField>
        </Stack>
        <Divider />
        <AbsenceTable
          absences={filteredAbsences}
          employeesById={employeesById}
          isLoading={isLoading}
          onEdit={(absence) => setFormState({ mode: 'edit', absence })}
          onCancel={setCancelTarget}
        />
      </Card>

      {formState ? (
        <AbsenceFormDialog
          absence={formState.mode === 'edit' ? formState.absence : undefined}
          employees={employees}
          defaultStartDate={
            monthId === currentPayrollMonthId(new Date())
              ? today
              : `${monthId}-01`
          }
          onClose={() => setFormState(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      {cancelTarget ? (
        <Dialog
          open
          onClose={isCancelling ? undefined : () => setCancelTarget(null)}
        >
          <DialogTitle>{t.absences.cancel.title}</DialogTitle>
          <DialogContent>
            {interpolate(t.absences.cancel.description, {
              code: cancelTarget.absenceCode,
            })}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setCancelTarget(null)}
              disabled={isCancelling}
            >
              {t.absences.cancel.back}
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => void handleCancel()}
              disabled={isCancelling}
            >
              {t.absences.cancel.confirm}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Stack>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardContent>
        <Typography color="text.secondary" variant="body2">
          {title}
        </Typography>
        <Typography variant="h4" sx={{ mt: 1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function countEmployees(
  absences: Absence[],
  predicate: (code: string) => boolean,
) {
  return new Set(
    absences
      .filter((absence) => predicate(normalizeAbsenceCode(absence.absenceCode)))
      .map((absence) => absence.employeeId),
  ).size;
}

function AbsenceTable({
  absences,
  employeesById,
  isLoading,
  onEdit,
  onCancel,
}: {
  absences: Absence[];
  employeesById: Map<string, Employee>;
  isLoading: boolean;
  onEdit: (absence: Absence) => void;
  onCancel: (absence: Absence) => void;
}) {
  const t = useTranslations();
  if (isLoading) {
    return (
      <Stack spacing={1} sx={{ p: 2 }}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} height={42} />
        ))}
      </Stack>
    );
  }
  if (absences.length === 0) {
    return (
      <Box sx={{ p: 5, textAlign: 'center' }}>
        <Typography variant="h6">{t.absences.empty.title}</Typography>
        <Typography color="text.secondary">
          {t.absences.empty.description}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow>
            <TableCell>{t.absences.table.teta}</TableCell>
            <TableCell>{t.absences.table.employee}</TableCell>
            <TableCell>{t.absences.table.type}</TableCell>
            <TableCell>{t.absences.table.period}</TableCell>
            <TableCell>{t.absences.table.status}</TableCell>
            <TableCell>{t.absences.table.review}</TableCell>
            <TableCell align="right">{t.absences.table.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {absences.map((absence) => {
            const employee = employeesById.get(absence.employeeId);
            const issue = employee
              ? absenceEmploymentIssue(absence, {
                  employmentStart: employee.employmentStartDate,
                  employmentEnd: employee.employmentEndDate,
                })
              : 'missing-employment-start';
            const editable =
              absence.source === 'manual' && absence.status === 'ACTIVE';
            return (
              <TableRow hover key={`${absence.monthId}:${absence.id}`}>
                <TableCell>{absence.tetaNumber}</TableCell>
                <TableCell>
                  {employee
                    ? `${employee.lastName} ${employee.firstName}`
                    : t.absences.table.unknownEmployee}
                </TableCell>
                <TableCell>
                  {absence.absenceCode === 'UZ'
                    ? t.absences.types.UZ
                    : absence.absenceCode}
                </TableCell>
                <TableCell>
                  {absence.startDate} – {absence.endDate}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={t.absences.status[absence.status]}
                    color={absence.status === 'ACTIVE' ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  {issue ? (
                    <Chip
                      size="small"
                      color="warning"
                      label={t.absences.table.outsideEmployment}
                    />
                  ) : (
                    t.absences.table.noIssues
                  )}
                </TableCell>
                <TableCell align="right">
                  {editable ? (
                    <>
                      <Tooltip title={t.absences.table.edit}>
                        <IconButton
                          size="small"
                          onClick={() => onEdit(absence)}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t.absences.table.cancel}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onCancel(absence)}
                        >
                          <CancelOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    t.absences.table.readOnly
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function loadErrorMessage(error: Error, t: ReturnType<typeof useTranslations>) {
  const code = error instanceof AbsenceServiceError ? error.code : undefined;
  if (code === 'authentication-required')
    return t.absences.errors.authenticationRequired;
  if (code === 'firebase-unavailable')
    return t.absences.errors.firebaseUnavailable;
  return t.absences.errors.loadDescription;
}
