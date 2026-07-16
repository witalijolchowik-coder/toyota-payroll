import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import type {
  Department,
  DepartmentCreateInput,
  DepartmentShiftMode,
  DepartmentUpdateInput,
} from '../../types/firestore';
import {
  CANONICAL_DEPARTMENTS,
  departmentKeyFromName,
  isValidDepartmentName,
  normalizeDepartmentName,
} from '../../utils/organization';

interface DepartmentFormDialogProps {
  department?: Department;
  onClose: () => void;
  onSubmit: (
    input: DepartmentCreateInput | DepartmentUpdateInput,
  ) => Promise<void>;
}

export function DepartmentFormDialog({
  department,
  onClose,
  onSubmit,
}: DepartmentFormDialogProps) {
  const t = useTranslations();
  const [name, setName] = useState(department?.name ?? '');
  const [shiftMode, setShiftMode] = useState<DepartmentShiftMode>(
    department?.shiftMode ?? 'UNKNOWN',
  );
  const [active, setActive] = useState(department?.active ?? true);
  const [showValidation, setShowValidation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const normalizedName = normalizeDepartmentName(name);
  const generatedId = useMemo(
    () => departmentKeyFromName(normalizedName),
    [normalizedName],
  );

  const handleSubmit = async () => {
    setShowValidation(true);
    if (!isValidDepartmentName(name)) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(false);
    try {
      await onSubmit(
        department
          ? {
              name: normalizedName,
              shiftMode,
              active,
            }
          : {
              id: generatedId,
              name: normalizedName,
              shiftMode,
              active,
            },
      );
      onClose();
    } catch {
      setSubmitError(true);
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
        {department
          ? t.organization.departments.form.editTitle
          : t.organization.departments.form.addTitle}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Alert severity="info">
            {t.organization.departments.form.description}
          </Alert>
          {submitError ? (
            <Alert severity="error">
              {t.organization.departments.form.saveFailed}
            </Alert>
          ) : null}
          <TextField
            select
            required
            label={t.organization.departments.form.name}
            value={name}
            disabled={Boolean(department)}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              const definition = CANONICAL_DEPARTMENTS.find(
                (item) => item.name === nextName,
              );
              if (definition) setShiftMode(definition.shiftMode);
            }}
            error={showValidation && !isValidDepartmentName(name)}
            helperText={
              showValidation && !isValidDepartmentName(name)
                ? t.organization.departments.form.required
                : t.organization.departments.form.canonicalOnly
            }
          >
            {CANONICAL_DEPARTMENTS.map((item) => (
              <MenuItem key={item.id} value={item.name}>
                {item.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t.organization.departments.form.shiftMode}
            value={shiftMode}
            onChange={(event) =>
              setShiftMode(event.target.value as DepartmentShiftMode)
            }
          >
            <MenuItem value="UNKNOWN">
              {t.organization.shiftModes.UNKNOWN}
            </MenuItem>
            <MenuItem value="TWO_SHIFT">
              {t.organization.shiftModes.TWO_SHIFT}
            </MenuItem>
            <MenuItem value="THREE_SHIFT">
              {t.organization.shiftModes.THREE_SHIFT}
            </MenuItem>
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
            }
            label={t.organization.departments.form.active}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          {t.organization.departments.form.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
        >
          {department
            ? t.organization.departments.form.save
            : t.organization.departments.form.create}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
