import { useCallback, useEffect, useState } from 'react';

import {
  createDepartmentShiftCorrection,
  createShiftHoursVersion,
  loadDepartmentShiftCorrections,
  loadShiftHoursVersions,
} from '../../services/shiftConfigurationService';
import type {
  DepartmentShiftCorrection,
  DepartmentShiftCorrectionCreateInput,
  ShiftHoursVersion,
  ShiftHoursVersionCreateInput,
} from '../../types/firestore';

export function useShiftConfiguration() {
  const [shiftHoursVersions, setShiftHoursVersions] = useState<
    ShiftHoursVersion[]
  >([]);
  const [departmentCorrections, setDepartmentCorrections] = useState<
    DepartmentShiftCorrection[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [hours, corrections] = await Promise.all([
        loadShiftHoursVersions(),
        loadDepartmentShiftCorrections(),
      ]);
      setShiftHoursVersions(hours);
      setDepartmentCorrections(corrections);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return {
    shiftHoursVersions,
    departmentCorrections,
    isLoading,
    error,
    createHours: async (input: ShiftHoursVersionCreateInput) => {
      await createShiftHoursVersion(input);
      await reload();
    },
    createCorrection: async (input: DepartmentShiftCorrectionCreateInput) => {
      await createDepartmentShiftCorrection(input);
      await reload();
    },
  };
}
