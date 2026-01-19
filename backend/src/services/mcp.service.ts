import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { getValidAccessToken, OAuthProvider } from "./oauth.service.js";
import { decrypt } from "../lib/encryption.js";

// MCP Server interface
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: {
    tools?: MCPTool[];
    content?: Array<{ type: string; text?: string }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Result type for MCP operations - includes auth status
 */
export interface MCPResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  requiresAuth?: {
    provider: OAuthProvider;
    reason: string;
  };
}

/**
 * Get authentication headers for an MCP server
 */
async function getMCPAuthHeaders(
  userId: string,
  server: schema.McpServer,
  auth0Token: string
): Promise<MCPResult<Record<string, string>>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  switch (server.authType) {
    case "none":
      break;

    case "auth0_token":
      headers["Authorization"] = `Bearer ${auth0Token}`;
      break;

    case "api_key":
      if (server.apiKeyEncrypted) {
        const apiKey = decrypt(server.apiKeyEncrypted);
        headers["X-API-Key"] = apiKey;
      }
      break;

    case "oauth":
      if (server.oauthProvider) {
        const tokenResult = await getValidAccessToken(
          userId,
          server.oauthProvider as OAuthProvider
        );

        if (!tokenResult) {
          return {
            success: false,
            requiresAuth: {
              provider: server.oauthProvider as OAuthProvider,
              reason: "Token expired or revoked",
            },
          };
        }

        headers["Authorization"] = `Bearer ${tokenResult.token}`;
      }
      break;
  }

  return { success: true, data: headers };
}

/**
 * Get user's MCP servers
 */
export async function getUserMCPServers(userId: string) {
  return db.query.mcpServers.findMany({
    where: eq(schema.mcpServers.userId, userId),
  });
}

/**
 * Get a specific MCP server
 */
export async function getMCPServer(userId: string, serverId: string) {
  return db.query.mcpServers.findFirst({
    where: and(
      eq(schema.mcpServers.id, serverId),
      eq(schema.mcpServers.userId, userId)
    ),
  });
}

/**
 * Add a new MCP server
 */
export async function addMCPServer(
  userId: string,
  data: {
    name: string;
    url: string;
    authType: string;
    oauthProvider?: string;
    apiKey?: string;
  }
) {
  const [server] = await db
    .insert(schema.mcpServers)
    .values({
      userId,
      name: data.name,
      url: data.url,
      authType: data.authType,
      oauthProvider: data.oauthProvider,
      apiKeyEncrypted: data.apiKey
        ? (await import("../lib/encryption.js")).encrypt(data.apiKey)
        : undefined,
    })
    .returning();

  return server;
}

/**
 * Delete an MCP server
 */
export async function deleteMCPServer(userId: string, serverId: string) {
  await db
    .delete(schema.mcpServers)
    .where(
      and(
        eq(schema.mcpServers.id, serverId),
        eq(schema.mcpServers.userId, userId)
      )
    );
}

/**
 * Get available tools from an MCP server
 */
export async function getMCPTools(
  userId: string,
  serverId: string,
  auth0Token: string
): Promise<MCPResult<MCPTool[]>> {
  const server = await getMCPServer(userId, serverId);

  if (!server) {
    return { success: false, error: "Server not found" };
  }

  const headersResult = await getMCPAuthHeaders(userId, server, auth0Token);

  if (!headersResult.success) {
    return headersResult as MCPResult<MCPTool[]>;
  }

  try {
    const response = await fetch(server.url, {
      method: "POST",
      headers: headersResult.data!,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/list",
      }),
    });

    if (!response.ok) {
      return { success: false, error: `MCP error: ${response.status}` };
    }

    const data: MCPResponse = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, data: data.result?.tools || [] };
  } catch (error) {
    return { success: false, error: `Failed to connect: ${error}` };
  }
}

/**
 * Call a tool on an MCP server
 */
export async function callMCPTool(
  userId: string,
  serverId: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  auth0Token: string
): Promise<MCPResult<string>> {
  const server = await getMCPServer(userId, serverId);

  if (!server) {
    return { success: false, error: "Server not found" };
  }

  const headersResult = await getMCPAuthHeaders(userId, server, auth0Token);

  if (!headersResult.success) {
    return headersResult as MCPResult<string>;
  }

  try {
    const response = await fetch(server.url, {
      method: "POST",
      headers: headersResult.data!,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: toolArgs,
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: `MCP error: ${response.status}` };
    }

    const data: MCPResponse = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    // Extract text content from response
    const content = data.result?.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    return { success: true, data: content || "" };
  } catch (error) {
    return { success: false, error: `Failed to call tool: ${error}` };
  }
}

/**
 * Get all tools from all enabled MCP servers for a user
 */
export async function getAllUserMCPTools(
  userId: string,
  auth0Token: string
): Promise<
  MCPResult<
    Array<{
      serverId: string;
      serverName: string;
      tools: MCPTool[];
    }>
  >
> {
  const servers = await getUserMCPServers(userId);
  const enabledServers = servers.filter((s) => s.isEnabled);

  const results: Array<{
    serverId: string;
    serverName: string;
    tools: MCPTool[];
  }> = [];

  const authRequired: { provider: OAuthProvider; reason: string }[] = [];

  for (const server of enabledServers) {
    const toolsResult = await getMCPTools(userId, server.id, auth0Token);

    if (toolsResult.requiresAuth) {
      authRequired.push(toolsResult.requiresAuth);
      continue;
    }

    if (toolsResult.success && toolsResult.data) {
      results.push({
        serverId: server.id,
        serverName: server.name,
        tools: toolsResult.data,
      });
    }
  }

  // If any server requires auth, return that info
  if (authRequired.length > 0) {
    return {
      success: false,
      data: results,
      requiresAuth: authRequired[0], // Return first auth requirement
    };
  }

  return { success: true, data: results };
}
