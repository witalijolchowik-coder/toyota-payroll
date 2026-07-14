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
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import type {
  Employee,
  EmployeeEntitlement,
  EmployeeEntitlementCreateInput,
  PayrollSetting,
} from '../../types/firestore';

interface EmployeeAccommodationDialogProps {
  employee: Employee;
  currentAccommodation: EmployeeEntitlement | null;
  entitlements: EmployeeEntitlement[];
  accommodationVariants: PayrollSetting[];
  onClose: () => void;
  onMoveIn: (input: EmployeeEntitlementCreateInput) => Promise<void>;
  onMoveOut: (
    entitlement: EmployeeEntitlement,
    firstDayOutside: string,
  ) => Promise<void>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EmployeeAccommodationDialog({
  employee,
  currentAccommodation,
  entitlements,
  accommodationVariants,
  onClose,
  onMoveIn,
  onMoveOut,
}: EmployeeAccommodationDialogProps) {
  const t = useTranslations();
  const isMoveOut = Boolean(currentAccommodation);
  const [effectiveDate, setEffectiveDate] = useState(todayIso);
  const [variantKey, setVariantKey] = useState(
    accommodationVariants[0]?.variantKey ?? '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const overlaps = useMemo(
    () =>
      !isMoveOut &&
      entitlements.some(
        (item) =>
          item.employeeId === employee.id &&
          item.status === 'ACTIVE' &&
          item.validFrom <= '9999-12-31' &&
          (item.validTo ?? '9999-12-31') >= effectiveDate &&
          (item.type === 'COMPANY_ACCOMMODATION' ||
            item.type === 'OWN_HOUSING_ALLOWANCE'),
      ),
    [effectiveDate, employee.id, entitlements, isMoveOut],
  );
  const invalidMoveOut = Boolean(
    currentAccommodation && effectiveDate <= currentAccommodation.validFrom,
  );
  const invalid =
    !effectiveDate || (!isMoveOut && !variantKey) || overlaps || invalidMoveOut;

  const submit = async () => {
    setShowValidation(true);
    setSaveFailed(false);
    if (invalid) return;
    setIsSubmitting(true);
    try {
      if (currentAccommodation) {
        await onMoveOut(currentAccommodation, effectiveDate);
      } else {
        await onMoveIn({
          employeeId: employee.id,
          tetaNumber: employee.tetaNumber,
          type: 'COMPANY_ACCOMMODATION',
          accommodationVariantKey: variantKey,
          validFrom: effectiveDate,
          validTo: null,
          note: null,
        });
      }
      onClose();
    } catch (error) {
      console.error(error);
      setSaveFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        {isMoveOut
          ? t.employees.accommodation.moveOutTitle
          : t.employees.accommodation.moveInTitle}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography color="text.secondary">
            {employee.lastName} {employee.firstName}
          </Typography>
          {saveFailed ? (
            <Alert severity="error">
              {t.employees.accommodation.saveFailed}
            </Alert>
          ) : null}
          {showValidation && overlaps ? (
            <Alert severity="error">{t.employees.accommodation.overlap}</Alert>
          ) : null}
          <TextField
            required
            type="date"
            label={
              isMoveOut
                ? t.employees.accommodation.moveOutDate
                : t.employees.accommodation.moveInDate
            }
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
            error={showValidation && (!effectiveDate || invalidMoveOut)}
            helperText={
              isMoveOut
                ? t.employees.accommodation.moveOutDateHelper
                : t.employees.accommodation.moveInDateHelper
            }
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {!isMoveOut ? (
            <TextField
              required
              select
              label={t.employees.accommodation.category}
              value={variantKey}
              onChange={(event) => setVariantKey(event.target.value)}
              error={showValidation && !variantKey}
              helperText={
                accommodationVariants.length === 0
                  ? t.employees.accommodation.noCategories
                  : undefined
              }
            >
              {accommodationVariants.map((setting) => (
                <MenuItem key={setting.id} value={setting.variantKey ?? ''}>
                  {setting.variantName ?? setting.variantKey}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          {t.employees.accommodation.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={isSubmitting}
        >
          {isMoveOut
            ? t.employees.accommodation.confirmMoveOut
            : t.employees.accommodation.confirmMoveIn}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
