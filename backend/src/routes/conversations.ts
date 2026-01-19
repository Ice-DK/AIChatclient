import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";

const app = new Hono();

/**
 * List user's conversations
 */
app.get("/", async (c) => {
  const user = c.get("user");

  const conversations = await db.query.conversations.findMany({
    where: eq(schema.conversations.userId, user.id),
    orderBy: [desc(schema.conversations.updatedAt)],
  });

  return c.json(conversations);
});

/**
 * Create a new conversation
 */
app.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ title?: string }>();

  const [conversation] = await db
    .insert(schema.conversations)
    .values({
      userId: user.id,
      title: body.title || "Ny samtale",
    })
    .returning();

  return c.json(conversation, 201);
});

/**
 * Get a specific conversation
 */
app.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, id),
  });

  if (!conversation || conversation.userId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json(conversation);
});

/**
 * Update conversation title
 */
app.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{ title: string }>();

  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, id),
  });

  if (!conversation || conversation.userId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }

  const [updated] = await db
    .update(schema.conversations)
    .set({ title: body.title, updatedAt: new Date() })
    .where(eq(schema.conversations.id, id))
    .returning();

  return c.json(updated);
});

/**
 * Delete a conversation
 */
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, id),
  });

  if (!conversation || conversation.userId !== user.id) {
    return c.json({ error: "Not found" }, 404);
  }

  await db
    .delete(schema.conversations)
    .where(eq(schema.conversations.id, id));

  return c.json({ success: true });
});

export default app;
