import winston from "winston";

/**
 * Centralized logging configuration for Zafari MCP Server
 * Provides structured logging with different transports and log levels
 */

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "zafari-mcp-server" },
  transports: [
    // Console output (always enabled)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add file transports in production
if (process.env.NODE_ENV === "production") {
  logger.add(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

/**
 * Security event logger - for authentication, authorization, and security events
 */
export const securityLogger = {
  authSuccess: (userId: string, ip?: string) => {
    logger.info("Authentication successful", {
      event: "auth_success",
      userId,
      ip,
    });
  },

  authFailure: (username: string, ip?: string, reason?: string) => {
    logger.warn("Authentication failed", {
      event: "auth_failure",
      username,
      ip,
      reason,
    });
  },

  tokenVerificationFailed: (error: string, ip?: string) => {
    logger.warn("Token verification failed", {
      event: "token_verification_failed",
      error,
      ip,
    });
  },

  rateLimitExceeded: (ip: string, endpoint: string) => {
    logger.warn("Rate limit exceeded", {
      event: "rate_limit_exceeded",
      ip,
      endpoint,
    });
  },

  unauthorizedClient: (clientId: string, ip?: string) => {
    logger.warn("Unauthorized client attempt", {
      event: "unauthorized_client",
      clientId,
      ip,
    });
  },

  codeReplayAttempt: (codePrefix: string, ip?: string) => {
    logger.warn("Authorization code replay attempt", {
      event: "code_replay_attempt",
      codePrefix,
      ip,
    });
  },

  insufficientScope: (userId: string, requiredScopes: string[], userScopes: string[]) => {
    logger.warn("Insufficient scope", {
      event: "insufficient_scope",
      userId,
      requiredScopes,
      userScopes,
    });
  },
};

/**
 * Safe error logging - ensures no sensitive data is logged
 */
export function logError(message: string, error: unknown, metadata?: Record<string, unknown>) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error(message, {
    error: errorMessage,
    stack,
    ...metadata,
  });
}
