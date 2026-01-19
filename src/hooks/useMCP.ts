import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient, MCPServer, MCPTool } from "../lib/api";

/**
 * Hook for MCP servers
 */
export function useMCPServers() {
  const api = useApiClient();

  return useQuery({
    queryKey: ["mcp-servers"],
    queryFn: () => api.get<MCPServer[]>("/mcp/servers"),
  });
}

/**
 * Hook for adding an MCP server
 */
export function useAddMCPServer() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      url: string;
      authType: string;
      oauthProvider?: string;
      apiKey?: string;
    }) => api.post<MCPServer>("/mcp/servers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers"] });
    },
  });
}

/**
 * Hook for deleting an MCP server
 */
export function useDeleteMCPServer() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverId: string) => api.delete(`/mcp/servers/${serverId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers"] });
    },
  });
}

/**
 * Hook for getting tools from an MCP server
 */
export function useMCPTools(serverId: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: ["mcp-tools", serverId],
    queryFn: () => api.get<MCPTool[]>(`/mcp/servers/${serverId}/tools`),
    enabled: !!serverId,
  });
}
