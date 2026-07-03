import { useMemo, useState } from 'react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

import { PageHeader } from '../components/layout/PageHeader';
import { AdjustmentFormDialog } from '../features/adjustments/AdjustmentFormDialog';
import { useAdjustments } from '../features/adjustments/useAdjustments';
import { MonthSelector } from '../features/settlement/MonthSelector';
import { useNotification } from '../hooks/useNotification';
import type {
  Adjustment,
  AdjustmentCreateInput,
  AdjustmentUpdateInput,
  MonthId,
} from '../types/firestore';
import { previousPayrollMonthId } from '../utils/payroll';

const currency = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

const categoryLabels = {
  MANUAL_BONUS: 'Premia ręczna',
  MANUAL_DEDUCTION: 'Potrącenie ręczne',
  OTHER: 'Inna korekta',
} as const;

type FormState =
  { mode: 'add' } | { mode: 'edit'; adjustment: Adjustment } | null;

export function AdjustmentsPage() {
  const [monthId, setMonthId] = useState<MonthId>(() =>
    previousPayrollMonthId(new Date()),
  );
  const {
    month,
    employees,
    adjustments,
    isLoading,
    error,
    createAdjustment,
    updateAdjustment,
    cancelAdjustment,
  } = useAdjustments(monthId);
  const { notify } = useNotification();
  const [formState, setFormState] = useState<FormState>(null);
  const [cancelTarget, setCancelTarget] = useState<Adjustment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const isWritable = Boolean(month && !month.isSettled);

  const handleSubmit = async (
    input: AdjustmentCreateInput | AdjustmentUpdateInput,
  ) => {
    if (formState?.mode === 'edit') {
      await updateAdjustment(
        formState.adjustment,
        input as AdjustmentUpdateInput,
      );
      notify({
        message: 'Korekta została zaktualizowana.',
        severity: 'success',
      });
      return;
    }
    await createAdjustment(input as AdjustmentCreateInput);
    notify({ message: 'Korekta została dodana.', severity: 'success' });
  };

  const handleCancel = async () => {
    if (!cancelTarget) {
      return;
    }
    setIsCancelling(true);
    try {
      await cancelAdjustment(cancelTarget);
      setCancelTarget(null);
      notify({ message: 'Korekta została anulowana.', severity: 'success' });
    } catch {
      notify({
        message: 'Nie udało się anulować korekty.',
        severity: 'error',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Miesięczne fakty"
        title="Korekty pracowników"
        description="Premie, potrącenia i inne korekty wprowadzone ręcznie przez koordynatora."
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <MonthSelector monthId={monthId} onChange={setMonthId} />
            <Button
              variant="contained"
              startIcon={<AddOutlined />}
              disabled={!isWritable || employees.length === 0}
              onClick={() => setFormState({ mode: 'add' })}
            >
              Dodaj korektę
            </Button>
          </Stack>
        }
      />

      {error ? (
        <Alert severity="error">
          Nie udało się wczytać korekt. Sprawdź Firebase i uprawnienia.
        </Alert>
      ) : null}
      {!isLoading && !month ? (
        <Alert severity="warning">
          Miesiąc {monthId} nie został utworzony. Korekty można dodawać dopiero
          po utworzeniu miesiąca w Rozliczeniu miesięcznym.
        </Alert>
      ) : null}
      {month?.isSettled ? (
        <Alert severity="info">
          Miesiąc jest rozliczony. Korekty są dostępne tylko do odczytu.
        </Alert>
      ) : null}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Pracownik</TableCell>
                <TableCell>Kategoria</TableCell>
                <TableCell>Kierunek</TableCell>
                <TableCell align="right">Kwota</TableCell>
                <TableCell>Notatka</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Akcje</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading
                ? Array.from({ length: 4 }, (_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 7 }, (__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : adjustments.map((adjustment) => {
                    const employee = employeesById.get(adjustment.employeeId);
                    const canEdit =
                      isWritable && adjustment.status === 'ACTIVE';
                    return (
                      <TableRow key={adjustment.id} hover>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700 }}>
                            {employee
                              ? `${employee.lastName} ${employee.firstName}`
                              : adjustment.tetaNumber}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {adjustment.tetaNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {categoryLabels[adjustment.category]}
                        </TableCell>
                        <TableCell>
                          {adjustment.direction === 'INCREASE'
                            ? 'Zwiększenie'
                            : 'Zmniejszenie'}
                        </TableCell>
                        <TableCell align="right">
                          {currency.format(adjustment.amount)}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Typography
                            variant="body2"
                            noWrap
                            title={adjustment.note}
                          >
                            {adjustment.note || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              adjustment.status === 'ACTIVE'
                                ? 'Aktywna'
                                : 'Anulowana'
                            }
                            color={
                              adjustment.status === 'ACTIVE'
                                ? 'success'
                                : 'default'
                            }
                            variant="outlined"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edytuj">
                            <span>
                              <IconButton
                                disabled={!canEdit}
                                onClick={() =>
                                  setFormState({
                                    mode: 'edit',
                                    adjustment,
                                  })
                                }
                              >
                                <EditOutlined />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Anuluj korektę">
                            <span>
                              <IconButton
                                disabled={!canEdit}
                                onClick={() => setCancelTarget(adjustment)}
                              >
                                <BlockOutlined />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </TableContainer>
        {!isLoading && adjustments.length === 0 ? (
          <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
            <Typography variant="h6">Brak korekt w tym miesiącu</Typography>
            <Typography color="text.secondary">
              Premie i potrącenia dodane przez koordynatora pojawią się tutaj.
            </Typography>
          </Box>
        ) : null}
      </Card>

      {formState ? (
        <AdjustmentFormDialog
          adjustment={
            formState.mode === 'edit' ? formState.adjustment : undefined
          }
          employees={employees}
          onClose={() => setFormState(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      {cancelTarget ? (
        <Dialog open onClose={() => setCancelTarget(null)} maxWidth="xs">
          <DialogTitle>Anulować korektę?</DialogTitle>
          <DialogContent>
            Rekord pozostanie w historii ze statusem Anulowana.
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setCancelTarget(null)}
              disabled={isCancelling}
            >
              Wróć
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={isCancelling}
              onClick={() => void handleCancel()}
            >
              Anuluj korektę
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Stack>
  );
}
