import { SignJWT, jwtVerify, generateSecret } from "jose";
import crypto from "crypto";

/**
 * OAuth 2.1 utilities for MCP server
 * Implements a simple OAuth server for development/testing
 */

// In-memory storage (replace with database in production)
const authCodes = new Map<string, { userId: string; codeChallenge?: string; expiresAt: number }>();
const refreshTokens = new Map<string, { userId: string; expiresAt: number }>();

// JWT secret (generate once and store securely in production)
let jwtSecret: Uint8Array;

async function getJWTSecret(): Promise<Uint8Array> {
  if (!jwtSecret) {
    // In production, load this from environment or secure storage
    const secretEnv = process.env.JWT_SECRET;
    if (secretEnv) {
      jwtSecret = new TextEncoder().encode(secretEnv);
    } else {
      // Generate a new secret (only for development)
      const generatedSecret = await generateSecret("HS256");
      // Convert CryptoKey to Uint8Array
      const keyBuffer = await crypto.subtle.exportKey("raw", generatedSecret as crypto.webcrypto.CryptoKey);
      jwtSecret = new Uint8Array(keyBuffer);
      console.warn("⚠️  Generated new JWT secret. Set JWT_SECRET env var for production.");
    }
  }
  return jwtSecret;
}

/**
 * Generate authorization code
 */
export function generateAuthCode(userId: string, codeChallenge?: string): string {
  const code = crypto.randomBytes(32).toString("base64url");
  authCodes.set(code, {
    userId,
    codeChallenge,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  return code;
}

/**
 * Verify and consume authorization code
 */
export function verifyAuthCode(
  code: string,
  codeVerifier?: string
): { userId: string } | null {
  const data = authCodes.get(code);
  if (!data) return null;

  // Check expiration
  if (Date.now() > data.expiresAt) {
    authCodes.delete(code);
    return null;
  }

  // Verify PKCE if provided
  if (data.codeChallenge) {
    if (!codeVerifier) return null;
    const hash = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    if (hash !== data.codeChallenge) return null;
  }

  // Consume code (one-time use)
  authCodes.delete(code);
  return { userId: data.userId };
}

/**
 * Generate access token (JWT)
 */
export async function generateAccessToken(
  userId: string,
  scopes: string[] = ["mcp:*"]
): Promise<string> {
  const secret = await getJWTSecret();
  const token = await new SignJWT({
    sub: userId,
    scope: scopes.join(" "),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(process.env.OAUTH_ISSUER || "zafari-mcp-server")
    .setAudience(process.env.OAUTH_AUDIENCE || "zafari-mcp-api")
    .setExpirationTime("1h") // 1 hour
    .sign(secret);

  return token;
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: string): string {
  const token = crypto.randomBytes(32).toString("base64url");
  refreshTokens.set(token, {
    userId,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  return token;
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { userId: string } | null {
  const data = refreshTokens.get(token);
  if (!data) return null;

  if (Date.now() > data.expiresAt) {
    refreshTokens.delete(token);
    return null;
  }

  return { userId: data.userId };
}

/**
 * Revoke refresh token
 */
export function revokeRefreshToken(token: string): void {
  refreshTokens.delete(token);
}

/**
 * Verify access token (JWT)
 */
export async function verifyAccessToken(token: string): Promise<{
  userId: string;
  scopes: string[];
} | null> {
  try {
    const secret = await getJWTSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: process.env.OAUTH_ISSUER || "zafari-mcp-server",
      audience: process.env.OAUTH_AUDIENCE || "zafari-mcp-api",
    });

    return {
      userId: payload.sub as string,
      scopes: (payload.scope as string)?.split(" ") || [],
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

/**
 * Simple user authentication (replace with real auth in production)
 */
export function authenticateUser(username: string, password: string): string | null {
  // In production, verify against database with hashed passwords
  const validUsers = new Map<string, string>([
    ["admin", process.env.ADMIN_PASSWORD || "admin123"],
    ["demo", process.env.DEMO_PASSWORD || "demo123"],
  ]);

  const storedPassword = validUsers.get(username);
  if (storedPassword && storedPassword === password) {
    return username; // Return user ID
  }

  return null;
}

/**
 * Validate redirect URI
 */
export function validateRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);

    // Allow localhost for development
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return true;
    }

    // Require HTTPS for remote URIs
    if (url.protocol === "https:") {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Clean up expired tokens (run periodically)
 */
export function cleanupExpiredTokens(): void {
  const now = Date.now();

  // Clean auth codes
  for (const [code, data] of authCodes.entries()) {
    if (now > data.expiresAt) {
      authCodes.delete(code);
    }
  }

  // Clean refresh tokens
  for (const [token, data] of refreshTokens.entries()) {
    if (now > data.expiresAt) {
      refreshTokens.delete(token);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);
