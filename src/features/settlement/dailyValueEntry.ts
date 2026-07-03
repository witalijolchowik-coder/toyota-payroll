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
  currentNote,
  nextNote,
  fallbackHours,
}: {
  parsed: Exclude<ParsedDailyHours, { kind: 'error' }>;
  currentKind: SettlementCellKind;
  currentHours: number | null;
  currentNote: string | null;
  nextNote: string | null;
  fallbackHours: number | null;
}): DailyValueMutation {
  const hasCoordinatorValue =
    currentKind === 'manual' || currentKind === 'imported-override';

  if (parsed.kind === 'clear') {
    return hasCoordinatorValue ? 'clear' : 'none';
  }

  if (fallbackHours !== null && parsed.hours === fallbackHours) {
    return hasCoordinatorValue ? 'clear' : 'none';
  }

  if (
    hasCoordinatorValue &&
    parsed.hours === currentHours &&
    nextNote === currentNote
  ) {
    return 'none';
  }

  return 'save';
}
