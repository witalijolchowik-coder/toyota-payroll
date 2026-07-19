import { render, screen } from '@testing-library/react';

import { CalendarAppearanceContext } from '../../contexts/CalendarAppearanceContext';
import {
  DEFAULT_CALENDAR_APPEARANCE,
  type CalendarAppearancePalette,
} from '../../utils/calendarAppearance';
import { AbsenceOptionContent } from './AbsenceOptionContent';

describe('AbsenceOptionContent', () => {
  it('uses the configured calendar colors only on the canonical code', () => {
    const palette: CalendarAppearancePalette = {
      ...DEFAULT_CALENDAR_APPEARANCE,
      l4Active: { text: '#123456', background: '#ABCDEF' },
    };

    render(
      <CalendarAppearanceContext.Provider
        value={{
          palette,
          isLoading: false,
          error: false,
          savePalette: vi.fn(),
        }}
      >
        <AbsenceOptionContent code="L4" description="Zwolnienie lekarskie" />
      </CalendarAppearanceContext.Provider>,
    );

    const code = screen.getByTestId('absence-code-L4');
    expect(code).toHaveTextContent('L4');
    expect(code).toHaveStyle({
      color: '#123456',
      backgroundColor: '#ABCDEF',
    });
    expect(screen.getByText('Zwolnienie lekarskie')).not.toHaveStyle({
      color: '#123456',
      backgroundColor: '#ABCDEF',
    });
  });

  it('falls back to the default calendar palette', () => {
    render(<AbsenceOptionContent code="UW" description="Urlop wypoczynkowy" />);

    expect(screen.getByTestId('absence-code-UW')).toHaveStyle({
      color: DEFAULT_CALENDAR_APPEARANCE.uw.text,
      backgroundColor: DEFAULT_CALENDAR_APPEARANCE.uw.background,
    });
  });
});
