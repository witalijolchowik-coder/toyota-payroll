import { render, screen } from '@testing-library/react';

import { App } from './App';
import { AppProviders } from './providers/AppProviders';

describe('App', () => {
  it('renders the application shell and dashboard', async () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /Employees/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Current Absences')).toBeInTheDocument();
  });
});
