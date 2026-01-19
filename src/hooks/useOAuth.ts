import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient, OAuthConnection } from "../lib/api";
import { useCallback, useState } from "react";

/**
 * Hook for OAuth connections
 */
export function useOAuthConnections() {
  const api = useApiClient();

  return useQuery({
    queryKey: ["oauth-connections"],
    queryFn: () => api.get<OAuthConnection[]>("/oauth/connections"),
  });
}

/**
 * Hook for checking if a specific provider needs re-auth
 */
export function useOAuthStatus(provider: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: ["oauth-status", provider],
    queryFn: () =>
      api.get<{
        connected: boolean;
        needsReauth: boolean;
        connections?: OAuthConnection[];
      }>(`/oauth/${provider}/status`),
  });
}

/**
 * Hook for deleting an OAuth connection
 */
export function useDeleteOAuthConnection() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) =>
      api.delete(`/oauth/connections/${connectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oauth-connections"] });
    },
  });
}

/**
 * Hook for handling OAuth re-authentication
 */
export function useOAuthReauth() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const triggerReauth = useCallback(
    async (provider: string) => {
      setIsAuthenticating(true);
      try {
        const success = await api.triggerOAuthReauth(provider);
        if (success) {
          // Refresh connections after successful auth
          await queryClient.invalidateQueries({ queryKey: ["oauth-connections"] });
          await queryClient.invalidateQueries({ queryKey: ["oauth-status", provider] });
        }
        return success;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [api, queryClient]
  );

  return {
    triggerReauth,
    isAuthenticating,
  };
}

/**
 * Component to show when auth is required
 */
export function useAuthRequiredHandler() {
  const { triggerReauth, isAuthenticating } = useOAuthReauth();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [pendingReason, setPendingReason] = useState<string | null>(null);

  const handleAuthRequired = useCallback((provider: string, reason: string) => {
    setPendingProvider(provider);
    setPendingReason(reason);
  }, []);

  const handleReauth = useCallback(async () => {
    if (pendingProvider) {
      const success = await triggerReauth(pendingProvider);
      if (success) {
        setPendingProvider(null);
        setPendingReason(null);
      }
      return success;
    }
    return false;
  }, [pendingProvider, triggerReauth]);

  const dismissAuthRequired = useCallback(() => {
    setPendingProvider(null);
    setPendingReason(null);
  }, []);

  return {
    pendingProvider,
    pendingReason,
    isAuthenticating,
    handleAuthRequired,
    handleReauth,
    dismissAuthRequired,
  };
}
