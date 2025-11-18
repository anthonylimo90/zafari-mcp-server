import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/oauth.js";
import { securityLogger } from "../services/logger.js";

/**
 * Extend Express Request to include user info
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        scopes: string[];
      };
    }
  }
}

/**
 * OAuth Bearer Token Authentication Middleware
 * Validates access tokens for protected MCP endpoints
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth for OAuth endpoints and metadata
  const publicPaths = [
    "/oauth/authorize",
    "/oauth/token",
    "/.well-known/oauth-authorization-server",
    "/health",
  ];

  if (publicPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({
      error: "unauthorized",
      error_description: "Authorization header is required",
    });
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({
      error: "invalid_token",
      error_description: "Authorization header must be 'Bearer <token>'",
    });
    return;
  }

  const token = parts[1];

  // Verify token
  const user = await verifyAccessToken(token);
  if (!user) {
    securityLogger.tokenVerificationFailed("Invalid or expired token", req.ip);
    res.status(401).json({
      error: "invalid_token",
      error_description: "Invalid or expired access token",
    });
    return;
  }

  // Attach user to request
  req.user = user;
  next();
}

/**
 * Scope validation middleware
 * Checks if the user has the required scopes
 */
export function requireScopes(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "unauthorized",
        error_description: "Authentication required",
      });
      return;
    }

    const userScopes = req.user.scopes;
    const hasWildcard = userScopes.includes("mcp:*");

    if (hasWildcard) {
      return next();
    }

    const hasRequiredScopes = requiredScopes.every((scope) =>
      userScopes.includes(scope)
    );

    if (!hasRequiredScopes) {
      res.status(403).json({
        error: "insufficient_scope",
        error_description: `Required scopes: ${requiredScopes.join(", ")}`,
      });
      return;
    }

    next();
  };
}
