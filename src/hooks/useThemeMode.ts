import { useContext } from 'react';

import { ThemeModeContext } from '../contexts/ThemeModeContext';

export function useThemeMode() {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error('useThemeMode must be used inside AppThemeProvider.');
  }

  return context;
}
