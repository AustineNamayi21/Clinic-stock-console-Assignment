import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createApiClient, type ApiClient } from '../api/client';

export function useApiClient(): ApiClient {
  const { accessToken, refreshAccessToken } = useAuth();
  // Re-created only when the access token identity changes; refreshAccessToken
  // is stable (useCallback with empty deps in AuthProvider).
  return useMemo(
    () => createApiClient(() => accessToken, refreshAccessToken),
    [accessToken, refreshAccessToken],
  );
}
