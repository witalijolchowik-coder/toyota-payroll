import { createContext } from 'react';

import type { ThemeModeContextValue } from '../types/theme';

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(
  null,
);
