import { createContext } from 'react';

import type { CalendarAppearancePalette } from '../utils/calendarAppearance';

export interface CalendarAppearanceContextValue {
  palette: CalendarAppearancePalette;
  isLoading: boolean;
  error: boolean;
  savePalette: (palette: CalendarAppearancePalette) => Promise<void>;
}

export const CalendarAppearanceContext =
  createContext<CalendarAppearanceContextValue | null>(null);
