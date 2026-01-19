import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Send besked
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    toolsUsed: v.optional(v.boolean()),
    isError: v.optional(v.boolean()),
    isMCPNotification: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Opdater samtale timestamp
    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
      toolsUsed: args.toolsUsed,
      isError: args.isError,
      isMCPNotification: args.isMCPNotification,
    });
  },
});

// Hent beskeder i en samtale
export const listByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

// Slet besked
export const remove = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Ryd alle beskeder i en samtale
export const clearConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
  },
});
