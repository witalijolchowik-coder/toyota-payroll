import type { AdjustmentCreateInput } from '../../types/firestore';
import {
  directionForAdjustmentCategory,
  normalizeAdjustmentInput,
  validateAdjustmentInput,
} from './adjustmentValidation';

const validInput: AdjustmentCreateInput = {
  employeeId: 'employee-1',
  tetaNumber: 'TETA-1001',
  category: 'MANUAL_BONUS',
  direction: 'INCREASE',
  amount: 100,
  note: 'Korekta',
};

describe('adjustment validation', () => {
  it('accepts a non-negative manual bonus', () => {
    expect(validateAdjustmentInput(validInput)).toEqual({});
    expect(validateAdjustmentInput({ ...validInput, amount: 0 })).toEqual({});
  });

  it('rejects negative and non-finite amounts', () => {
    expect(
      validateAdjustmentInput({ ...validInput, amount: -0.01 }),
    ).toMatchObject({ amount: 'invalid-amount' });
    expect(
      validateAdjustmentInput({ ...validInput, amount: Number.NaN }),
    ).toMatchObject({ amount: 'invalid-amount' });
  });

  it('enforces fixed directions for bonuses and deductions', () => {
    expect(
      validateAdjustmentInput({ ...validInput, direction: 'DECREASE' }),
    ).toMatchObject({ direction: 'direction-mismatch' });
    expect(
      validateAdjustmentInput({
        ...validInput,
        category: 'MANUAL_DEDUCTION',
        direction: 'INCREASE',
      }),
    ).toMatchObject({ direction: 'direction-mismatch' });
  });

  it('allows either direction for other adjustments', () => {
    expect(
      validateAdjustmentInput({
        ...validInput,
        category: 'OTHER',
        direction: 'DECREASE',
      }),
    ).toEqual({});
  });

  it('requires employee identity and trims the note', () => {
    expect(
      validateAdjustmentInput({
        ...validInput,
        employeeId: '',
        tetaNumber: '',
      }),
    ).toMatchObject({ employeeId: 'required', tetaNumber: 'required' });
    expect(
      normalizeAdjustmentInput({ ...validInput, note: '  opis  ' }).note,
    ).toBe('opis');
  });

  it('maps categories to their fixed directions', () => {
    expect(directionForAdjustmentCategory('MANUAL_BONUS')).toBe('INCREASE');
    expect(directionForAdjustmentCategory('MANUAL_DEDUCTION')).toBe('DECREASE');
    expect(directionForAdjustmentCategory('OTHER')).toBeNull();
  });
});
