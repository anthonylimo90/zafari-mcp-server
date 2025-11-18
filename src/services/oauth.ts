import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { tokenStorage } from "./storage.js";
import { logger, securityLogger, logError } from "./logger.js";

/**
 * OAuth 2.1 utilities for MCP server with enhanced security
 * - Password hashing with bcrypt
 * - Configurable token storage (Redis/in-memory)
 * - Strict JWT secret validation
 * - Authorization code replay protection
 */

// Track used authorization codes to prevent replay attacks
const usedAuthCodes = new Set<string>();

// JWT secret (must be set via environment variable)
let jwtSecret: Uint8Array;

/**
 * Get and validate JWT secret
 * Enforces strict security requirements
 */
async function getJWTSecret(): Promise<Uint8Array> {
  if (!jwtSecret) {
    const secretEnv = process.env.JWT_SECRET;

    // Strict requirement: JWT_SECRET must be set
    if (!secretEnv) {
      throw new Error(
        "JWT_SECRET environment variable is required. Generate one with: openssl rand -base64 64"
      );
    }

    // Validate minimum length
    if (secretEnv.length < 32) {
      throw new Error(
        "JWT_SECRET must be at least 32 characters long for security"
      );
    }

    jwtSecret = new TextEncoder().encode(secretEnv);
    logger.info("JWT secret loaded successfully");
  }
  return jwtSecret;
}

/**
 * Hash password with bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against bcrypt hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Get hashed passwords from environment
 * In production, these should be pre-hashed in the database
 */
async function getHashedPasswords(): Promise<Map<string, string>> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const demoPassword = process.env.DEMO_PASSWORD;

  // Validate password requirements
  const validatePassword = (password: string | undefined, name: string): string => {
    if (!password) {
      throw new Error(
        `${name} environment variable is required. Set a strong password (minimum 12 characters).`
      );
    }

    if (password.length < 12) {
      throw new Error(
        `${name} must be at least 12 characters long. Current length: ${password.length}`
      );
    }

    // Check for basic complexity
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      logger.warn(
        `${name} should contain uppercase, lowercase, numbers, and special characters for better security`
      );
    }

    return password;
  };

  const validatedAdminPw = validatePassword(adminPassword, "ADMIN_PASSWORD");
  const validatedDemoPw = validatePassword(demoPassword, "DEMO_PASSWORD");

  // Hash passwords (in production, these would be pre-hashed in database)
  const hashedPasswords = new Map<string, string>();
  hashedPasswords.set("admin", await hashPassword(validatedAdminPw));
  hashedPasswords.set("demo", await hashPassword(validatedDemoPw));

  return hashedPasswords;
}

// Cache hashed passwords (initialized on first use)
let hashedPasswordsCache: Map<string, string> | null = null;

/**
 * Generate authorization code
 */
export async function generateAuthCode(
  userId: string,
  codeChallenge?: string
): Promise<string> {
  const code = crypto.randomBytes(32).toString("base64url");
  await tokenStorage.setAuthCode(code, {
    userId,
    codeChallenge,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  return code;
}

/**
 * Verify and consume authorization code
 * Includes replay attack protection
 */
export async function verifyAuthCode(
  code: string,
  codeVerifier?: string
): Promise<{ userId: string } | null> {
  // Check for replay attacks
  if (usedAuthCodes.has(code)) {
    securityLogger.codeReplayAttempt(code.substring(0, 10));
    return null;
  }

  const data = await tokenStorage.getAuthCode(code);
  if (!data) return null;

  // Check expiration
  if (Date.now() > data.expiresAt) {
    await tokenStorage.deleteAuthCode(code);
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
  await tokenStorage.deleteAuthCode(code);
  usedAuthCodes.add(code);

  // Clean up used codes after 1 hour
  setTimeout(() => usedAuthCodes.delete(code), 60 * 60 * 1000);

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
export async function generateRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await tokenStorage.setRefreshToken(token, {
    userId,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  return token;
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(
  token: string
): Promise<{ userId: string } | null> {
  const data = await tokenStorage.getRefreshToken(token);
  if (!data) return null;

  if (Date.now() > data.expiresAt) {
    await tokenStorage.deleteRefreshToken(token);
    return null;
  }

  return { userId: data.userId };
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  await tokenStorage.deleteRefreshToken(token);
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
    logError("Token verification failed", error);
    return null;
  }
}

/**
 * Authenticate user with bcrypt password verification
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<string | null> {
  try {
    // Initialize password cache if needed
    if (!hashedPasswordsCache) {
      hashedPasswordsCache = await getHashedPasswords();
    }

    const storedHash = hashedPasswordsCache.get(username);
    if (!storedHash) {
      return null;
    }

    // Use bcrypt's constant-time comparison
    const isValid = await verifyPassword(password, storedHash);
    if (isValid) {
      return username; // Return user ID
    }

    return null;
  } catch (error) {
    logError("Authentication error", error);
    return null;
  }
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
