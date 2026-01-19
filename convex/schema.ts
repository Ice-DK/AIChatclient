import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Brugere synkroniseret fra Auth0
  users: defineTable({
    auth0Id: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    picture: v.optional(v.string()),
    lastSeen: v.number(),
  })
    .index("by_auth0Id", ["auth0Id"])
    .index("by_email", ["email"]),

  // Chat samtaler
  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Chat beskeder
  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    createdAt: v.number(),
    // Metadata for AI responses
    toolsUsed: v.optional(v.boolean()),
    isError: v.optional(v.boolean()),
    isMCPNotification: v.optional(v.boolean()),
  }).index("by_conversation", ["conversationId"]),

  // MCP Server konfigurationer (per bruger)
  mcpServers: defineTable({
    userId: v.id("users"),
    name: v.string(),
    url: v.string(),
    useAuth0Token: v.boolean(),
    isEnabled: v.boolean(),
    status: v.union(
      v.literal("disconnected"),
      v.literal("connected"),
      v.literal("error")
    ),
    lastConnected: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"]),

  // Atlassian OAuth connections (per bruger)
  atlassianConnections: defineTable({
    userId: v.id("users"),
    cloudId: v.string(),           // Atlassian site ID
    siteName: v.string(),          // e.g., "yourcompany.atlassian.net"
    accessToken: v.string(),       // OAuth access token
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scopes: v.array(v.string()),   // ["jira", "confluence", "compass"]
    isEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_cloudId", ["userId", "cloudId"]),
});
