import type { Employee } from '../../types/firestore';

const FIRST_EMPLOYMENT_LIMIT_MONTHS = 18;

export interface ResolvedEmploymentPeriod {
  startDate: Date;
  endDate: Date | null;
}

export function calculateFirstEmploymentLimit(
  firstToyotaEmploymentDate: Date | null | undefined,
): Date | null {
  if (!firstToyotaEmploymentDate) {
    return null;
  }

  const sourceYear = firstToyotaEmploymentDate.getUTCFullYear();
  const sourceMonth = firstToyotaEmploymentDate.getUTCMonth();
  const sourceDay = firstToyotaEmploymentDate.getUTCDate();
  const absoluteTargetMonth = sourceMonth + FIRST_EMPLOYMENT_LIMIT_MONTHS;
  const targetYear = sourceYear + Math.floor(absoluteTargetMonth / 12);
  const targetMonth = absoluteTargetMonth % 12;
  const lastTargetDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(sourceDay, lastTargetDay)),
  );
}

export function resolveCurrentEmploymentPeriod(
  employee: Pick<Employee, 'employmentStartDate' | 'employmentEndDate'>,
): ResolvedEmploymentPeriod | null {
  if (!employee.employmentStartDate) {
    return null;
  }
  return {
    startDate: employee.employmentStartDate,
    endDate: employee.employmentEndDate,
  };
}

export function formatPolishDate(value: Date): string {
  return [
    String(value.getUTCDate()).padStart(2, '0'),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCFullYear()).padStart(4, '0'),
  ].join('.');
}
