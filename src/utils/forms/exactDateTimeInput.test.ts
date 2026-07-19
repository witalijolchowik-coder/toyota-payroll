import {
  formatExactDateForDisplay,
  isCanonicalExactDate,
  isCanonicalExactTime,
  normalizeExactDateInput,
  normalizeExactTimeInput,
} from './exactDateTimeInput';

describe('normalizeExactTimeInput', () => {
  it.each([
    ['20', '20:00'],
    ['15', '15:00'],
    ['8', '08:00'],
    ['1408', '14:08'],
    ['2000', '20:00'],
    ['1501', '15:01'],
    ['14:08', '14:08'],
    ['08:05', '08:05'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeExactTimeInput(input)).toBe(expected);
  });

  it.each(['2460', '2365', '9999', '805', '8:5', 'text'])(
    'rejects invalid or ambiguous value %s',
    (input) => {
      expect(normalizeExactTimeInput(input)).toBeNull();
    },
  );

  it('identifies only canonical stored clock values', () => {
    expect(isCanonicalExactTime('08:00')).toBe(true);
    expect(isCanonicalExactTime('8')).toBe(false);
  });
});

describe('normalizeExactDateInput', () => {
  it('uses the supplied local year for DDMM shorthand', () => {
    expect(normalizeExactDateInput('2507', 2026)).toBe('2026-07-25');
    expect(normalizeExactDateInput('0101', 2026)).toBe('2026-01-01');
  });

  it('validates leap years strictly', () => {
    expect(normalizeExactDateInput('2902', 2024)).toBe('2024-02-29');
    expect(normalizeExactDateInput('2902', 2026)).toBeNull();
  });

  it('rejects an impossible date', () => {
    expect(normalizeExactDateInput('3102', 2026)).toBeNull();
  });

  it('keeps a valid full date with another year canonical', () => {
    expect(normalizeExactDateInput('2024-12-31', 2026)).toBe('2024-12-31');
    expect(normalizeExactDateInput('31.12.2024', 2026)).toBe('2024-12-31');
  });

  it.each(['123', '010126', '2026-02-31', '31.02.2026', 'text'])(
    'rejects malformed or invalid value %s',
    (input) => {
      expect(normalizeExactDateInput(input, 2026)).toBeNull();
    },
  );

  it('formats canonical dates for the localized text field', () => {
    expect(formatExactDateForDisplay('2026-07-25')).toBe('25.07.2026');
    expect(formatExactDateForDisplay('invalid')).toBe('invalid');
  });

  it('identifies only canonical stored dates', () => {
    expect(isCanonicalExactDate('2026-07-25')).toBe(true);
    expect(isCanonicalExactDate('25.07.2026')).toBe(false);
    expect(isCanonicalExactDate('2507')).toBe(false);
  });
});
