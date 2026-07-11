import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { App } from './App';
import { NoAccessScreen } from './components/auth/NoAccessScreen';
import { AuthContext } from './contexts/AuthContext';
import { pl } from './i18n/pl';
import { LoginPage } from './pages/LoginPage';
import { AppThemeProvider } from './providers/AppThemeProvider';
import { LoadingProvider } from './providers/LoadingProvider';
import { NotificationProvider } from './providers/NotificationProvider';
import type { AuthContextValue } from './types/auth';

function renderWithAuth(
  children: ReactNode,
  auth: Partial<AuthContextValue> = {},
) {
  const value: AuthContextValue = {
    status: 'authenticated',
    user: {
      uid: 'coordinator-1',
      displayName: 'Payroll Coordinator',
      email: 'koordynator@example.com',
      role: 'coordinator',
    },
    isAuthenticated: true,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    ...auth,
  };

  return render(
    <AppThemeProvider>
      <AuthContext.Provider value={value}>
        <LoadingProvider>
          <NotificationProvider>{children}</NotificationProvider>
        </LoadingProvider>
      </AuthContext.Provider>
    </AppThemeProvider>,
  );
}

describe('App', () => {
  it('renders the application shell and dashboard', async () => {
    window.location.hash = '#/dashboard';
    renderWithAuth(<App />);

    expect(
      await screen.findByRole('heading', {
        name: pl.dashboard.page.title,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', {
        name: pl.navigation.employees.label,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(pl.dashboard.cards.absences.title),
    ).toBeInTheDocument();
    expect(screen.getByText(pl.auth.signOut)).toBeInTheDocument();
  });

  it('shows the login page for unauthenticated users', () => {
    renderWithAuth(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
      {
        status: 'unauthenticated',
        user: null,
        isAuthenticated: false,
      },
    );

    expect(
      screen.getByRole('heading', { name: pl.auth.login.title }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hasło/)).toBeInTheDocument();
  });

  it('shows no-access state and allows sign out for unapproved users', async () => {
    const signOut = vi.fn(async () => undefined);

    renderWithAuth(<NoAccessScreen />, {
      status: 'no-access',
      user: null,
      isAuthenticated: false,
      signOut,
    });

    expect(
      screen.getByRole('heading', { name: pl.auth.noAccess.title }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: pl.auth.signOut }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});
