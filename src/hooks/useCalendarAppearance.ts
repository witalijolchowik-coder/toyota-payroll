import { useContext } from 'react';

import { CalendarAppearanceContext } from '../contexts/CalendarAppearanceContext';
import { DEFAULT_CALENDAR_APPEARANCE } from '../utils/calendarAppearance';

export function useCalendarAppearance() {
  const context = useContext(CalendarAppearanceContext);
  return (
    context ?? {
      palette: DEFAULT_CALENDAR_APPEARANCE,
      isLoading: false,
      error: false,
      savePalette: async () => {
        throw new Error('calendar-appearance-provider-missing');
      },
    }
  );
}
