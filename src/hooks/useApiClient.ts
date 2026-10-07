import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createApiClient, type ApiClient } from '../api/client';

export function useApiClient(): ApiClient {
  const { getAccessToken, refreshAccessToken } = useAuth();
  // Both functions are stable, so the client is created once. The token is
  // read at request time through getAccessToken - never captured here -
  // so a retry after a refresh always sends the new token.
  return useMemo(
    () => createApiClient(getAccessToken, refreshAccessToken),
    [getAccessToken, refreshAccessToken],
  );
}
