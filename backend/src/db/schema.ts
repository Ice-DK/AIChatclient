import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  unique,
  vector,
} from "drizzle-orm/pg-core";

// ============================================
// Users (synced from Auth0)
// ============================================
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auth0Id: varchar("auth0_id", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    picture: text("picture"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_users_auth0_id").on(table.auth0Id),
    index("idx_users_email").on(table.email),
  ]
);

// ============================================
// OAuth Connections (Atlassian, Partner Center, etc.)
// ============================================
export const oauthConnections = pgTable(
  "oauth_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // 'atlassian', 'microsoft_partner_center'
    providerUserId: varchar("provider_user_id", { length: 255 }),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scopes: text("scopes").array(),
    metadata: jsonb("metadata"), // cloudId for Atlassian, tenantId for Microsoft, etc.
    isEnabled: boolean("is_enabled").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_oauth_user_provider").on(table.userId, table.provider),
    unique("uq_oauth_connection").on(
      table.userId,
      table.provider,
      table.providerUserId
    ),
  ]
);

// ============================================
// Conversations
// ============================================
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_conversations_user").on(table.userId)]
);

// ============================================
// Messages (with embedding for RAG)
// ============================================
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // 'user', 'assistant', 'system', 'tool'
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }), // For RAG search
    metadata: jsonb("metadata"), // tools_used, is_error, mcp_server, etc.
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_messages_conversation").on(table.conversationId)]
);

// ============================================
// MCP Server Configurations (per user)
// ============================================
export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    url: text("url").notNull(),
    authType: varchar("auth_type", { length: 50 }).notNull(), // 'none', 'auth0_token', 'api_key', 'oauth'
    oauthProvider: varchar("oauth_provider", { length: 50 }), // Links to oauth_connections.provider
    apiKeyEncrypted: text("api_key_encrypted"), // For 'api_key' auth type
    isEnabled: boolean("is_enabled").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_mcp_servers_user").on(table.userId),
    unique("uq_mcp_server_name").on(table.userId, table.name),
  ]
);

// ============================================
// Type exports
// ============================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type OAuthConnection = typeof oauthConnections.$inferSelect;
export type NewOAuthConnection = typeof oauthConnections.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type McpServer = typeof mcpServers.$inferSelect;
export type NewMcpServer = typeof mcpServers.$inferInsert;
