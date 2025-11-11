import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAPIClient } from "../services/api-client.js";
import { ExtraService, ExtraServiceAvailability, ResponseFormat } from "../types.js";
import {
  ListExtraServicesSchema,
  GetExtraServiceAvailabilitySchema,
  UpdateExtraServiceAvailabilitySchema,
} from "../schemas/index.js";
import {
  formatExtraServiceMarkdown,
  formatList,
  formatAvailabilityMarkdown,
  truncateIfNeeded,
} from "../services/formatters.js";

export function registerExtraServiceTools(server: McpServer): void {
  /**
   * List extra services for a property
   */
  server.registerTool(
    "zafari_list_extra_services",
    {
      title: "List Extra Services",
      description: "Get all extra services/add-ons for a property such as park fees, activities, meals, or equipment rentals.",
      inputSchema: ListExtraServicesSchema,
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
        const extras = await client.get<ExtraService[]>(
          `/properties/${params.property_id}/extras`
        );

        if (params.response_format === ResponseFormat.JSON) {
          const output = { property_id: params.property_id, extras };
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
          };
        }

        const markdown = formatList(
          extras,
          formatExtraServiceMarkdown,
          `No extra services found for property ${params.property_id}.`
        );

        return {
          content: [{ type: "text", text: truncateIfNeeded(markdown) }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching extra services: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  /**
   * Get extra service availability
   */
  server.registerTool(
    "zafari_get_extra_service_availability",
    {
      title: "Get Extra Service Availability",
      description: "Check daily availability (slots/capacity) for an extra service within a date range. Returns available slots per day.",
      inputSchema: GetExtraServiceAvailabilitySchema,
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
        const availability = await client.get<ExtraServiceAvailability[]>(
          `/properties/${params.property_id}/extra-services/${params.extra_service_id}/avl`,
          { from: params.from, to: params.to }
        );

        if (params.response_format === ResponseFormat.JSON) {
          const output = {
            property_id: params.property_id,
            extra_service_id: params.extra_service_id,
            from: params.from,
            to: params.to,
            availability,
          };
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
          };
        }

        const markdown = `# Extra Service Availability
**Property:** ${params.property_id}
**Service:** ${params.extra_service_id}
**Period:** ${params.from} to ${params.to}

${formatAvailabilityMarkdown(availability)}`;

        return {
          content: [{ type: "text", text: markdown }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching extra service availability: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  /**
   * Update extra service availability
   */
  server.registerTool(
    "zafari_update_extra_service_availability",
    {
      title: "Update Extra Service Availability",
      description: "Set the number of available slots for an extra service across a date range. Use null for unlimited capacity.",
      inputSchema: UpdateExtraServiceAvailabilitySchema,
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
          `/properties/${params.property_id}/extra-services/${params.extra_service_id}/avl`,
          {
            from: params.from,
            to: params.to,
            availability: params.availability,
          }
        );

        const availText = params.availability === null
          ? "unlimited"
          : `${params.availability} slots`;

        return {
          content: [{
            type: "text",
            text: `Successfully updated extra service availability to ${availText} for ${params.from} to ${params.to}.`
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error updating extra service availability: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}
