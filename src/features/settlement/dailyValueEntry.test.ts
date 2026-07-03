import {
  decideDailyValueMutation,
  parseDailyHoursInput,
} from './dailyValueEntry';

describe('daily hours validation', () => {
  it('accepts zero, decimal hours, and a Polish decimal comma', () => {
    expect(parseDailyHoursInput('0')).toEqual({ kind: 'value', hours: 0 });
    expect(parseDailyHoursInput('7.5')).toEqual({
      kind: 'value',
      hours: 7.5,
    });
    expect(parseDailyHoursInput('7,5')).toEqual({
      kind: 'value',
      hours: 7.5,
    });
  });

  it('rejects non-numeric, negative, and above-24 values', () => {
    expect(parseDailyHoursInput('abc')).toEqual({
      kind: 'error',
      code: 'not-number',
    });
    expect(parseDailyHoursInput('-1')).toEqual({
      kind: 'error',
      code: 'negative',
    });
    expect(parseDailyHoursInput('24.01')).toEqual({
      kind: 'error',
      code: 'above-maximum',
    });
  });

  it('treats an empty value as a clear request', () => {
    expect(parseDailyHoursInput(' ')).toEqual({ kind: 'clear' });
  });
});

describe('daily value mutation decisions', () => {
  it('does not persist an unchanged virtual working-day default', () => {
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'value', hours: 8 },
        currentKind: 'virtual-default',
        currentHours: 8,
        currentNote: null,
        nextNote: null,
        fallbackHours: 8,
      }),
    ).toBe('none');
  });

  it('does not persist an unchanged virtual non-working-day zero', () => {
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'value', hours: 0 },
        currentKind: 'virtual-default',
        currentHours: 0,
        currentNote: null,
        nextNote: null,
        fallbackHours: 0,
      }),
    ).toBe('none');
  });

  it('clears a manual value when it returns to the virtual default', () => {
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'value', hours: 8 },
        currentKind: 'manual',
        currentHours: 6,
        currentNote: null,
        nextNote: null,
        fallbackHours: 8,
      }),
    ).toBe('clear');
  });

  it('clears only existing manual values and saves explicit corrections', () => {
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'clear' },
        currentKind: 'manual',
        currentHours: 6,
        currentNote: null,
        nextNote: null,
        fallbackHours: 8,
      }),
    ).toBe('clear');
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'clear' },
        currentKind: 'virtual-default',
        currentHours: 8,
        currentNote: null,
        nextNote: null,
        fallbackHours: 8,
      }),
    ).toBe('none');
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'value', hours: 0 },
        currentKind: 'virtual-default',
        currentHours: 8,
        currentNote: null,
        nextNote: null,
        fallbackHours: 8,
      }),
    ).toBe('save');
  });

  it('does not rewrite an unchanged manual value', () => {
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'value', hours: 6 },
        currentKind: 'manual',
        currentHours: 6,
        currentNote: null,
        nextNote: null,
        fallbackHours: 8,
      }),
    ).toBe('none');
  });

  it('creates, preserves, and clears an imported-value override', () => {
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'value', hours: 8 },
        currentKind: 'imported',
        currentHours: 7,
        currentNote: null,
        nextNote: null,
        fallbackHours: 7,
      }),
    ).toBe('save');
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'value', hours: 8 },
        currentKind: 'imported-override',
        currentHours: 8,
        currentNote: null,
        nextNote: null,
        fallbackHours: 7,
      }),
    ).toBe('none');
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'value', hours: 7 },
        currentKind: 'imported-override',
        currentHours: 8,
        currentNote: null,
        nextNote: null,
        fallbackHours: 7,
      }),
    ).toBe('clear');
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'clear' },
        currentKind: 'imported-override',
        currentHours: 8,
        currentNote: null,
        nextNote: null,
        fallbackHours: 7,
      }),
    ).toBe('clear');
  });

  it('updates the note without requiring an hours change', () => {
    expect(
      decideDailyValueMutation({
        parsed: { kind: 'value', hours: 8 },
        currentKind: 'imported-override',
        currentHours: 8,
        currentNote: 'Stara notatka',
        nextNote: 'Nowa notatka',
        fallbackHours: 7,
      }),
    ).toBe('save');
  });
});
