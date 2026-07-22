import { useEffect, useMemo, useState } from 'react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import PersonOffOutlined from '@mui/icons-material/PersonOffOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import type {
  Employee,
  EmployeeContract,
  EmployeeContractUpdateInput,
  EmployeeId,
} from '../../types/firestore';
import {
  EmployeeContractServiceError,
  type EmployeeContractImpact,
  type EmployeeContractState,
} from '../../services/employeeContractsService';
import {
  contractBreakDays,
  contractStatus,
  continuationDefaults,
  employeeContractHistoryRevision,
  latestEmploymentEnd,
  requiresContractDecision,
  resolveLatestContract,
  validateEmployeeContract,
} from '../../utils/employees';

interface Props {
  employee: Employee;
  onClose: () => void;
  onReload: (employeeId: EmployeeId) => Promise<EmployeeContractState>;
  onCreate: (
    employeeId: EmployeeId,
    input: {
      sequenceId: string;
      startDate: string;
      endDate: string | null;
      note: string | null;
    },
    expectedRevision: string,
  ) => Promise<void>;
  onUpdate: (
    employeeId: EmployeeId,
    contractId: string,
    input: EmployeeContractUpdateInput,
    expectedRevision: string,
  ) => Promise<void>;
  onCancelContract: (
    employeeId: EmployeeId,
    contractId: string,
    expectedRevision: string,
  ) => Promise<void>;
  onPreviewUpdate: (
    contract: EmployeeContract,
    input: EmployeeContractUpdateInput,
  ) => Promise<EmployeeContractImpact>;
  onPreviewCancellation: (
    contract: EmployeeContract,
  ) => Promise<EmployeeContractImpact>;
  onEndEmployment: (
    employeeId: EmployeeId,
    input: {
      sequenceId: string;
      endDate: string;
      reason: string | null;
    },
    expectedRevision: string,
  ) => Promise<void>;
  onBootstrapLegacy: (
    employeeId: EmployeeId,
    expectedRevision: string,
  ) => Promise<void>;
}

