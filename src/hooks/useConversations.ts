import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient, Conversation, Message } from "../lib/api";

/**
 * Hook for conversations
 */
export function useConversations() {
  const api = useApiClient();

  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<Conversation[]>("/conversations"),
  });
}

/**
 * Hook for a single conversation
 */
export function useConversation(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: ["conversations", id],
    queryFn: () => api.get<Conversation>(`/conversations/${id}`),
    enabled: !!id,
  });
}

/**
 * Hook for creating a conversation
 */
export function useCreateConversation() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) =>
      api.post<Conversation>("/conversations", { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/**
 * Hook for updating a conversation title
 */
export function useUpdateConversation() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch<Conversation>(`/conversations/${id}`, { title }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversations", variables.id] });
    },
  });
}

/**
 * Hook for deleting a conversation
 */
export function useDeleteConversation() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/conversations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/**
 * Hook for messages in a conversation
 */
export function useMessages(conversationId: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () =>
      api.get<Message[]>(`/conversations/${conversationId}/messages`),
    enabled: !!conversationId,
    refetchInterval: 2000, // Poll every 2 seconds for updates
  });
}

/**
 * Hook for sending a message with streaming response
 */
export function useSendMessage() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      onToken,
      onToolCall,
      onComplete,
      onError,
      onAuthRequired,
    }: {
      conversationId: string;
      content: string;
      onToken?: (token: string) => void;
      onToolCall?: (toolName: string, serverId: string) => void;
      onComplete?: (content: string) => void;
      onError?: (error: string) => void;
      onAuthRequired?: (provider: string, reason: string) => void;
    }) => {
      await api.stream(
        `/conversations/${conversationId}/messages`,
        { content },
        { onToken, onToolCall, onComplete, onError, onAuthRequired }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", variables.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
