import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Opret ny samtale
export const create = mutation({
  args: {
    userId: v.id("users"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("conversations", {
      userId: args.userId,
      title: args.title || "Ny samtale",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Hent brugerens samtaler
export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Hent en specifik samtale
export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Opdater samtale titel
export const updateTitle = mutation({
  args: {
    id: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

// Slet samtale og alle beskeder
export const remove = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    // Slet alle beskeder i samtalen
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Slet samtalen
    await ctx.db.delete(args.id);
  },
});
