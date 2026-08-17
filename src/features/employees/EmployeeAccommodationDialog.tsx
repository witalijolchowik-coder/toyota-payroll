import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { ExactDateField } from '../../components/forms/ExactDateTimeField';
import { useTranslations } from '../../hooks/useTranslations';
import type {
  Employee,
  EmployeeEntitlement,
  EmployeeEntitlementCreateInput,
  PayrollSetting,
} from '../../types/firestore';
import { isCanonicalExactDate } from '../../utils/forms/exactDateTimeInput';
import { resolveEmploymentLifecyclePeriods } from '../../utils/employees';
import { resolveEmployeeHousingHistory } from '../../utils/payroll';

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

function defaultMoveInDate(employee: Employee): string {
  return (
    resolveEmploymentLifecyclePeriods(employee)[0]?.startDate ?? todayIso()
  );
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
  const [effectiveDate, setEffectiveDate] = useState(() =>
    isMoveOut ? todayIso() : defaultMoveInDate(employee),
  );
  const [variantKey, setVariantKey] = useState(
    accommodationVariants[0]?.variantKey ?? '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const housingHistory = useMemo(
    () => resolveEmployeeHousingHistory({ employee, entitlements }),
    [employee, entitlements],
  );
  const variantsByKey = useMemo(
    () =>
      new Map(
        accommodationVariants.map((setting) => [
          setting.variantKey,
          setting.variantName ?? setting.variantKey,
        ]),
      ),
    [accommodationVariants],
  );
  const overlaps = useMemo(
    () =>
      !isMoveOut &&
      entitlements.some(
        (item) =>
          item.employeeId === employee.id &&
          item.status === 'ACTIVE' &&
          item.validFrom <= '9999-12-31' &&
          (item.validTo ?? '9999-12-31') >= effectiveDate &&
          item.type === 'COMPANY_ACCOMMODATION',
      ),
    [effectiveDate, employee.id, entitlements, isMoveOut],
  );
  const invalidMoveOut = Boolean(
    currentAccommodation && effectiveDate <= currentAccommodation.validFrom,
  );
  const invalid =
    !isCanonicalExactDate(effectiveDate) ||
    (!isMoveOut && !variantKey) ||
    overlaps ||
    invalidMoveOut;

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
      maxWidth="md"
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
          <ExactDateField
            required
            label={
              isMoveOut
                ? t.employees.accommodation.moveOutDate
                : t.employees.accommodation.moveInDate
            }
            value={effectiveDate}
            onValueChange={setEffectiveDate}
            error={showValidation && (!effectiveDate || invalidMoveOut)}
            helperText={
              isMoveOut
                ? t.employees.accommodation.moveOutDateHelper
                : t.employees.accommodation.moveInDateHelper
            }
            invalidMessage={t.input.exactDateInvalid}
            pickerLabel={t.input.openDatePicker}
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
          <Stack spacing={1}>
            <Typography variant="subtitle2">
              {t.employees.accommodation.history.title}
            </Typography>
            {housingHistory.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                {t.employees.accommodation.history.empty}
              </Typography>
            ) : (
              <TableContainer>
                <Table
                  size="small"
                  aria-label={t.employees.accommodation.history.title}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        {t.employees.accommodation.history.period}
                      </TableCell>
                      <TableCell>
                        {t.employees.accommodation.history.type}
                      </TableCell>
                      <TableCell>
                        {t.employees.accommodation.history.category}
                      </TableCell>
                      <TableCell>
                        {t.employees.accommodation.history.status}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {housingHistory.map((period) => (
                      <TableRow key={`${period.id}:${period.validFrom}`}>
                        <TableCell>
                          {period.validFrom} –{' '}
                          {period.validTo ??
                            t.employees.accommodation.history.openEnded}
                        </TableCell>
                        <TableCell>
                          {period.type === 'COMPANY'
                            ? t.employees.accommodation.history.company
                            : t.employees.accommodation.history.own}
                        </TableCell>
                        <TableCell>
                          {period.variantKey
                            ? (variantsByKey.get(period.variantKey) ??
                              period.variantKey)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {period.current ? (
                            <Chip
                              size="small"
                              color="success"
                              variant="outlined"
                              label={t.employees.accommodation.history.current}
                            />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
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
