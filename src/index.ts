#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { registerPropertyTools } from "./tools/properties.js";
import { registerRoomTools } from "./tools/rooms.js";
import { registerExtraServiceTools } from "./tools/extras.js";
import { registerBookingTools } from "./tools/bookings.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import oauthRouter from "./routes/oauth.js";
import { authenticateToken } from "./middleware/auth.js";
import { logger, securityLogger } from "./services/logger.js";

// Initialize MCP server
const server = new McpServer({
  name: "zafari-mcp-server",
  version: "1.0.0",
});

// Register all tool groups
registerPropertyTools(server);
registerRoomTools(server);
registerExtraServiceTools(server);
registerBookingTools(server);
registerWebhookTools(server);

/**
 * Run server with stdio transport (for local integrations)
 */
async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Zafari MCP Server running on stdio");
}

/**
 * Run server with HTTP transport (for remote access with OAuth)
 */
async function runHTTP(): Promise<void> {
  const app = express();

  // Trust proxy - important for rate limiting and IP logging
  app.set("trust proxy", 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // CORS configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : ["https://claude.ai"];

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      optionsSuccessStatus: 200,
    })
  );

  // Rate limiting - strict for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: { error: "too_many_requests", error_description: "Too many authentication attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      securityLogger.rateLimitExceeded(req.ip || "unknown", req.path);
      res.status(429).json({
        error: "too_many_requests",
        error_description: "Too many authentication attempts, please try again later",
      });
    },
  });

  // Rate limiting - generous for API endpoints
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests
    message: { error: "too_many_requests", error_description: "Too many requests, please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      securityLogger.rateLimitExceeded(req.ip || "unknown", req.path);
      res.status(429).json({
        error: "too_many_requests",
        error_description: "Too many requests, please slow down",
      });
    },
  });

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Request logging
  app.use((req, _res, next) => {
    logger.info("HTTP request", {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    next();
  });

  // Apply rate limiting to auth endpoints
  app.use("/oauth/authorize", authLimiter);
  app.use("/oauth/token", authLimiter);

  // OAuth routes (must come before auth middleware)
  app.use(oauthRouter);

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "zafari-mcp-server",
      version: "1.0.0",
      oauth: "enabled"
    });
  });

  // Apply authentication middleware to all MCP endpoints
  app.use("/mcp", apiLimiter); // Rate limit for MCP endpoints
  app.use(authenticateToken);

  // MCP endpoint (protected)
  app.post("/mcp", async (req, res) => {
    // Create new transport for each request (stateless)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3000");
  const host = process.env.HOST || "localhost";

  app.listen(port, () => {
    logger.info("====================================");
    logger.info("Zafari MCP Server with OAuth 2.1");
    logger.info("====================================");
    logger.info(`MCP Endpoint: http://${host}:${port}/mcp`);
    logger.info(`OAuth Metadata: http://${host}:${port}/.well-known/oauth-authorization-server`);
    logger.info(`Authorization: http://${host}:${port}/oauth/authorize`);
    logger.info(`Health Check: http://${host}:${port}/health`);
    logger.info("====================================");
    logger.info("Security Features Enabled:");
    logger.info("  ✓ Rate Limiting (Auth: 5/15min, API: 100/min)");
    logger.info("  ✓ CORS Protection");
    logger.info("  ✓ Security Headers (Helmet)");
    logger.info("  ✓ Request Logging");
    logger.info("  ✓ Password Hashing (bcrypt)");
    logger.info(`  ✓ Token Storage: ${process.env.STORAGE_BACKEND || "memory"}`);
    logger.info("====================================");
    if (process.env.NODE_ENV !== "production") {
      logger.info("OAuth Credentials (Development):");
      logger.info("  Username: demo");
      logger.info("  Password: (set in .env)");
      logger.info("====================================");
    }
  });
}

// Main execution
async function main(): Promise<void> {
  // Validate API key
  if (!process.env.ZAFARI_API_KEY) {
    console.error("Error: ZAFARI_API_KEY environment variable is required");
    console.error("\nUsage:");
    console.error("  ZAFARI_API_KEY=your-api-key node dist/index.js");
    console.error("\nOptional environment variables:");
    console.error("  TRANSPORT=http|stdio (default: stdio)");
    console.error("  PORT=3000 (only for http transport)");
    process.exit(1);
  }

  // Choose transport based on environment
  const transport = process.env.TRANSPORT || "stdio";

  if (transport === "http") {
    await runHTTP();
  } else {
    await runStdio();
  }
}

// Handle errors
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
