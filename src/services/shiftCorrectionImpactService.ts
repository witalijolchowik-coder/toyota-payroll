import { getDocs } from 'firebase/firestore';

import type { MonthId } from '../types/firestore';
import {
  analyzeShiftCorrectionImpact,
  type ShiftCorrectionImpactSummary,
  type ShiftCorrectionProposal,
} from '../utils/schedule';
import { mapMonthDocument } from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';
import { loadSettlementMonth } from './settlementService';
import { loadDepartmentShiftCorrections } from './shiftConfigurationService';

export async function previewShiftCorrectionImpact(
  proposal: ShiftCorrectionProposal,
): Promise<ShiftCorrectionImpactSummary> {
  const repositories = getFirestoreRepositories();
  if (!repositories) throw new Error('firebase-unavailable');

  const monthSnapshot = await getDocs(repositories.months);
  const openMonthIds = monthSnapshot.docs
    .map((document) => mapMonthDocument(document.id, document.data()))
    .filter((month) => !month.isSettled)
    .map((month) => month.id as MonthId)
    .sort();
  const [monthData, corrections] = await Promise.all([
    Promise.all(openMonthIds.map((monthId) => loadSettlementMonth(monthId))),
    loadDepartmentShiftCorrections(),
  ]);
  const loaded = monthData.filter((value) => value !== null);
  const first = loaded[0];

  return analyzeShiftCorrectionImpact({
    proposal,
    openMonthIds,
    employees: first?.employees ?? [],
    departments: first?.departments ?? [],
    assignments: deduplicate(
      loaded.flatMap((value) => value.employeeAssignments),
    ),
    scheduleCorrections: deduplicate(
      loaded.flatMap((value) => value.scheduleCorrections),
    ),
    departmentShiftCorrections: corrections,
    shiftHoursVersions: deduplicate(
      loaded.flatMap((value) => value.shiftHoursVersions),
    ),
    dailyValues: deduplicate(loaded.flatMap((value) => value.dailyValues)),
    absences: deduplicate(loaded.flatMap((value) => value.absences)),
  });
}

function deduplicate<T extends { id: string }>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}
