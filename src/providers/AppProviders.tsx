import type { PropsWithChildren } from 'react';

import { GlobalErrorBoundary } from '../components/feedback/GlobalErrorBoundary';
import { AppThemeProvider } from './AppThemeProvider';
import { AuthProvider } from './AuthProvider';
import { LoadingProvider } from './LoadingProvider';
import { NotificationProvider } from './NotificationProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppThemeProvider>
      <GlobalErrorBoundary>
        <AuthProvider>
          <LoadingProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </LoadingProvider>
        </AuthProvider>
      </GlobalErrorBoundary>
    </AppThemeProvider>
  );
}
