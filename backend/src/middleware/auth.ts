import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import * as jose from "jose";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

// Auth0 configuration
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN!;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE!;

// Cache for JWKS
let jwks: jose.JWTVerifyGetKey | null = null;

async function getJwks() {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(
      new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`)
    );
  }
  return jwks;
}

export interface AuthUser {
  id: string; // Database UUID
  auth0Id: string;
  email: string;
  name?: string;
  picture?: string;
}

// Extend Hono context with user
declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    auth0Token: string;
  }
}

/**
 * Auth middleware - verifies Auth0 JWT and syncs user to database
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing authorization header" });
  }

  const token = authHeader.slice(7);

  try {
    const jwksClient = await getJwks();
    const { payload } = await jose.jwtVerify(token, jwksClient, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: AUTH0_AUDIENCE,
    });

    const auth0Id = payload.sub!;
    const email = (payload.email as string) || `${auth0Id}@auth0.local`;
    const name = payload.name as string | undefined;
    const picture = payload.picture as string | undefined;

    // Upsert user in database
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.auth0Id, auth0Id),
    });

    let user: AuthUser;

    if (existingUser) {
      // Update last seen
      await db
        .update(schema.users)
        .set({ lastSeen: new Date(), name, picture })
        .where(eq(schema.users.auth0Id, auth0Id));

      user = {
        id: existingUser.id,
        auth0Id,
        email: existingUser.email,
        name: name || existingUser.name || undefined,
        picture: picture || existingUser.picture || undefined,
      };
    } else {
      // Create new user
      const [newUser] = await db
        .insert(schema.users)
        .values({ auth0Id, email, name, picture })
        .returning();

      user = {
        id: newUser.id,
        auth0Id,
        email,
        name: name || undefined,
        picture: picture || undefined,
      };
    }

    c.set("user", user);
    c.set("auth0Token", token);

    await next();
  } catch (error) {
    console.error("Auth error:", error);
    throw new HTTPException(401, { message: "Invalid token" });
  }
});
