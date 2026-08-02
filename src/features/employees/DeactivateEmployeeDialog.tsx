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
  action: 'deactivate' | 'reactivate';
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeactivateEmployeeDialog({
  employee,
  action,
  isSubmitting,
  onClose,
  onConfirm,
}: DeactivateEmployeeDialogProps) {
  const t = useTranslations();
  const employeeName = `${employee.firstName} ${employee.lastName}`;
  const copy =
    action === 'deactivate' ? t.employees.deactivate : t.employees.reactivate;

  return (
    <Dialog open onClose={isSubmitting ? undefined : onClose} maxWidth="xs">
      <DialogTitle>{copy.title}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">
          {interpolate(copy.description, {
            name: employeeName,
          })}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          {copy.cancel}
        </Button>
        <Button
          onClick={onConfirm}
          color={action === 'deactivate' ? 'error' : 'primary'}
          variant="contained"
          disabled={isSubmitting}
        >
          {copy.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
