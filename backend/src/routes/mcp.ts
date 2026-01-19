import { Hono } from "hono";
import {
  getUserMCPServers,
  getMCPServer,
  addMCPServer,
  deleteMCPServer,
  getMCPTools,
  callMCPTool,
} from "../services/mcp.service.js";

const app = new Hono();

/**
 * List user's MCP servers
 */
app.get("/servers", async (c) => {
  const user = c.get("user");
  const servers = await getUserMCPServers(user.id);
  return c.json(servers);
});

/**
 * Add a new MCP server
 */
app.post("/servers", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    name: string;
    url: string;
    authType: string;
    oauthProvider?: string;
    apiKey?: string;
  }>();

  const server = await addMCPServer(user.id, body);
  return c.json(server, 201);
});

/**
 * Get a specific MCP server
 */
app.get("/servers/:id", async (c) => {
  const user = c.get("user");
  const serverId = c.req.param("id");

  const server = await getMCPServer(user.id, serverId);

  if (!server) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json(server);
});

/**
 * Delete an MCP server
 */
app.delete("/servers/:id", async (c) => {
  const user = c.get("user");
  const serverId = c.req.param("id");

  await deleteMCPServer(user.id, serverId);
  return c.json({ success: true });
});

/**
 * Get tools from an MCP server
 */
app.get("/servers/:id/tools", async (c) => {
  const user = c.get("user");
  const auth0Token = c.get("auth0Token");
  const serverId = c.req.param("id");

  const result = await getMCPTools(user.id, serverId, auth0Token);

  if (result.requiresAuth) {
    return c.json(
      {
        error: "Authentication required",
        requiresAuth: result.requiresAuth,
      },
      401
    );
  }

  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }

  return c.json(result.data);
});

/**
 * Call a tool on an MCP server
 */
app.post("/servers/:id/tools/:toolName", async (c) => {
  const user = c.get("user");
  const auth0Token = c.get("auth0Token");
  const serverId = c.req.param("id");
  const toolName = c.req.param("toolName");
  const body = await c.req.json<Record<string, unknown>>();

  const result = await callMCPTool(
    user.id,
    serverId,
    toolName,
    body,
    auth0Token
  );

  if (result.requiresAuth) {
    return c.json(
      {
        error: "Authentication required",
        requiresAuth: result.requiresAuth,
      },
      401
    );
  }

  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }

  return c.json({ result: result.data });
});

export default app;
