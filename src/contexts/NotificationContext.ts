import { createContext } from 'react';
import type { AlertColor } from '@mui/material';

export interface NotificationOptions {
  message: string;
  severity?: AlertColor;
  autoHideDuration?: number;
}

export interface NotificationContextValue {
  notify: (options: NotificationOptions) => void;
}

export const NotificationContext =
  createContext<NotificationContextValue | null>(null);
