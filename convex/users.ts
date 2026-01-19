import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Hent eller opret bruger fra Auth0 data
export const upsertUser = mutation({
  args: {
    auth0Id: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    picture: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", args.auth0Id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        picture: args.picture,
        lastSeen: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      auth0Id: args.auth0Id,
      email: args.email,
      name: args.name,
      picture: args.picture,
      lastSeen: Date.now(),
    });
  },
});

// Hent bruger fra Auth0 ID
export const getByAuth0Id = query({
  args: { auth0Id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_auth0Id", (q) => q.eq("auth0Id", args.auth0Id))
      .first();
  },
});

// Hent bruger fra ID
export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
