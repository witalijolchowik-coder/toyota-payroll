import { useState } from 'react';
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
  KnownPayrollSettingKey,
  MonthId,
  PayrollSettingCreateInput,
} from '../../types/firestore';
import { currentPayrollMonthId } from '../../utils/payroll';
import { validatePayrollSettingInput } from '../../utils/payroll/settings';

const SETTING_OPTIONS: Array<{
  value: KnownPayrollSettingKey;
  label: string;
}> = [
  { value: 'frequency_bonus', label: 'Premia frekwencyjna' },
  { value: 'transport_allowance', label: 'Dodatek transportowy' },
  { value: 'accommodation_allowance', label: 'Zakwaterowanie' },
  { value: 'udt_allowance', label: 'Dodatek UDT' },
];

interface PayrollSettingFormDialogProps {
  onClose: () => void;
  onSubmit: (input: PayrollSettingCreateInput) => Promise<void>;
}

export function PayrollSettingFormDialog({
  onClose,
  onSubmit,
}: PayrollSettingFormDialogProps) {
  const [settingKey, setSettingKey] =
    useState<KnownPayrollSettingKey>('frequency_bonus');
  const [variantKey, setVariantKey] = useState('');
  const [variantName, setVariantName] = useState('');
  const [amount, setAmount] = useState('400');
  const [validFrom, setValidFrom] = useState<MonthId>(() =>
    currentPayrollMonthId(new Date()),
  );
  const [validTo, setValidTo] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const isAccommodation = settingKey === 'accommodation_allowance';

  const buildInput = (): PayrollSettingCreateInput => ({
    settingKey,
    variantKey: isAccommodation ? variantKey : null,
    variantName: isAccommodation ? variantName : null,
    amount: amount.trim() ? Number(amount.replace(',', '.')) : Number.NaN,
    validFrom,
    validTo: validTo || null,
    description,
  });
  const validation = validatePayrollSettingInput(buildInput());

  const handleSubmit = async () => {
    setShowValidation(true);
    if (Object.keys(validation).length > 0) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(false);
    try {
      await onSubmit(buildInput());
      onClose();
    } catch {
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Dodaj wersję ustawienia</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Alert severity="info">
            Nowa wersja nie zmienia wcześniejszych okresów. Dla danego miesiąca
            zostanie użyta najnowsza obowiązująca wersja.
          </Alert>
          {submitError ? (
            <Alert severity="error">
              Nie udało się zapisać wersji. Sprawdź, czy miesiąc początkowy nie
              należy do rozliczonej historii i czy taka wersja już nie istnieje.
            </Alert>
          ) : null}
          <TextField
            select
            label="Ustawienie"
            value={settingKey}
            onChange={(event) => {
              setSettingKey(event.target.value as KnownPayrollSettingKey);
              if (event.target.value === 'frequency_bonus') {
                setAmount('400');
              }
            }}
          >
            {SETTING_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          {isAccommodation ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Kod typu"
                value={variantKey}
                onChange={(event) => setVariantKey(event.target.value)}
                error={showValidation && Boolean(validation.variantKey)}
                helperText="Np. type-a"
                fullWidth
              />
              <TextField
                label="Nazwa typu"
                value={variantName}
                onChange={(event) => setVariantName(event.target.value)}
                error={showValidation && Boolean(validation.variantName)}
                helperText="Np. Typ A"
                fullWidth
              />
            </Stack>
          ) : null}
          <TextField
            label="Kwota brutto (PLN)"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={showValidation && Boolean(validation.amount)}
            helperText={
              showValidation && validation.amount
                ? 'Wprowadź nieujemną kwotę.'
                : 'Wartość może zawierać część dziesiętną.'
            }
            inputMode="decimal"
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="month"
              label="Obowiązuje od"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
              error={showValidation && Boolean(validation.validFrom)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              type="month"
              label="Obowiązuje do"
              value={validTo}
              onChange={(event) => setValidTo(event.target.value)}
              error={showValidation && Boolean(validation.validTo)}
              helperText={
                showValidation && validation.validTo
                  ? 'Koniec nie może poprzedzać początku.'
                  : 'Opcjonalnie'
              }
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
          <TextField
            label="Opis"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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
          Dodaj wersję
        </Button>
      </DialogActions>
    </Dialog>
  );
}
