import type { IsoDate } from '../../types/firestore';

export type OvertimeRate = 50 | 100;
export type OvertimeDemandKind =
  'PRIVATE_TIME' | 'COVERABLE_NI' | 'NI_TIME_OFF';

export interface DatedOvertimePool {
  date: IsoDate;
  rate: OvertimeRate;
  hours: number;
}

export interface OvertimeDemand {
  id: string;
  date: IsoDate;
  hours: number;
  kind: OvertimeDemandKind;
  sourceDates?: readonly IsoDate[];
  allowNonEarlierSource?: boolean;
}

export interface OvertimeAllocation {
  demandId: string;
  demandDate: IsoDate;
  demandKind: OvertimeDemandKind;
  sourceDate: IsoDate;
  rate: OvertimeRate;
  hours: number;
}

export interface OvertimeDemandResult extends OvertimeDemand {
  allocatedHours: number;
  unresolvedHours: number;
}

export interface MonthlyOvertimeAllocationResult {
  allocations: OvertimeAllocation[];
  demands: OvertimeDemandResult[];
  remainingPools: DatedOvertimePool[];
}

export function allocateMonthlyOvertime({
  pools,
  shortageDemands,
  timeOffDemands,
}: {
  pools: readonly DatedOvertimePool[];
  shortageDemands: readonly OvertimeDemand[];
  timeOffDemands: readonly OvertimeDemand[];
}): MonthlyOvertimeAllocationResult {
  const remainingPools = pools
    .filter((pool) => pool.hours > 0)
    .map((pool) => ({ ...pool, hours: roundHours(pool.hours) }))
    .sort(comparePool);
  const allocations: OvertimeAllocation[] = [];
  const demands: OvertimeDemandResult[] = [];

  const allocateDemand = (demand: OvertimeDemand) => {
    let remaining = roundHours(Math.max(0, demand.hours));
    for (const pool of remainingPools) {
      if (remaining <= 0) break;
      if (pool.hours <= 0) continue;
      if (
        demand.kind === 'NI_TIME_OFF' &&
        !demand.allowNonEarlierSource &&
        pool.date >= demand.date
      ) {
        continue;
      }
      if (demand.sourceDates && !demand.sourceDates.includes(pool.date)) {
        continue;
      }

      const hours = roundHours(Math.min(remaining, pool.hours));
      if (hours <= 0) continue;
      allocations.push({
        demandId: demand.id,
        demandDate: demand.date,
        demandKind: demand.kind,
        sourceDate: pool.date,
        rate: pool.rate,
        hours,
      });
      pool.hours = roundHours(pool.hours - hours);
      remaining = roundHours(remaining - hours);
    }
    demands.push({
      ...demand,
      hours: roundHours(demand.hours),
      allocatedHours: roundHours(demand.hours - remaining),
      unresolvedHours: remaining,
    });
  };

  [...shortageDemands].sort(compareDemand).forEach(allocateDemand);
  [...timeOffDemands].sort(compareDemand).forEach(allocateDemand);

  return { allocations, demands, remainingPools };
}

export function sumAllocatedHours(
  allocations: readonly OvertimeAllocation[],
  predicate: (allocation: OvertimeAllocation) => boolean,
): number {
  return roundHours(
    allocations
      .filter(predicate)
      .reduce((total, allocation) => total + allocation.hours, 0),
  );
}

function comparePool(first: DatedOvertimePool, second: DatedOvertimePool) {
  return first.rate === second.rate
    ? first.date.localeCompare(second.date)
    : first.rate - second.rate;
}

function compareDemand(first: OvertimeDemand, second: OvertimeDemand) {
  return first.date === second.date
    ? first.id.localeCompare(second.id)
    : first.date.localeCompare(second.date);
}

function roundHours(value: number) {
  return Math.round(value * 100 + 1e-7) / 100;
}
