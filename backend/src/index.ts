import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth.js";

// Routes
import conversationsRoute from "./routes/conversations.js";
import messagesRoute from "./routes/messages.js";
import oauthRoute from "./routes/oauth.js";
import mcpRoute from "./routes/mcp.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Health check (no auth)
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// API routes (with auth)
const api = new Hono();
api.use("*", authMiddleware);

// Mount routes
api.route("/conversations", conversationsRoute);
api.route("/conversations", messagesRoute); // Messages are under /conversations/:id/messages
api.route("/oauth", oauthRoute);
api.route("/mcp", mcpRoute);

// User info endpoint
api.get("/me", (c) => {
  const user = c.get("user");
  return c.json(user);
});

app.route("/api", api);

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = parseInt(process.env.PORT || "3000", 10);

console.log(`🚀 Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