export function EmployeeContractsDialog({
  employee,
  onClose,
  onReload,
  onCreate,
  onUpdate,
  onCancelContract,
  onPreviewUpdate,
  onPreviewCancellation,
  onEndEmployment,
  onBootstrapLegacy,
}: Props) {
  const t = useTranslations();
  const [contractState, setContractState] = useState<EmployeeContractState>({
    employee,
    revision: employeeContractHistoryRevision(employee),
  });
  const currentEmployee = contractState.employee;
  const contracts = useMemo(
    () =>
      [...(currentEmployee.contracts ?? [])].sort((a, b) =>
        b.startDate.localeCompare(a.startDate),
      ),
    [currentEmployee.contracts],
  );
  const continuation = continuationDefaults(currentEmployee);
  const [editing, setEditing] = useState<EmployeeContract | 'new' | null>(null);
  const [startDate, setStartDate] = useState(continuation.startDate ?? '');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [impact, setImpact] = useState<{
    action: 'update' | 'cancel';
    contractId: string;
    value: EmployeeContractImpact;
  } | null>(null);
  const [cancellationTarget, setCancellationTarget] =
    useState<EmployeeContract | null>(null);
  const latest = resolveLatestContract(currentEmployee);
  const ended = latestEmploymentEnd(currentEmployee);

  useEffect(() => {
    let active = true;
    void onReload(employee.id)
      .then((state) => {
        if (active) setContractState(state);
      })
      .catch((caught: unknown) => {
        if (active) setError(contractErrorMessage(caught, t));
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [employee.id, onReload, t]);

  const reloadCurrentState = async () => {
    setRefreshing(true);
    try {
      const state = await onReload(currentEmployee.id);
      setContractState(state);
      return state;
    } finally {
      setRefreshing(false);
    }
  };

  const recoverFromMutationError = async (caught: unknown) => {
    if (
      caught instanceof EmployeeContractServiceError &&
      caught.code === 'mutation-conflict'
    ) {
      try {
        await reloadCurrentState();
      } catch {
        setError(t.employees.contracts.errors.contractReadFailure);
        return;
      }
    }
    setError(contractErrorMessage(caught, t));
  };

  const beginCreate = () => {
    setEditing('new');
    setStartDate(continuation.startDate ?? '');
    setEndDate('');
    setNote('');
    setError(null);
    setImpact(null);
    setCancellationTarget(null);
  };
  const beginEdit = (contract: EmployeeContract) => {
    setEditing(contract);
    setStartDate(contract.startDate);
    setEndDate(contract.endDate ?? '');
    setNote(contract.note ?? '');
    setError(null);
    setImpact(null);
    setCancellationTarget(null);
  };

  const saveContract = async () => {
    const issues = validateEmployeeContract(
      {
        id: editing === 'new' ? '' : (editing?.id ?? ''),
        startDate,
        endDate: endDate || null,
      },
      contracts,
    );
    if (!startDate) {
      setError(t.employees.contracts.errors.missingDate);
      return;
    }
    if (issues.length > 0) {
      setError(contractValidationMessage(issues[0]?.code, t));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing === 'new') {
        await onCreate(
          currentEmployee.id,
          {
            sequenceId:
              ended && ended.sequenceId === latest?.sequenceId
                ? `sequence-${Date.now()}`
                : (latest?.sequenceId ?? `sequence-${Date.now()}`),
            startDate,
            endDate: endDate || null,
            note: note.trim() || null,
          },
          contractState.revision,
        );
      } else if (editing) {
        if (impact?.action !== 'update' || impact.contractId !== editing.id) {
          const value = await onPreviewUpdate(editing, {
            startDate,
            endDate: endDate || null,
            note: note.trim() || null,
          });
          setImpact({ action: 'update', contractId: editing.id, value });
          return;
        }
        if (impact.value.lockedMonths.length > 0) return;
        await onUpdate(
          currentEmployee.id,
          editing.id,
          {
            startDate,
            endDate: endDate || null,
            note: note.trim() || null,
          },
          contractState.revision,
        );
      }
      await reloadCurrentState();
      setEditing(null);
      setImpact(null);
    } catch (caught) {
      await recoverFromMutationError(caught);
    } finally {
      setBusy(false);
    }
  };

  const previewCancellation = async (contract: EmployeeContract) => {
    setBusy(true);
    setError(null);
    try {
      const value = await onPreviewCancellation(contract);
      setCancellationTarget(contract);
      setImpact({ action: 'cancel', contractId: contract.id, value });
    } catch (caught) {
      setError(contractErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const confirmCancellation = async () => {
    if (
      !cancellationTarget ||
      impact?.action !== 'cancel' ||
      impact.contractId !== cancellationTarget.id ||
      impact.value.lockedMonths.length > 0
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCancelContract(
        currentEmployee.id,
        cancellationTarget.id,
        contractState.revision,
      );
      await reloadCurrentState();
      setCancellationTarget(null);
      setImpact(null);
    } catch (caught) {
      await recoverFromMutationError(caught);
    } finally {
      setBusy(false);
    }
  };

  const finishEmployment = async () => {
    if (!latest?.endDate) return;
    setBusy(true);
    setError(null);
    try {
      await onEndEmployment(
        currentEmployee.id,
        {
          sequenceId: latest.sequenceId,
          endDate: latest.endDate,
          reason: reason.trim() || null,
        },
        contractState.revision,
      );
      await reloadCurrentState();
    } catch (caught) {
      await recoverFromMutationError(caught);
    } finally {
      setBusy(false);
    }
  };

  const migrateLegacy = async () => {
    setBusy(true);
    setError(null);
    try {
      await onBootstrapLegacy(currentEmployee.id, contractState.revision);
      await reloadCurrentState();
    } catch (caught) {
      await recoverFromMutationError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {t.employees.contracts.title}: {currentEmployee.firstName}{' '}
        {currentEmployee.lastName}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {refreshing ? (
            <Alert severity="info">{t.employees.contracts.refreshing}</Alert>
          ) : null}
          {requiresContractDecision(currentEmployee) ? (
            <Alert severity="error">
              {t.employees.contracts.decisionRequired}
            </Alert>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {contracts.length === 0 && currentEmployee.employmentStartDate ? (
            <Alert
              severity="info"
              action={
                <Button
                  color="inherit"
                  size="small"
                  disabled={busy || refreshing}
                  onClick={() => void migrateLegacy()}
                >
                  {t.employees.contracts.migrate}
                </Button>
              }
            >
              {t.employees.contracts.legacyInfo}
            </Alert>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<AddOutlined />}
              disabled={busy || refreshing}
              onClick={beginCreate}
            >
              {contracts.length
                ? t.employees.contracts.addNext
                : t.employees.contracts.add}
            </Button>
          </Stack>
          {editing ? (
            <Stack
              spacing={2}
              sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}
            >
              <Typography variant="h6">
                {editing === 'new'
                  ? t.employees.contracts.add
                  : t.employees.contracts.edit}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  type="date"
                  label={t.employees.contracts.from}
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setImpact(null);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
                <TextField
                  type="date"
                  label={t.employees.contracts.to}
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setImpact(null);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Stack>
              <TextField
                label={t.employees.contracts.note}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setImpact(null);
                }}
              />
              {impact?.action === 'update' ? (
                <ContractImpactAlert impact={impact.value} />
              ) : null}
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: 'flex-end' }}
              >
                <Button onClick={() => setEditing(null)}>
                  {t.employees.contracts.cancel}
                </Button>
                <Button
                  variant="contained"
                  disabled={busy || refreshing}
                  onClick={() => void saveContract()}
                >
                  {t.employees.contracts.save}
                </Button>
              </Stack>
            </Stack>
          ) : null}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t.employees.contracts.from}</TableCell>
                <TableCell>{t.employees.contracts.to}</TableCell>
                <TableCell>{t.employees.contracts.status}</TableCell>
                <TableCell>{t.employees.contracts.continuity}</TableCell>
                <TableCell align="right">
                  {t.employees.contracts.actions}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contracts.map((contract, index) => {
                const next = contracts[index - 1];
                const breakDays = next ? contractBreakDays(contract, next) : 0;
                return (
                  <TableRow key={contract.id}>
                    <TableCell>{contract.startDate}</TableCell>
                    <TableCell>
                      {contract.endDate ?? t.employees.contracts.openEnded}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          t.employees.contracts.statuses[
                            contractStatus(contract)
                          ]
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {breakDays > 0
                        ? `${t.employees.contracts.break}: ${breakDays} ${t.employees.contracts.days}`
                        : t.employees.contracts.continuous}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        aria-label={t.employees.contracts.edit}
                        disabled={busy || refreshing}
                        onClick={() => beginEdit(contract)}
                      >
                        <EditOutlined />
                      </IconButton>
                      <IconButton
                        color="error"
                        aria-label={t.employees.contracts.remove}
                        disabled={busy || refreshing}
                        onClick={() => void previewCancellation(contract)}
                      >
                        <PersonOffOutlined />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {impact?.action === 'cancel' && cancellationTarget ? (
            <Stack spacing={1.5}>
              <ContractImpactAlert impact={impact.value} cancellation />
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: 'flex-end' }}
              >
                <Button
                  disabled={busy || refreshing}
                  onClick={() => {
                    setCancellationTarget(null);
                    setImpact(null);
                  }}
                >
                  {t.employees.contracts.cancel}
                </Button>
                <Button
                  color="error"
                  variant="contained"
                  disabled={
                    busy || refreshing || impact.value.lockedMonths.length > 0
                  }
                  onClick={() => void confirmCancellation()}
                >
                  {t.employees.contracts.confirmCancellation}
                </Button>
              </Stack>
            </Stack>
          ) : null}
          {latest?.endDate && !ended ? (
            <Stack
              spacing={1.5}
              sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}
            >
              <Typography variant="h6">
                {t.employees.contracts.endEmployment}
              </Typography>
              <Typography color="text.secondary">
                {t.employees.contracts.endEmploymentDate}: {latest.endDate}
              </Typography>
              <TextField
                label={t.employees.contracts.reason}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <Button
                color="error"
                variant="outlined"
                disabled={busy || refreshing}
                onClick={() => void finishEmployment()}
              >
                {t.employees.contracts.endEmployment}
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.employees.contracts.close}</Button>
      </DialogActions>
    </Dialog>
  );
}

type ContractTranslations = ReturnType<typeof useTranslations>;

// Exported for focused validation tests; the component remains the only UI consumer.
// eslint-disable-next-line react-refresh/only-export-components
export function contractValidationMessage(
  code: 'invalid-range' | 'duplicate' | 'overlap' | undefined,
  t: ContractTranslations,
): string {
  if (code === 'overlap') return t.employees.contracts.errors.overlap;
  if (code === 'duplicate') return t.employees.contracts.errors.duplicate;
  if (code === 'invalid-range') {
    return t.employees.contracts.errors.invalidRange;
  }
  return t.employees.contracts.validation;
}

// eslint-disable-next-line react-refresh/only-export-components
export function contractErrorMessage(
  error: unknown,
  t: ContractTranslations,
): string {
  if (!(error instanceof EmployeeContractServiceError)) {
    return t.employees.contracts.error;
  }
  switch (error.code) {
    case 'overlapping-contract':
      return t.employees.contracts.errors.overlap;
    case 'duplicate-contract':
      return t.employees.contracts.errors.duplicate;
    case 'invalid-contract':
      return t.employees.contracts.errors.invalidRange;
    case 'locked-month':
      return t.employees.contracts.errors.lockedMonth;
    case 'contract-read-failure':
      return t.employees.contracts.errors.contractReadFailure;
    case 'mutation-conflict':
      return t.employees.contracts.errors.mutationConflict;
    case 'invalid-employment-end':
      return t.employees.contracts.errors.invalidEmploymentEnd;
    default:
      return t.employees.contracts.error;
  }
}

function ContractImpactAlert({
  impact,
  cancellation = false,
}: {
  impact: EmployeeContractImpact;
  cancellation?: boolean;
}) {
  const t = useTranslations();
  const locked = impact.lockedMonths.length > 0;
  return (
    <Alert severity={locked ? 'error' : 'warning'}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {cancellation
          ? t.employees.contracts.cancellationImpact
          : t.employees.contracts.editImpact}
      </Typography>
      <Typography variant="body2">
        {t.employees.contracts.openMonths}:{' '}
        {impact.openMonths.join(', ') || t.employees.contracts.none}
      </Typography>
      <Typography variant="body2">
        {t.employees.contracts.lockedMonths}:{' '}
        {impact.lockedMonths.join(', ') || t.employees.contracts.none}
      </Typography>
      <Typography variant="body2">
        {locked
          ? t.employees.contracts.unlockRequired
          : t.employees.contracts.recalculationQueued}
      </Typography>
    </Alert>
  );
}
