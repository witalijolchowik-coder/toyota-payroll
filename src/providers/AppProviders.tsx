import type { PropsWithChildren } from 'react';

import { GlobalErrorBoundary } from '../components/feedback/GlobalErrorBoundary';
import { AppThemeProvider } from './AppThemeProvider';
import { AuthProvider } from './AuthProvider';
import { CalendarAppearanceProvider } from './CalendarAppearanceProvider';
import { LoadingProvider } from './LoadingProvider';
import { NotificationProvider } from './NotificationProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppThemeProvider>
      <GlobalErrorBoundary>
        <AuthProvider>
          <CalendarAppearanceProvider>
            <LoadingProvider>
              <NotificationProvider>{children}</NotificationProvider>
            </LoadingProvider>
          </CalendarAppearanceProvider>
        </AuthProvider>
      </GlobalErrorBoundary>
    </AppThemeProvider>
  );
}
