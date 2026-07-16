import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { CalendarAppearanceContext } from '../contexts/CalendarAppearanceContext';
import { useAuth } from '../hooks/useAuth';
import {
  loadCalendarAppearance,
  saveCalendarAppearance,
} from '../services/calendarAppearanceService';
import {
  DEFAULT_CALENDAR_APPEARANCE,
  type CalendarAppearancePalette,
} from '../utils/calendarAppearance';

export function CalendarAppearanceProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const [palette, setPalette] = useState<CalendarAppearancePalette>(
    DEFAULT_CALENDAR_APPEARANCE,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (active) setIsLoading(true);
        return loadCalendarAppearance();
      })
      .then((loaded) => {
        if (active) setPalette(loaded);
      })
      .catch(() => {
        if (active) {
          setPalette(DEFAULT_CALENDAR_APPEARANCE);
          setError(true);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      palette: isAuthenticated ? palette : DEFAULT_CALENDAR_APPEARANCE,
      isLoading: isAuthenticated && isLoading,
      error: isAuthenticated && error,
      savePalette: async (nextPalette: CalendarAppearancePalette) => {
        await saveCalendarAppearance(nextPalette);
        setPalette(nextPalette);
        setError(false);
      },
    }),
    [error, isAuthenticated, isLoading, palette],
  );

  return (
    <CalendarAppearanceContext.Provider value={value}>
      {children}
    </CalendarAppearanceContext.Provider>
  );
}
