import { useCallback, useMemo, useState, type PropsWithChildren } from 'react';

import { GlobalLoadingIndicator } from '../components/feedback/GlobalLoadingIndicator';
import { LoadingContext } from '../contexts/LoadingContext';

export function LoadingProvider({ children }: PropsWithChildren) {
  const [activeRequests, setActiveRequests] = useState(0);

  const showLoading = useCallback(() => {
    setActiveRequests((current) => current + 1);
  }, []);

  const hideLoading = useCallback(() => {
    setActiveRequests((current) => Math.max(0, current - 1));
  }, []);

  const value = useMemo(
    () => ({
      isLoading: activeRequests > 0,
      showLoading,
      hideLoading,
    }),
    [activeRequests, hideLoading, showLoading],
  );

  return (
    <LoadingContext.Provider value={value}>
      <GlobalLoadingIndicator visible={value.isLoading} />
      {children}
    </LoadingContext.Provider>
  );
}
