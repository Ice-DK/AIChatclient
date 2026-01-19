import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { db, schema } from "../db/index.js";
import { eq, asc } from "drizzle-orm";
import { streamChat } from "../services/ai.service.js";

const app = new Hono();

/**
 * Get messages for a conversation
 */
app.get("/:conversationId/messages", async (c) => {
  const user = c.get("user");
  const conversationId = c.req.param("conversationId");

  // Verify conversation belongs to user
  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  });

  if (!conversation || conversation.userId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }

  const messages = await db.query.messages.findMany({
    where: eq(schema.messages.conversationId, conversationId),
    orderBy: [asc(schema.messages.createdAt)],
  });

  return c.json(messages);
});

/**
 * Send a message and get AI response (SSE streaming)
 */
app.post("/:conversationId/messages", async (c) => {
  const user = c.get("user");
  const auth0Token = c.get("auth0Token");
  const conversationId = c.req.param("conversationId");
  const body = await c.req.json<{ content: string }>();

  // Verify conversation belongs to user
  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  });

  if (!conversation || conversation.userId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }

  // Stream the response using SSE
  return streamSSE(c, async (stream) => {
    await streamChat(user.id, conversationId, body.content, auth0Token, {
      onToken: async (token) => {
        await stream.writeSSE({
          event: "token",
          data: JSON.stringify({ token }),
        });
      },
      onToolCall: async (toolName, serverId) => {
        await stream.writeSSE({
          event: "tool_call",
          data: JSON.stringify({ toolName, serverId }),
        });
      },
      onComplete: async (fullResponse) => {
        await stream.writeSSE({
          event: "complete",
          data: JSON.stringify({ content: fullResponse }),
        });
      },
      onError: async (error) => {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ error: error.message }),
        });
      },
      onAuthRequired: async (provider, reason) => {
        await stream.writeSSE({
          event: "auth_required",
          data: JSON.stringify({ provider, reason }),
        });
      },
    });
  });
});

/**
 * Delete a message
 */
app.delete("/:conversationId/messages/:messageId", async (c) => {
  const user = c.get("user");
  const conversationId = c.req.param("conversationId");
  const messageId = c.req.param("messageId");

  // Verify conversation belongs to user
  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  });

  if (!conversation || conversation.userId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }

  await db.delete(schema.messages).where(eq(schema.messages.id, messageId));

  return c.json({ success: true });
});

/**
 * Clear all messages in a conversation
 */
app.delete("/:conversationId/messages", async (c) => {
  const user = c.get("user");
  const conversationId = c.req.param("conversationId");

  // Verify conversation belongs to user
  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, conversationId),
  });

  if (!conversation || conversation.userId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }

  await db
    .delete(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId));

  return c.json({ success: true });
});

export default app;
