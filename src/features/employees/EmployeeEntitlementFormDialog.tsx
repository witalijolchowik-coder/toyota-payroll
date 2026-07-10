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

import { useTranslations } from '../../hooks/useTranslations';
import type {
  Employee,
  EmployeeEntitlement,
  EmployeeEntitlementCreateInput,
  EmployeeEntitlementType,
  PayrollSetting,
} from '../../types/firestore';
import {
  validateEmployeeEntitlementInput,
  type EmployeeEntitlementValidationError,
} from './employeeEntitlementValidation';

interface EmployeeEntitlementFormDialogProps {
  entitlement?: EmployeeEntitlement;
  employees: Employee[];
  entitlements: EmployeeEntitlement[];
  accommodationVariants: PayrollSetting[];
  onClose: () => void;
  onSubmit: (input: EmployeeEntitlementCreateInput) => Promise<void>;
}

const entitlementTypes: EmployeeEntitlementType[] = [
  'UDT',
  'OWN_HOUSING_ALLOWANCE',
  'COMPANY_ACCOMMODATION',
];

export function EmployeeEntitlementFormDialog({
  entitlement,
  employees,
  entitlements,
  accommodationVariants,
  onClose,
  onSubmit,
}: EmployeeEntitlementFormDialogProps) {
  const t = useTranslations();
  const [employeeId, setEmployeeId] = useState(
    entitlement?.employeeId ?? employees[0]?.id ?? '',
  );
  const selectedEmployee = employees.find(
    (employee) => employee.id === employeeId,
  );
  const [type, setType] = useState<EmployeeEntitlementType>(
    entitlement?.type ?? 'UDT',
  );
  const [variantKey, setVariantKey] = useState(
    entitlement?.accommodationVariantKey ?? '',
  );
  const [validFrom, setValidFrom] = useState(entitlement?.validFrom ?? '');
  const [validTo, setValidTo] = useState(entitlement?.validTo ?? '');
  const [note, setNote] = useState(entitlement?.note ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);

  const input: EmployeeEntitlementCreateInput = {
    employeeId,
    tetaNumber: selectedEmployee?.tetaNumber ?? '',
    type,
    accommodationVariantKey:
      type === 'COMPANY_ACCOMMODATION' ? variantKey || null : null,
    validFrom,
    validTo: validTo || null,
    note: note.trim() || null,
  };
  const validation = validateEmployeeEntitlementInput(
    input,
    entitlements.filter((item) => item.id !== entitlement?.id),
  );
  const validationMessage = (code: EmployeeEntitlementValidationError) =>
    showValidation && validation.includes(code)
      ? t.employees.entitlements.form.validation[code]
      : undefined;

  const handleSubmit = async () => {
    setShowValidation(true);
    setSubmitFailed(false);
    if (validation.length > 0) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(input);
      onClose();
    } catch {
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {entitlement
          ? t.employees.entitlements.form.editTitle
          : t.employees.entitlements.form.addTitle}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {submitFailed ? (
            <Alert severity="error">
              {t.employees.entitlements.errors.saveFailed}
            </Alert>
          ) : null}
          <TextField
            select
            label={t.employees.entitlements.form.employee}
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            disabled={Boolean(entitlement)}
            error={Boolean(validationMessage('employee-required'))}
            helperText={validationMessage('employee-required')}
          >
            {employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.tetaNumber} · {employee.lastName} {employee.firstName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t.employees.entitlements.form.type}
            value={type}
            onChange={(event) => {
              setType(event.target.value as EmployeeEntitlementType);
              setVariantKey('');
            }}
            disabled={Boolean(entitlement)}
          >
            {entitlementTypes.map((option) => (
              <MenuItem key={option} value={option}>
                {t.employees.entitlements.types[option]}
              </MenuItem>
            ))}
          </TextField>
          {type === 'COMPANY_ACCOMMODATION' ? (
            <TextField
              select
              label={t.employees.entitlements.form.variant}
              value={variantKey}
              onChange={(event) => setVariantKey(event.target.value)}
              disabled={Boolean(entitlement)}
              error={Boolean(validationMessage('variant-required'))}
              helperText={
                validationMessage('variant-required') ??
                (accommodationVariants.length === 0
                  ? t.employees.entitlements.form.noVariants
                  : undefined)
              }
            >
              {accommodationVariants.map((setting) => (
                <MenuItem key={setting.id} value={setting.variantKey ?? ''}>
                  {setting.variantName ?? setting.variantKey}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="date"
              label={t.employees.entitlements.form.validFrom}
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
              disabled={Boolean(entitlement)}
              error={Boolean(validationMessage('date-required'))}
              helperText={validationMessage('date-required')}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              type="date"
              label={t.employees.entitlements.form.validTo}
              value={validTo}
              onChange={(event) => setValidTo(event.target.value)}
              error={Boolean(validationMessage('invalid-date-range'))}
              helperText={
                validationMessage('invalid-date-range') ??
                t.employees.entitlements.form.optionalEnd
              }
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
          {validationMessage('housing-conflict') ? (
            <Alert severity="warning">
              {validationMessage('housing-conflict')}
            </Alert>
          ) : null}
          <TextField
            label={t.employees.entitlements.form.note}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          {t.employees.entitlements.form.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
        >
          {entitlement
            ? t.employees.entitlements.form.save
            : t.employees.entitlements.form.create}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
