import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// CloudFactory MCP Server endpoint
const CLOUDFACTORY_MCP_ENDPOINT = "https://mcp.dev.cfcore.dk/mcp";

// Interface for MCP tool
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Interface for MCP response
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

// Hent tilgængelige tools fra CloudFactory MCP server
export const getCloudFactoryTools = action({
  args: {
    auth0Token: v.string(),
  },
  handler: async (_ctx, args): Promise<MCPTool[]> => {
    try {
      const response = await fetch(CLOUDFACTORY_MCP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${args.auth0Token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/list",
        }),
      });

      if (!response.ok) {
        console.error(`MCP tools/list error: ${response.status}`);
        return [];
      }

      const data: MCPResponse = await response.json();
      
      if (data.error) {
        console.error(`MCP error: ${data.error.message}`);
        return [];
      }

      return data.result?.tools || [];
    } catch (error) {
      console.error("Failed to fetch MCP tools:", error);
      return [];
    }
  },
});

// Kald et tool på CloudFactory MCP serveren
export const callCloudFactoryTool = action({
  args: {
    auth0Token: v.string(),
    toolName: v.string(),
    toolArgs: v.any(),
  },
  handler: async (_ctx, args): Promise<string> => {
    try {
      const response = await fetch(CLOUDFACTORY_MCP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${args.auth0Token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: {
            name: args.toolName,
            arguments: args.toolArgs,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP tool call error: ${response.status}`);
      }

      const data: MCPResponse = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      // Formatér resultatet
      const content = data.result?.content;
      if (Array.isArray(content)) {
        return content
          .map((c) => c.text || JSON.stringify(c))
          .join("\n");
      }
      
      return JSON.stringify(data.result, null, 2);
    } catch (error) {
      return `Fejl ved CloudFactory MCP kald: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// Konverter MCP tools til OpenAI function format
export function convertMCPToolsToOpenAI(mcpTools: MCPTool[]): Array<{
  type: string;
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}> {
  return mcpTools.map((tool) => ({
    type: "function",
    function: {
      name: `cf_${tool.name}`, // Prefix med cf_ for at undgå konflikter
      description: `[CloudFactory] ${tool.description}`,
      parameters: tool.inputSchema,
    },
  }));
}

// Gem/opdater MCP server konfiguration
export const saveMCPServer = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    url: v.string(),
    useAuth0Token: v.boolean(),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Tjek om serveren allerede findes
    const existing = await ctx.db
      .query("mcpServers")
      .withIndex("by_user_name", (q) =>
        q.eq("userId", args.userId).eq("name", args.name)
      )
      .first();

    if (existing) {
      // Opdater eksisterende
      await ctx.db.patch(existing._id, {
        url: args.url,
        useAuth0Token: args.useAuth0Token,
        isEnabled: args.isEnabled,
      });
      return existing._id;
    }

    // Opret ny
    return await ctx.db.insert("mcpServers", {
      userId: args.userId,
      name: args.name,
      url: args.url,
      useAuth0Token: args.useAuth0Token,
      isEnabled: args.isEnabled,
      status: "disconnected",
    });
  },
});

// Hent brugerens MCP servere
export const getUserMCPServers = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mcpServers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Opdater MCP server status
export const updateMCPServerStatus = mutation({
  args: {
    serverId: v.id("mcpServers"),
    status: v.union(
      v.literal("disconnected"),
      v.literal("connected"),
      v.literal("error")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.serverId, {
      status: args.status,
      error: args.error,
      lastConnected: args.status === "connected" ? Date.now() : undefined,
    });
  },
});
