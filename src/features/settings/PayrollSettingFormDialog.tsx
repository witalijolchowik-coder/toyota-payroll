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
  Typography,
} from '@mui/material';

import type {
  KnownPayrollSettingKey,
  MonthId,
  PayrollSetting,
  PayrollSettingCreateInput,
} from '../../types/firestore';
import { currentPayrollMonthId } from '../../utils/payroll';
import {
  defaultPayrollSettingTaxType,
  planPayrollSettingVersion,
  validatePayrollSettingInput,
} from '../../utils/payroll/settings';
import { useTranslations } from '../../hooks/useTranslations';

interface PayrollSettingFormDialogProps {
  allowedKeys?: KnownPayrollSettingKey[];
  initialKey?: KnownPayrollSettingKey;
  settings?: PayrollSetting[];
  onClose: () => void;
  onSubmit: (input: PayrollSettingCreateInput) => Promise<void>;
}

function defaultAmountForSetting(key: KnownPayrollSettingKey): string {
  if (key === 'transport_allowance') return '275';
  if (key === 'laundry_allowance') return '40';
  if (key === 'own_housing_allowance') return '300';
  if (key === 'housing_deposit') return '99';
  return '400';
}

export function PayrollSettingFormDialog({
  allowedKeys,
  initialKey,
  settings = [],
  onClose,
  onSubmit,
}: PayrollSettingFormDialogProps) {
  const t = useTranslations();
  const allOptions: Array<{ value: KnownPayrollSettingKey; label: string }> = [
    {
      value: 'frequency_bonus',
      label: t.settings.settingForm.options.frequencyBonus,
    },
    {
      value: 'transport_allowance',
      label: t.settings.settingForm.options.transport,
    },
    {
      value: 'accommodation_allowance',
      label: t.settings.settingForm.options.accommodation,
    },
    { value: 'udt_allowance', label: t.settings.settingForm.options.udt },
    {
      value: 'holiday_work_bonus',
      label: t.settings.settingForm.options.holidayWork,
    },
    {
      value: 'laundry_allowance',
      label: t.settings.settingForm.options.laundry,
    },
    {
      value: 'own_housing_allowance',
      label: t.settings.settingForm.options.ownHousing,
    },
    {
      value: 'company_housing_media',
      label: t.settings.settingForm.options.companyMedia,
    },
    {
      value: 'housing_deposit',
      label: t.settings.settingForm.options.housingDeposit,
    },
  ];
  const settingOptions = allowedKeys
    ? allOptions.filter((option) => allowedKeys.includes(option.value))
    : allOptions;
  const [settingKey, setSettingKey] = useState<KnownPayrollSettingKey>(
    initialKey ?? settingOptions[0]?.value ?? 'frequency_bonus',
  );
  const [variantKey, setVariantKey] = useState('');
  const [variantName, setVariantName] = useState('');
  const [amount, setAmount] = useState(() =>
    defaultAmountForSetting(settingKey),
  );
  const [taxType, setTaxType] = useState<'GROSS' | 'NET'>(() =>
    defaultPayrollSettingTaxType(settingKey),
  );
  const [validFrom, setValidFrom] = useState<MonthId>(() =>
    currentPayrollMonthId(new Date()),
  );
  const [validTo, setValidTo] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [impactConfirmed, setImpactConfirmed] = useState(false);
  const isAccommodation = settingKey === 'accommodation_allowance';

  const buildInput = (): PayrollSettingCreateInput => ({
    settingKey,
    variantKey: isAccommodation ? variantKey : null,
    variantName: isAccommodation ? variantName : null,
    amount: amount.trim() ? Number(amount.replace(',', '.')) : Number.NaN,
    taxType,
    validFrom,
    validTo: validTo || null,
    description,
  });
  const validation = validatePayrollSettingInput(buildInput());
  const lifecyclePlan = planPayrollSettingVersion(settings, buildInput());

  const handleSubmit = async () => {
    setShowValidation(true);
    if (Object.keys(validation).length > 0) {
      return;
    }
    if (lifecyclePlan.blockedReason) {
      setSubmitError(true);
      return;
    }
    if (lifecyclePlan.requiresConfirmation && !impactConfirmed) {
      setImpactConfirmed(true);
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
      <DialogTitle>{t.settings.settingForm.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Alert severity="info">{t.settings.settingForm.versionInfo}</Alert>
          {submitError ? (
            <Alert severity="error">{t.settings.settingForm.saveFailed}</Alert>
          ) : null}
          <TextField
            select
            label={t.settings.settingForm.setting}
            value={settingKey}
            onChange={(event) => {
              setSettingKey(event.target.value as KnownPayrollSettingKey);
              setTaxType(
                defaultPayrollSettingTaxType(event.target.value) as
                  'GROSS' | 'NET',
              );
              setImpactConfirmed(false);
              setAmount(
                defaultAmountForSetting(
                  event.target.value as KnownPayrollSettingKey,
                ),
              );
            }}
          >
            {settingOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          {isAccommodation ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t.settings.settingForm.variantKey}
                value={variantKey}
                onChange={(event) => setVariantKey(event.target.value)}
                error={showValidation && Boolean(validation.variantKey)}
                helperText={t.settings.settingForm.variantKeyHelper}
                fullWidth
              />
              <TextField
                label={t.settings.settingForm.variantName}
                value={variantName}
                onChange={(event) => setVariantName(event.target.value)}
                error={showValidation && Boolean(validation.variantName)}
                helperText={t.settings.settingForm.variantNameHelper}
                fullWidth
              />
            </Stack>
          ) : null}
          <TextField
            label={t.settings.settingForm.amount}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={showValidation && Boolean(validation.amount)}
            helperText={
              showValidation && validation.amount
                ? t.settings.settingForm.invalidAmount
                : t.settings.settingForm.amountHelper
            }
            inputMode="decimal"
          />
          <TextField
            select
            label={t.settings.settingForm.tax}
            value={taxType}
            onChange={(event) =>
              setTaxType(event.target.value as 'GROSS' | 'NET')
            }
          >
            <MenuItem value="GROSS">{t.settings.settingForm.gross}</MenuItem>
            <MenuItem value="NET">{t.settings.settingForm.net}</MenuItem>
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="month"
              label={t.settings.settingForm.validFrom}
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
              error={showValidation && Boolean(validation.validFrom)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              type="month"
              label={t.settings.settingForm.validTo}
              value={validTo}
              onChange={(event) => setValidTo(event.target.value)}
              error={showValidation && Boolean(validation.validTo)}
              helperText={
                showValidation && validation.validTo
                  ? t.settings.settingForm.invalidRange
                  : t.settings.settingForm.optional
              }
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
          <TextField
            label={t.settings.settingForm.description}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={2}
          />
          {lifecyclePlan.requiresConfirmation ? (
            <Alert severity={lifecyclePlan.blockedReason ? 'error' : 'warning'}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {t.settings.settingForm.impactTitle}
              </Typography>
              <Typography variant="body2">
                {lifecyclePlan.blockedReason
                  ? t.settings.settingForm.complexOverlap
                  : t.settings.settingForm.impactDescription}
              </Typography>
              {lifecyclePlan.versionsToShorten.map(({ setting, validTo }) => (
                <Typography key={setting.id} variant="body2">
                  {setting.validFrom} – {setting.validTo ?? '∞'} →{' '}
                  {setting.validFrom} – {validTo}
                </Typography>
              ))}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          {t.settings.settingForm.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
        >
          {lifecyclePlan.requiresConfirmation && !impactConfirmed
            ? t.settings.settingForm.preview
            : t.settings.settingForm.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
