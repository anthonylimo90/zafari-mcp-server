#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cookieParser from "cookie-parser";
import { registerPropertyTools } from "./tools/properties.js";
import { registerRoomTools } from "./tools/rooms.js";
import { registerExtraServiceTools } from "./tools/extras.js";
import { registerBookingTools } from "./tools/bookings.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import oauthRouter from "./routes/oauth.js";
import { authenticateToken } from "./middleware/auth.js";

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

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

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
    console.error("====================================");
    console.error("Zafari MCP Server with OAuth 2.1");
    console.error("====================================");
    console.error(`MCP Endpoint: http://${host}:${port}/mcp`);
    console.error(`OAuth Metadata: http://${host}:${port}/.well-known/oauth-authorization-server`);
    console.error(`Authorization: http://${host}:${port}/oauth/authorize`);
    console.error(`Health Check: http://${host}:${port}/health`);
    console.error("====================================");
    console.error("OAuth Credentials (Development):");
    console.error("  Username: demo");
    console.error("  Password: demo123");
    console.error("====================================");
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
