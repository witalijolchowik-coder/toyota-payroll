import type { PayrollSetting } from '../../types/firestore';
import {
  PayrollSettingResolutionError,
  resolveEffectivePayrollSetting,
  validatePayrollSettingInput,
} from './settings';

const audit = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'coordinator-1',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedBy: 'coordinator-1',
};

function setting(
  id: string,
  validFrom: string,
  amount: number,
  overrides: Partial<PayrollSetting> = {},
): PayrollSetting {
  return {
    id,
    settingKey: 'frequency_bonus',
    variantKey: null,
    variantName: null,
    amount,
    validFrom,
    validTo: null,
    active: true,
    description: '',
    ...audit,
    ...overrides,
  };
}

describe('effective payroll setting resolution', () => {
  it('returns the version covering the selected month', () => {
    expect(
      resolveEffectivePayrollSetting(
        [
          setting('old', '2026-01', 400, { validTo: '2026-06' }),
          setting('new', '2026-07', 450),
        ],
        'frequency_bonus',
        '2026-06',
      )?.amount,
    ).toBe(400);
  });

  it('preserves historical resolution when a newer open version is added', () => {
    const settings = [
      setting('original', '2026-01', 400),
      setting('future', '2026-07', 450),
    ];

    expect(
      resolveEffectivePayrollSetting(settings, 'frequency_bonus', '2026-06')
        ?.id,
    ).toBe('original');
    expect(
      resolveEffectivePayrollSetting(settings, 'frequency_bonus', '2026-07')
        ?.id,
    ).toBe('future');
  });

  it('resolves accommodation variants independently', () => {
    const settings = [
      setting('type-a', '2026-01', 600, {
        settingKey: 'accommodation_allowance',
        variantKey: 'type-a',
        variantName: 'Type A',
      }),
      setting('type-b', '2026-01', 800, {
        settingKey: 'accommodation_allowance',
        variantKey: 'type-b',
        variantName: 'Type B',
      }),
    ];

    expect(
      resolveEffectivePayrollSetting(
        settings,
        'accommodation_allowance',
        '2026-08',
        'type-b',
      )?.amount,
    ).toBe(800);
  });

  it('rejects duplicate versions with the same effective month', () => {
    expect(() =>
      resolveEffectivePayrollSetting(
        [setting('first', '2026-01', 400), setting('second', '2026-01', 450)],
        'frequency_bonus',
        '2026-02',
      ),
    ).toThrow(PayrollSettingResolutionError);
  });

  it('validates amount, validity range, and accommodation identity', () => {
    expect(
      validatePayrollSettingInput({
        settingKey: 'accommodation_allowance',
        variantKey: null,
        variantName: null,
        amount: -1,
        validFrom: '2026-08',
        validTo: '2026-07',
        description: '',
      }),
    ).toEqual({
      amount: 'invalid-amount',
      validTo: 'invalid-range',
      variantKey: 'variant-required',
      variantName: 'variant-required',
    });
  });
});
