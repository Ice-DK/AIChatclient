import { db, schema } from "../db/index.js";
import { eq, and, lt } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/encryption.js";

// OAuth provider configurations
const OAUTH_PROVIDERS = {
  atlassian: {
    authUrl: "https://auth.atlassian.com/authorize",
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    clientId: process.env.ATLASSIAN_CLIENT_ID!,
    clientSecret: process.env.ATLASSIAN_CLIENT_SECRET!,
    scopes: [
      "read:jira-user",
      "read:jira-work",
      "write:jira-work",
      "read:confluence-space.summary",
      "read:confluence-content.all",
      "offline_access",
    ],
    accessibleResourcesUrl:
      "https://api.atlassian.com/oauth/token/accessible-resources",
  },
  microsoft_partner_center: {
    authUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientId: process.env.MS_PARTNER_CLIENT_ID!,
    clientSecret: process.env.MS_PARTNER_CLIENT_SECRET!,
    scopes: [
      "https://api.partnercenter.microsoft.com/user_impersonation",
      "offline_access",
    ],
  },
} as const;

export type OAuthProvider = keyof typeof OAUTH_PROVIDERS;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface AtlassianResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthorizationUrl(
  provider: OAuthProvider,
  state: string,
  redirectUri: string
): string {
  const config = OAUTH_PROVIDERS[provider];
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    prompt: "consent",
  });

  // Atlassian requires audience parameter
  if (provider === "atlassian") {
    params.set("audience", "api.atlassian.com");
  }

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const config = OAUTH_PROVIDERS[provider];

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  provider: OAuthProvider,
  refreshToken: string
): Promise<TokenResponse> {
  const config = OAUTH_PROVIDERS[provider];

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}

/**
 * Get Atlassian accessible resources (sites)
 */
export async function getAtlassianResources(
  accessToken: string
): Promise<AtlassianResource[]> {
  const response = await fetch(
    OAUTH_PROVIDERS.atlassian.accessibleResourcesUrl,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get Atlassian resources: ${response.status}`);
  }

  return response.json();
}

/**
 * Save OAuth connection to database
 */
export async function saveOAuthConnection(
  userId: string,
  provider: OAuthProvider,
  tokens: TokenResponse,
  metadata?: Record<string, unknown>,
  providerUserId?: string
) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Check if connection already exists
  const existing = await db.query.oauthConnections.findFirst({
    where: and(
      eq(schema.oauthConnections.userId, userId),
      eq(schema.oauthConnections.provider, provider),
      providerUserId
        ? eq(schema.oauthConnections.providerUserId, providerUserId)
        : undefined
    ),
  });

  const connectionData = {
    accessTokenEncrypted: encrypt(tokens.access_token),
    refreshTokenEncrypted: tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : null,
    expiresAt,
    metadata: metadata || {},
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(schema.oauthConnections)
      .set(connectionData)
      .where(eq(schema.oauthConnections.id, existing.id));
    return existing.id;
  } else {
    const [connection] = await db
      .insert(schema.oauthConnections)
      .values({
        userId,
        provider,
        providerUserId,
        ...connectionData,
        scopes: OAUTH_PROVIDERS[provider].scopes,
      })
      .returning();
    return connection.id;
  }
}

/**
 * Get valid access token for a provider (refreshes if expired)
 * Returns null if re-authentication is required
 */
export async function getValidAccessToken(
  userId: string,
  provider: OAuthProvider
): Promise<{ token: string; connectionId: string } | null> {
  const connection = await db.query.oauthConnections.findFirst({
    where: and(
      eq(schema.oauthConnections.userId, userId),
      eq(schema.oauthConnections.provider, provider),
      eq(schema.oauthConnections.isEnabled, true)
    ),
  });

  if (!connection) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired =
    connection.expiresAt &&
    new Date(connection.expiresAt).getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpired) {
    // Try to refresh
    if (connection.refreshTokenEncrypted) {
      try {
        const refreshToken = decrypt(connection.refreshTokenEncrypted);
        const newTokens = await refreshAccessToken(provider, refreshToken);

        // Save new tokens
        await saveOAuthConnection(
          userId,
          provider,
          newTokens,
          connection.metadata as Record<string, unknown>,
          connection.providerUserId || undefined
        );

        return { token: newTokens.access_token, connectionId: connection.id };
      } catch (error) {
        console.error(`Failed to refresh ${provider} token:`, error);
        // Mark connection as needing re-auth
        await db
          .update(schema.oauthConnections)
          .set({ isEnabled: false })
          .where(eq(schema.oauthConnections.id, connection.id));
        return null;
      }
    } else {
      // No refresh token, need re-auth
      await db
        .update(schema.oauthConnections)
        .set({ isEnabled: false })
        .where(eq(schema.oauthConnections.id, connection.id));
      return null;
    }
  }

  return {
    token: decrypt(connection.accessTokenEncrypted),
    connectionId: connection.id,
  };
}

/**
 * Get all OAuth connections for a user
 */
export async function getUserOAuthConnections(userId: string) {
  const connections = await db.query.oauthConnections.findMany({
    where: eq(schema.oauthConnections.userId, userId),
  });

  return connections.map((c) => ({
    id: c.id,
    provider: c.provider,
    providerUserId: c.providerUserId,
    isEnabled: c.isEnabled,
    expiresAt: c.expiresAt,
    metadata: c.metadata,
    needsReauth:
      !c.isEnabled ||
      (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

/**
 * Delete an OAuth connection
 */
export async function deleteOAuthConnection(
  userId: string,
  connectionId: string
) {
  await db
    .delete(schema.oauthConnections)
    .where(
      and(
        eq(schema.oauthConnections.id, connectionId),
        eq(schema.oauthConnections.userId, userId)
      )
    );
}
