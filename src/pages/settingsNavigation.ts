export const SETTINGS_SECTIONS = [
  'shifts',
  'accommodation',
  'allowances',
  'interface',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SETTINGS_SECTION_STORAGE_KEY = 'toyota-payroll.settings-section';

export function resolveSettingsSection(value: string | null): SettingsSection {
  return SETTINGS_SECTIONS.includes(value as SettingsSection)
    ? (value as SettingsSection)
    : 'shifts';
}
