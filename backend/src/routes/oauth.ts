import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import crypto from "crypto";
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getAtlassianResources,
  saveOAuthConnection,
  getUserOAuthConnections,
  deleteOAuthConnection,
  OAuthProvider,
} from "../services/oauth.service.js";

const app = new Hono();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * List user's OAuth connections
 */
app.get("/connections", async (c) => {
  const user = c.get("user");
  const connections = await getUserOAuthConnections(user.id);
  return c.json(connections);
});

/**
 * Delete an OAuth connection
 */
app.delete("/connections/:id", async (c) => {
  const user = c.get("user");
  const connectionId = c.req.param("id");
  await deleteOAuthConnection(user.id, connectionId);
  return c.json({ success: true });
});

/**
 * Start OAuth flow for a provider
 */
app.get("/:provider/authorize", async (c) => {
  const user = c.get("user");
  const provider = c.req.param("provider") as OAuthProvider;

  // Validate provider
  if (!["atlassian", "microsoft_partner_center"].includes(provider)) {
    return c.json({ error: "Invalid provider" }, 400);
  }

  // Generate state with user ID for security
  const state = crypto.randomBytes(32).toString("hex");
  const stateData = JSON.stringify({ state, userId: user.id });
  const encodedState = Buffer.from(stateData).toString("base64url");

  // Store state in cookie (expires in 10 minutes)
  setCookie(c, "oauth_state", encodedState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${process.env.BACKEND_URL}/api/oauth/${provider}/callback`;
  const authUrl = getAuthorizationUrl(provider, encodedState, redirectUri);

  return c.redirect(authUrl);
});

/**
 * OAuth callback handler
 */
app.get("/:provider/callback", async (c) => {
  const provider = c.req.param("provider") as OAuthProvider;
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  // Handle OAuth errors
  if (error) {
    return c.redirect(
      `${FRONTEND_URL}/settings?oauth_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return c.redirect(`${FRONTEND_URL}/settings?oauth_error=missing_params`);
  }

  // Verify state
  const storedState = getCookie(c, "oauth_state");
  if (state !== storedState) {
    return c.redirect(`${FRONTEND_URL}/settings?oauth_error=invalid_state`);
  }

  // Decode state to get user ID
  let userId: string;
  try {
    const stateData = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    );
    userId = stateData.userId;
  } catch {
    return c.redirect(`${FRONTEND_URL}/settings?oauth_error=invalid_state`);
  }

  try {
    const redirectUri = `${process.env.BACKEND_URL}/api/oauth/${provider}/callback`;
    const tokens = await exchangeCodeForTokens(provider, code, redirectUri);

    // For Atlassian, get accessible resources
    if (provider === "atlassian") {
      const resources = await getAtlassianResources(tokens.access_token);

      // Save connection for each Atlassian site
      for (const resource of resources) {
        await saveOAuthConnection(
          userId,
          provider,
          tokens,
          {
            cloudId: resource.id,
            siteName: resource.name,
            siteUrl: resource.url,
          },
          resource.id
        );
      }
    } else {
      // For other providers, save single connection
      await saveOAuthConnection(userId, provider, tokens);
    }

    // Clear state cookie
    setCookie(c, "oauth_state", "", { maxAge: 0, path: "/" });

    return c.redirect(`${FRONTEND_URL}/settings?oauth_success=${provider}`);
  } catch (error) {
    console.error(`OAuth callback error for ${provider}:`, error);
    return c.redirect(`${FRONTEND_URL}/settings?oauth_error=exchange_failed`);
  }
});

/**
 * Check OAuth connection status (for re-auth flow)
 */
app.get("/:provider/status", async (c) => {
  const user = c.get("user");
  const provider = c.req.param("provider") as OAuthProvider;

  const connections = await getUserOAuthConnections(user.id);
  const providerConnections = connections.filter(
    (conn) => conn.provider === provider
  );

  if (providerConnections.length === 0) {
    return c.json({ connected: false, needsReauth: false });
  }

  const needsReauth = providerConnections.some((conn) => conn.needsReauth);

  return c.json({
    connected: true,
    needsReauth,
    connections: providerConnections,
  });
});

export default app;
