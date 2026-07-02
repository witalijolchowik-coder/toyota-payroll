import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { App } from './App';

describe('App', () => {
  it('renders the Step 1 bootstrap shell', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Foundation ready' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 12')).toBeInTheDocument();
  });
});
