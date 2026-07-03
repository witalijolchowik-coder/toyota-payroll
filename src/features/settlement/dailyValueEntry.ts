import type { SettlementCellKind } from './monthUtils';

export type DailyHoursValidationError =
  'not-number' | 'negative' | 'above-maximum';

export type ParsedDailyHours =
  | { kind: 'clear' }
  | { kind: 'value'; hours: number }
  | { kind: 'error'; code: DailyHoursValidationError };

export type DailyValueMutation = 'none' | 'save' | 'clear';

export function parseDailyHoursInput(input: string): ParsedDailyHours {
  const normalized = input.trim().replace(',', '.');
  if (!normalized) {
    return { kind: 'clear' };
  }

  const hours = Number(normalized);
  if (!Number.isFinite(hours)) {
    return { kind: 'error', code: 'not-number' };
  }
  if (hours < 0) {
    return { kind: 'error', code: 'negative' };
  }
  if (hours > 24) {
    return { kind: 'error', code: 'above-maximum' };
  }

  return { kind: 'value', hours };
}

export function decideDailyValueMutation({
  parsed,
  currentKind,
  currentHours,
  virtualDefaultHours,
}: {
  parsed: Exclude<ParsedDailyHours, { kind: 'error' }>;
  currentKind: SettlementCellKind;
  currentHours: number | null;
  virtualDefaultHours: number | null;
}): DailyValueMutation {
  const hasManualValue = currentKind === 'manual';

  if (parsed.kind === 'clear') {
    return hasManualValue ? 'clear' : 'none';
  }

  if (virtualDefaultHours !== null && parsed.hours === virtualDefaultHours) {
    return hasManualValue ? 'clear' : 'none';
  }

  if (hasManualValue && parsed.hours === currentHours) {
    return 'none';
  }

  return 'save';
}
