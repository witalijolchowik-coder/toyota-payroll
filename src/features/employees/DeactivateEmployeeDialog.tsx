import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type { Employee } from '../../types/firestore';

interface DeactivateEmployeeDialogProps {
  employee: Employee;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeactivateEmployeeDialog({
  employee,
  isSubmitting,
  onClose,
  onConfirm,
}: DeactivateEmployeeDialogProps) {
  const t = useTranslations();
  const employeeName = `${employee.firstName} ${employee.lastName}`;

  return (
    <Dialog open onClose={isSubmitting ? undefined : onClose} maxWidth="xs">
      <DialogTitle>{t.employees.deactivate.title}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">
          {interpolate(t.employees.deactivate.description, {
            name: employeeName,
          })}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          {t.employees.deactivate.cancel}
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={isSubmitting}
        >
          {t.employees.deactivate.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
