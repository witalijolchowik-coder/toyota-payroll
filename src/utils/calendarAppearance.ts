export const CALENDAR_APPEARANCE_KEYS = [
  'worked',
  'firstShift',
  'secondShift',
  'nightShift',
  'bhp',
  'l4Active',
  'l4Inactive',
  'l4Reported',
  'uw',
  'uz',
  'nn',
  'nu',
  'ni',
  'opd',
  'krw',
  'wzn',
  'overtime50',
  'overtime100',
  'nightHours',
  'shortage',
  'privateTime',
  'manualCorrection',
  'requiresReview',
  'blocker',
  'warning',
  'dayOff',
  'weekend',
  'publicHoliday',
  'future',
  'outsideEmployment',
] as const;

export type CalendarAppearanceKey = (typeof CALENDAR_APPEARANCE_KEYS)[number];

export interface CalendarAppearanceColors {
  text: string;
  background: string;
}

export type CalendarAppearancePalette = Record<
  CalendarAppearanceKey,
  CalendarAppearanceColors
>;

const neutralText = '#667085';

export const DEFAULT_CALENDAR_APPEARANCE: CalendarAppearancePalette = {
  worked: { text: '#475467', background: '#FFFFFF' },
  firstShift: { text: '#175CD3', background: '#EFF8FF' },
  secondShift: { text: '#B54708', background: '#FFFAEB' },
  nightShift: { text: '#3538CD', background: '#EEF4FF' },
  bhp: { text: '#027A48', background: '#ECFDF3' },
  l4Active: { text: '#B42318', background: '#FEF3F2' },
  l4Inactive: { text: '#667085', background: '#F2F4F7' },
  l4Reported: { text: '#B54708', background: '#FFFAEB' },
  uw: { text: '#026AA2', background: '#F0F9FF' },
  uz: { text: '#6941C6', background: '#F9F5FF' },
  nn: { text: '#B42318', background: '#FEF3F2' },
  nu: { text: '#C4320A', background: '#FFF4ED' },
  ni: { text: '#B54708', background: '#FFFAEB' },
  opd: { text: '#027A48', background: '#ECFDF3' },
  krw: { text: '#B42318', background: '#FFF1F3' },
  wzn: { text: '#363F72', background: '#F8F9FC' },
  overtime50: { text: '#E04F16', background: '#FFF4ED' },
  overtime100: { text: '#B42318', background: '#FEF3F2' },
  nightHours: { text: '#3538CD', background: '#EEF4FF' },
  shortage: { text: '#B54708', background: '#FFFAEB' },
  privateTime: { text: '#6941C6', background: '#F9F5FF' },
  manualCorrection: { text: '#175CD3', background: '#EFF8FF' },
  requiresReview: { text: '#B54708', background: '#FFFAEB' },
  blocker: { text: '#B42318', background: '#FEF3F2' },
  warning: { text: '#B54708', background: '#FFFAEB' },
  dayOff: { text: neutralText, background: '#F9FAFB' },
  weekend: { text: neutralText, background: '#F2F4F7' },
  publicHoliday: { text: '#B42318', background: '#FEE4E2' },
  future: { text: '#98A2B3', background: '#EAECF0' },
  outsideEmployment: { text: '#98A2B3', background: '#E4E7EC' },
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

export function mergeCalendarAppearance(
  overrides?: Partial<CalendarAppearancePalette> | null,
): CalendarAppearancePalette {
  return Object.fromEntries(
    CALENDAR_APPEARANCE_KEYS.map((key) => {
      const override = overrides?.[key];
      return [
        key,
        {
          text: isHexColor(override?.text)
            ? override.text.toUpperCase()
            : DEFAULT_CALENDAR_APPEARANCE[key].text,
          background: isHexColor(override?.background)
            ? override.background.toUpperCase()
            : DEFAULT_CALENDAR_APPEARANCE[key].background,
        },
      ];
    }),
  ) as CalendarAppearancePalette;
}

export function resetCalendarAppearanceState(
  palette: CalendarAppearancePalette,
  key: CalendarAppearanceKey,
): CalendarAppearancePalette {
  return {
    ...palette,
    [key]: { ...DEFAULT_CALENDAR_APPEARANCE[key] },
  };
}

export function contrastRatio(text: string, background: string): number {
  const first = relativeLuminance(text);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hasLowCalendarContrast(
  colors: CalendarAppearanceColors,
): boolean {
  return contrastRatio(colors.text, colors.background) < 4.5;
}

function relativeLuminance(color: string): number {
  if (!isHexColor(color)) return 0;
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(color.slice(index, index + 2), 16),
  );
  const [red, green, blue] = channels.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

export function appearanceKeyForAbsence(
  code: string,
  confirmation?: 'reported' | 'confirmed' | 'mixed',
): CalendarAppearanceKey {
  if (code === 'L4') {
    return confirmation === 'reported' ? 'l4Reported' : 'l4Active';
  }
  const mapped: Partial<Record<string, CalendarAppearanceKey>> = {
    UW: 'uw',
    UZ: 'uz',
    NN: 'nn',
    NU: 'nu',
    NI: 'ni',
    OPD: 'opd',
    KRW: 'krw',
    WZN: 'wzn',
  };
  return mapped[code] ?? 'warning';
}

export function appearanceKeyForPlannedDay(planned?: {
  status: string;
  shift: string | null;
}): CalendarAppearanceKey {
  if (planned?.status === 'BHP') return 'bhp';
  if (planned?.status === 'DAY_OFF') return 'dayOff';
  if (planned?.shift === 'FIRST') return 'firstShift';
  if (planned?.shift === 'SECOND') return 'secondShift';
  if (planned?.shift === 'NIGHT') return 'nightShift';
  return 'worked';
}
