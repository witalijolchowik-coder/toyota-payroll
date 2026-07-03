import type {
  AdjustmentCreateInput,
  AdjustmentDirection,
  AdjustmentUpdateInput,
} from '../../types/firestore';

export type AdjustmentValidationCode =
  | 'required'
  | 'invalid-category'
  | 'invalid-direction'
  | 'invalid-amount'
  | 'direction-mismatch';

export interface AdjustmentValidationErrors {
  employeeId?: AdjustmentValidationCode;
  tetaNumber?: AdjustmentValidationCode;
  category?: AdjustmentValidationCode;
  direction?: AdjustmentValidationCode;
  amount?: AdjustmentValidationCode;
}

const CATEGORIES = new Set(['MANUAL_BONUS', 'MANUAL_DEDUCTION', 'OTHER']);
const DIRECTIONS = new Set(['INCREASE', 'DECREASE']);

export function directionForAdjustmentCategory(
  category: string,
): AdjustmentDirection | null {
  if (category === 'MANUAL_BONUS') {
    return 'INCREASE';
  }
  if (category === 'MANUAL_DEDUCTION') {
    return 'DECREASE';
  }
  return null;
}

export function normalizeAdjustmentInput<T extends AdjustmentUpdateInput>(
  input: T,
): T {
  return { ...input, note: input.note.trim() };
}

export function validateAdjustmentInput(
  input: AdjustmentCreateInput,
): AdjustmentValidationErrors {
  const errors: AdjustmentValidationErrors = {};

  if (!input.employeeId.trim()) {
    errors.employeeId = 'required';
  }
  if (!input.tetaNumber.trim()) {
    errors.tetaNumber = 'required';
  }
  if (!CATEGORIES.has(input.category)) {
    errors.category = 'invalid-category';
  }
  if (!DIRECTIONS.has(input.direction)) {
    errors.direction = 'invalid-direction';
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    errors.amount = 'invalid-amount';
  }

  const requiredDirection = directionForAdjustmentCategory(input.category);
  if (requiredDirection && input.direction !== requiredDirection) {
    errors.direction = 'direction-mismatch';
  }

  return errors;
}
