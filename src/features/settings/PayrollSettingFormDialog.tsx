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
  FrequencyBonusThresholdScale,
  KnownPayrollSettingKey,
  MonthId,
  PayrollSetting,
  PayrollSettingCreateInput,
} from '../../types/firestore';
import { currentPayrollMonthId } from '../../utils/payroll';
import {
  DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE,
  defaultPayrollSettingTaxType,
  planPayrollSettingVersion,
  validatePayrollSettingInput,
} from '../../utils/payroll/settings';
import { useTranslations } from '../../hooks/useTranslations';
import type { PayrollSettingEditImpact } from '../../services/payrollSettingsService';

interface PayrollSettingFormDialogProps {
  allowedKeys?: KnownPayrollSettingKey[];
  initialKey?: KnownPayrollSettingKey;
  settings?: PayrollSetting[];
  existingSetting?: PayrollSetting;
  onClose: () => void;
  onSubmit: (input: PayrollSettingCreateInput) => Promise<void>;
  onPreview?: (
    input: PayrollSettingCreateInput,
  ) => Promise<PayrollSettingEditImpact>;
}

function defaultAmountForSetting(key: KnownPayrollSettingKey): string {
  if (key === 'transport_allowance') return '275';
  if (key === 'laundry_allowance') return '40';
  if (key === 'own_housing_allowance') return '300';
  if (key === 'housing_deposit') return '99';
  return '400';
}

function formatThresholdScale(
  scale: FrequencyBonusThresholdScale | null | undefined,
): string {
  if (!scale) return '';
  return ([0, 1, 2, 3, 4] as const)
    .map(
      (threshold) =>
        `${threshold === 4 ? '4+' : threshold} L4: ${scale[threshold]} PLN`,
    )
    .join(' · ');
}

