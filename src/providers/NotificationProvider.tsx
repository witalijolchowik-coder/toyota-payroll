import { useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import { Alert, Snackbar } from '@mui/material';

import {
  NotificationContext,
  type NotificationOptions,
} from '../contexts/NotificationContext';

interface NotificationState extends Required<NotificationOptions> {
  open: boolean;
}

const initialState: NotificationState = {
  open: false,
  message: '',
  severity: 'info',
  autoHideDuration: 5000,
};

export function NotificationProvider({ children }: PropsWithChildren) {
  const [notification, setNotification] =
    useState<NotificationState>(initialState);

  const notify = useCallback((options: NotificationOptions) => {
    setNotification({
      open: true,
      message: options.message,
      severity: options.severity ?? 'info',
      autoHideDuration: options.autoHideDuration ?? 5000,
    });
  }, []);

  const closeNotification = useCallback(() => {
    setNotification((current) => ({ ...current, open: false }));
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        open={notification.open}
        autoHideDuration={notification.autoHideDuration}
        onClose={closeNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={closeNotification}
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}
