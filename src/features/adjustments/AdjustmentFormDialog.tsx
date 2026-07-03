import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';

import type {
  Adjustment,
  AdjustmentCategory,
  AdjustmentCreateInput,
  AdjustmentDirection,
  AdjustmentUpdateInput,
  Employee,
} from '../../types/firestore';
import {
  directionForAdjustmentCategory,
  validateAdjustmentInput,
} from './adjustmentValidation';

interface AdjustmentFormDialogProps {
  adjustment?: Adjustment;
  employees: Employee[];
  onClose: () => void;
  onSubmit: (
    input: AdjustmentCreateInput | AdjustmentUpdateInput,
  ) => Promise<void>;
}

export function AdjustmentFormDialog({
  adjustment,
  employees,
  onClose,
  onSubmit,
}: AdjustmentFormDialogProps) {
  const [employeeId, setEmployeeId] = useState(
    adjustment?.employeeId ?? employees[0]?.id ?? '',
  );
  const [category, setCategory] = useState<AdjustmentCategory>(
    adjustment?.category ?? 'MANUAL_BONUS',
  );
  const [direction, setDirection] = useState<AdjustmentDirection>(
    adjustment?.direction ?? 'INCREASE',
  );
  const [amount, setAmount] = useState(
    adjustment ? String(adjustment.amount) : '',
  );
  const [note, setNote] = useState(adjustment?.note ?? '');
  const [showValidation, setShowValidation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const employee = useMemo(
    () => employees.find((item) => item.id === employeeId),
    [employeeId, employees],
  );
  const fixedDirection = directionForAdjustmentCategory(category);

  const completeInput: AdjustmentCreateInput = {
    employeeId: employee?.id ?? '',
    tetaNumber: employee?.tetaNumber ?? '',
    category,
    direction,
    amount: amount.trim() ? Number(amount.replace(',', '.')) : Number.NaN,
    note,
  };
  const validation = validateAdjustmentInput(completeInput);

  const handleSubmit = async () => {
    setShowValidation(true);
    if (Object.keys(validation).length > 0) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(false);
    try {
      await onSubmit(
        adjustment
          ? { category, direction, amount: completeInput.amount, note }
          : completeInput,
      );
      onClose();
    } catch {
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {adjustment ? 'Edytuj korektę' : 'Dodaj korektę pracownika'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {submitError ? (
            <Alert severity="error">
              Nie udało się zapisać korekty. Miesiąc mógł zostać rozliczony.
            </Alert>
          ) : null}
          <TextField
            select
            label="Pracownik"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            disabled={Boolean(adjustment)}
            error={showValidation && Boolean(validation.employeeId)}
          >
            {employees.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.lastName} {item.firstName} · {item.tetaNumber}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Kategoria"
            value={category}
            onChange={(event) => {
              const nextCategory = event.target.value as AdjustmentCategory;
              setCategory(nextCategory);
              const nextDirection =
                directionForAdjustmentCategory(nextCategory);
              if (nextDirection) {
                setDirection(nextDirection);
              }
            }}
          >
            <MenuItem value="MANUAL_BONUS">Premia ręczna</MenuItem>
            <MenuItem value="MANUAL_DEDUCTION">Potrącenie ręczne</MenuItem>
            <MenuItem value="OTHER">Inna korekta</MenuItem>
          </TextField>
          <TextField
            select
            label="Kierunek"
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as AdjustmentDirection)
            }
            disabled={Boolean(fixedDirection)}
          >
            <MenuItem value="INCREASE">Zwiększenie</MenuItem>
            <MenuItem value="DECREASE">Zmniejszenie</MenuItem>
          </TextField>
          <TextField
            label="Kwota (PLN)"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={showValidation && Boolean(validation.amount)}
            helperText={
              showValidation && validation.amount
                ? 'Kwota musi być nieujemną liczbą.'
                : undefined
            }
            inputMode="decimal"
          />
          <TextField
            label="Notatka"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Anuluj
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
        >
          Zapisz
        </Button>
      </DialogActions>
    </Dialog>
  );
}