export function PayrollSettingFormDialog({
  allowedKeys,
  initialKey,
  settings = [],
  existingSetting,
  onClose,
  onSubmit,
  onPreview,
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
    (existingSetting?.settingKey as KnownPayrollSettingKey) ??
      initialKey ??
      settingOptions[0]?.value ??
      'frequency_bonus',
  );
  const [variantKey, setVariantKey] = useState(
    existingSetting?.variantKey ?? '',
  );
  const [variantName, setVariantName] = useState(
    existingSetting?.variantName ?? '',
  );
  const [amount, setAmount] = useState(() =>
    existingSetting
      ? String(existingSetting.amount)
      : defaultAmountForSetting(settingKey),
  );
  const initialThresholdScale =
    existingSetting?.thresholdScale ?? DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE;
  const [thresholdScale, setThresholdScale] = useState<
    Record<keyof FrequencyBonusThresholdScale, string>
  >({
    0: String(initialThresholdScale[0]),
    1: String(initialThresholdScale[1]),
    2: String(initialThresholdScale[2]),
    3: String(initialThresholdScale[3]),
    4: String(initialThresholdScale[4]),
  });
  const [taxType, setTaxType] = useState<'GROSS' | 'NET'>(
    () => existingSetting?.taxType ?? defaultPayrollSettingTaxType(settingKey),
  );
  const [validFrom, setValidFrom] = useState<MonthId>(
    () => existingSetting?.validFrom ?? currentPayrollMonthId(new Date()),
  );
  const [validTo, setValidTo] = useState(existingSetting?.validTo ?? '');
  const [description, setDescription] = useState(
    existingSetting?.description ?? '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [impactConfirmed, setImpactConfirmed] = useState(false);
  const [editImpact, setEditImpact] = useState<PayrollSettingEditImpact | null>(
    null,
  );
  const isAccommodation = settingKey === 'accommodation_allowance';
  const isFrequencyBonus = settingKey === 'frequency_bonus';
  const parsedThresholdScale: FrequencyBonusThresholdScale = {
    0: Number(thresholdScale[0].replace(',', '.')),
    1: Number(thresholdScale[1].replace(',', '.')),
    2: Number(thresholdScale[2].replace(',', '.')),
    3: Number(thresholdScale[3].replace(',', '.')),
    4: Number(thresholdScale[4].replace(',', '.')),
  };

  const buildInput = (): PayrollSettingCreateInput => ({
    settingKey,
    variantKey: isAccommodation ? variantKey : null,
    variantName: isAccommodation ? variantName : null,
    amount: isFrequencyBonus
      ? parsedThresholdScale[0]
      : amount.trim()
        ? Number(amount.replace(',', '.'))
        : Number.NaN,
    thresholdScale: isFrequencyBonus ? parsedThresholdScale : null,
    taxType,
    validFrom,
    validTo: validTo || null,
    description,
  });
  const validation = validatePayrollSettingInput(buildInput());
  const lifecyclePlan = existingSetting
    ? {
        blockedReason: null,
        requiresConfirmation: true,
        versionsToShorten: [],
      }
    : planPayrollSettingVersion(settings, buildInput());

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
      if (existingSetting && onPreview) {
        setIsSubmitting(true);
        try {
          const impact = await onPreview(buildInput());
          setEditImpact(impact);
          setImpactConfirmed(
            impact.lockedMonths.length === 0 &&
              impact.overlappingVersionIds.length === 0,
          );
        } catch {
          setSubmitError(true);
        } finally {
          setIsSubmitting(false);
        }
      } else {
        setImpactConfirmed(true);
      }
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
      <DialogTitle>
        {existingSetting
          ? t.settings.settingForm.editTitle
          : t.settings.settingForm.title}
      </DialogTitle>
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
            disabled={Boolean(existingSetting)}
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
              setThresholdScale({
                0: String(DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE[0]),
                1: String(DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE[1]),
                2: String(DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE[2]),
                3: String(DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE[3]),
                4: String(DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE[4]),
              });
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
          {isFrequencyBonus ? (
            <Stack spacing={1}>
              <Typography variant="subtitle2">
                {t.settings.settingForm.frequencyScale}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: 'flex-start' }}
              >
                {([0, 1, 2, 3, 4] as const).map((threshold) => (
                  <TextField
                    key={threshold}
                    label={
                      threshold === 4
                        ? t.settings.settingForm.frequencyFourOrMore
                        : `${threshold} L4`
                    }
                    value={thresholdScale[threshold]}
                    onChange={(event) =>
                      setThresholdScale((current) => ({
                        ...current,
                        [threshold]: event.target.value,
                      }))
                    }
                    error={showValidation && Boolean(validation.thresholdScale)}
                    inputMode="decimal"
                    fullWidth
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {t.settings.settingForm.frequencyScaleHelper}
              </Typography>
            </Stack>
          ) : (
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
          )}
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
          {existingSetting && editImpact ? (
            <Alert
              severity={
                editImpact.lockedMonths.length ||
                editImpact.overlappingVersionIds.length
                  ? 'error'
                  : 'warning'
              }
            >
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {t.settings.settingForm.editImpactTitle}
              </Typography>
              <Typography variant="body2">
                {t.settings.settingForm.currentValues}:{' '}
                {existingSetting.settingKey === 'frequency_bonus'
                  ? formatThresholdScale(
                      existingSetting.thresholdScale ??
                        DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE,
                    )
                  : `${existingSetting.amount} PLN`}{' '}
                · {existingSetting.taxType}, {existingSetting.validFrom} –{' '}
                {existingSetting.validTo ?? '∞'}
              </Typography>
              <Typography variant="body2">
                {t.settings.settingForm.proposedValues}:{' '}
                {isFrequencyBonus
                  ? formatThresholdScale(buildInput().thresholdScale)
                  : `${buildInput().amount} PLN`}{' '}
                · {buildInput().taxType}, {buildInput().validFrom} –{' '}
                {buildInput().validTo ?? '∞'}
              </Typography>
              <Typography variant="body2">
                {t.settings.settingForm.openMonths}:{' '}
                {editImpact.openMonths.join(', ') ||
                  t.settings.settingForm.none}
              </Typography>
              <Typography variant="body2">
                {t.settings.settingForm.lockedMonths}:{' '}
                {editImpact.lockedMonths.join(', ') ||
                  t.settings.settingForm.none}
              </Typography>
              {editImpact.overlappingVersionIds.length > 0 ? (
                <Typography variant="body2">
                  {t.settings.settingForm.overlappingVersions}:{' '}
                  {editImpact.overlappingVersionIds.join(', ')}
                </Typography>
              ) : null}
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
          disabled={
            isSubmitting ||
            Boolean(
              existingSetting &&
              editImpact &&
              (editImpact.lockedMonths.length ||
                editImpact.overlappingVersionIds.length),
            )
          }
        >
          {lifecyclePlan.requiresConfirmation && !impactConfirmed
            ? t.settings.settingForm.preview
            : existingSetting
              ? t.settings.settingForm.saveEdit
              : t.settings.settingForm.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
