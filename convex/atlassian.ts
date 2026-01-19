import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

// Atlassian API for OAuth
const ATLASSIAN_API_BASE = "https://api.atlassian.com";

// Hent brugerens Atlassian connections
export const getConnections = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("atlassianConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Hent enabled Atlassian connection
export const getEnabledConnection = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const connections = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    return connections.find((c) => c.isEnabled) || null;
  },
});

// Gem ny Atlassian connection
export const saveConnection = mutation({
  args: {
    userId: v.id("users"),
    cloudId: v.string(),
    siteName: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Tjek om connection allerede eksisterer
    const existing = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_user_cloudId", (q) => 
        q.eq("userId", args.userId).eq("cloudId", args.cloudId)
      )
      .first();

    if (existing) {
      // Opdater eksisterende
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        scopes: args.scopes,
        updatedAt: now,
      });
      return existing._id;
    }

    // Opret ny
    return await ctx.db.insert("atlassianConnections", {
      userId: args.userId,
      cloudId: args.cloudId,
      siteName: args.siteName,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      scopes: args.scopes,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Toggle Atlassian connection
export const toggleConnection = mutation({
  args: {
    connectionId: v.id("atlassianConnections"),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      isEnabled: args.isEnabled,
      updatedAt: Date.now(),
    });
  },
});

// Slet Atlassian connection
export const deleteConnection = mutation({
  args: { connectionId: v.id("atlassianConnections") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.connectionId);
  },
});

// Exchange OAuth code for tokens (via Atlassian)
export const exchangeOAuthCode = action({
  args: {
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (_ctx, args): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    scope: string;
  }> => {
    const clientId = process.env.ATLASSIAN_CLIENT_ID;
    const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Atlassian OAuth credentials not configured");
    }

    const response = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code: args.code,
        redirect_uri: args.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token exchange failed: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  },
});

// Hent accessible Atlassian resources (cloud sites)
export const getAccessibleResources = action({
  args: { accessToken: v.string() },
  handler: async (_ctx, args): Promise<Array<{ id: string; name: string; url: string }>> => {
    try {
      const response = await fetch(`${ATLASSIAN_API_BASE}/oauth/token/accessible-resources`, {
        headers: {
          "Authorization": `Bearer ${args.accessToken}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get resources: ${response.status}`);
      }

      const resources = await response.json();
      return resources.map((r: { id: string; name: string; url: string }) => ({
        id: r.id,
        name: r.name,
        url: r.url,
      }));
    } catch (error) {
      console.error("Failed to get Atlassian resources:", error);
      return [];
    }
  },
});
