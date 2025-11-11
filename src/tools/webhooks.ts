import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAPIClient } from "../services/api-client.js";
import { WebhookConfig } from "../types.js";
import { GetWebhookConfigSchema, UpdateWebhookConfigSchema } from "../schemas/index.js";

export function registerWebhookTools(server: McpServer): void {
  /**
   * Get webhook configuration
   */
  server.registerTool(
    "zafari_get_webhook_config",
    {
      title: "Get Webhook Configuration",
      description: "Retrieve webhook configuration including callback URL, subscribed events, and optional filters for rooms or services.",
      inputSchema: GetWebhookConfigSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const client = getAPIClient();
        const config = await client.get<WebhookConfig>(
          `/properties/${params.property_id}/kvs/webhook`
        );

        const output = {
          property_id: params.property_id,
          webhook_config: config,
        };

        const markdown = `# Webhook Configuration
**Property ID:** ${params.property_id}
**Webhook URL:** ${config.url || "Not configured"}
**Events:** ${config.events?.length ? config.events.join(", ") : "None"}
${config.rooms?.length ? `**Room Filters:** ${config.rooms.join(", ")}` : ""}
${config.extra_services?.length ? `**Extra Service Filters:** ${config.extra_services.join(", ")}` : ""}`;

        return {
          content: [{ type: "text", text: markdown }],
          structuredContent: output,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching webhook config: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  /**
   * Update webhook configuration
   */
  server.registerTool(
    "zafari_update_webhook_config",
    {
      title: "Update Webhook Configuration",
      description: "Configure webhook notifications for events like bookings, availability, or rate changes. Specify URL and event types to subscribe.",
      inputSchema: UpdateWebhookConfigSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const client = getAPIClient();
        await client.put(
          `/properties/${params.property_id}/kvs/webhook`,
          {
            url: params.url,
            events: params.events,
            rooms: params.rooms,
            extra_services: params.extra_services,
          }
        );

        return {
          content: [{
            type: "text",
            text: `✅ Webhook configuration updated successfully!

**URL:** ${params.url}
**Events:** ${params.events.join(", ")}
${params.rooms?.length ? `**Room Filters:** ${params.rooms.join(", ")}` : "**Room Filters:** None (all rooms)"}
${params.extra_services?.length ? `**Extra Service Filters:** ${params.extra_services.join(", ")}` : "**Extra Service Filters:** None (all services)"}

Your endpoint will now receive POST requests for the configured events.`
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error updating webhook config: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}
