import {
  CALENDAR_APPEARANCE_KEYS,
  DEFAULT_CALENDAR_APPEARANCE,
  contrastRatio,
  hasLowCalendarContrast,
  mergeCalendarAppearance,
  resetCalendarAppearanceState,
} from './calendarAppearance';

describe('calendar appearance', () => {
  it('returns complete defaults without stored preferences', () => {
    const result = mergeCalendarAppearance();
    expect(Object.keys(result)).toHaveLength(CALENDAR_APPEARANCE_KEYS.length);
    expect(result).toEqual(DEFAULT_CALENDAR_APPEARANCE);
  });

  it('applies valid stored overrides and safely ignores invalid values', () => {
    const result = mergeCalendarAppearance({
      l4Active: { text: '#123456', background: 'red' },
    });
    expect(result.l4Active.text).toBe('#123456');
    expect(result.l4Active.background).toBe(
      DEFAULT_CALENDAR_APPEARANCE.l4Active.background,
    );
    expect(result.weekend).toEqual(DEFAULT_CALENDAR_APPEARANCE.weekend);
  });

  it('resets one state without changing other states', () => {
    const changed = mergeCalendarAppearance({
      l4Active: { text: '#000000', background: '#FFFFFF' },
      weekend: { text: '#111111', background: '#EEEEEE' },
    });
    const result = resetCalendarAppearanceState(changed, 'l4Active');
    expect(result.l4Active).toEqual(DEFAULT_CALENDAR_APPEARANCE.l4Active);
    expect(result.weekend).toEqual(changed.weekend);
  });

  it('warns about low contrast and accepts readable colors', () => {
    expect(
      hasLowCalendarContrast({ text: '#777777', background: '#888888' }),
    ).toBe(true);
    expect(
      hasLowCalendarContrast({ text: '#000000', background: '#FFFFFF' }),
    ).toBe(false);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });
});
