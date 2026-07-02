import { useContext } from 'react';

import { LoadingContext } from '../contexts/LoadingContext';

export function useGlobalLoading() {
  const context = useContext(LoadingContext);

  if (!context) {
    throw new Error('useGlobalLoading must be used inside LoadingProvider.');
  }

  return context;
}
