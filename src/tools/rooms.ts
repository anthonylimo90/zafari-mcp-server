import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAPIClient } from "../services/api-client.js";
import { Room, RoomAvailability, RoomRate, ResponseFormat } from "../types.js";
import {
  ListRoomsSchema,
  GetRoomAvailabilitySchema,
  GetRoomRatesSchema,
  UpdateRoomAvailabilitySchema,
  UpdateRoomRatesSchema,
} from "../schemas/index.js";
import {
  formatRoomMarkdown,
  formatList,
  formatAvailabilityMarkdown,
  formatRatesMarkdown,
  truncateIfNeeded,
} from "../services/formatters.js";

export function registerRoomTools(server: McpServer): void {
  /**
   * List rooms for a property
   */
  server.registerTool(
    "zafari_list_rooms",
    {
      title: "List Property Rooms",
      description: "Get all room types/accommodation categories for a specific property, including capacity and characteristics.",
      inputSchema: ListRoomsSchema,
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
        const rooms = await client.get<Room[]>(
          `/properties/${params.property_id}/rooms`
        );

        if (params.response_format === ResponseFormat.JSON) {
          const output = { property_id: params.property_id, rooms };
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
          };
        }

        const markdown = formatList(
          rooms,
          formatRoomMarkdown,
          `No rooms found for property ${params.property_id}.`
        );

        return {
          content: [{ type: "text", text: truncateIfNeeded(markdown) }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching rooms: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  /**
   * Get room availability
   */
  server.registerTool(
    "zafari_get_room_availability",
    {
      title: "Get Room Availability",
      description: "Check daily availability (number of units) for a room type within a date range. Returns available units per day.",
      inputSchema: GetRoomAvailabilitySchema,
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
        const availability = await client.get<RoomAvailability[]>(
          `/properties/${params.property_id}/rooms/${params.room_id}/avl`,
          { from: params.from, to: params.to }
        );

        if (params.response_format === ResponseFormat.JSON) {
          const output = { 
            property_id: params.property_id,
            room_id: params.room_id,
            from: params.from,
            to: params.to,
            availability 
          };
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
          };
        }

        const markdown = `# Room Availability
**Property:** ${params.property_id}
**Room:** ${params.room_id}
**Period:** ${params.from} to ${params.to}

${formatAvailabilityMarkdown(availability)}`;

        return {
          content: [{ type: "text", text: markdown }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching availability: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  /**
   * Get room rates
   */
  server.registerTool(
    "zafari_get_room_rates",
    {
      title: "Get Room Rates",
      description: "Retrieve daily pricing for a room type within a date range, with optional filtering by resident type.",
      inputSchema: GetRoomRatesSchema,
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
        const queryParams: Record<string, unknown> = {
          from: params.from,
          to: params.to,
        };
        if (params.resident_type) {
          queryParams.resident_type = params.resident_type;
        }

        const rates = await client.get<RoomRate[]>(
          `/properties/${params.property_id}/rooms/${params.room_id}/rates`,
          queryParams
        );

        if (params.response_format === ResponseFormat.JSON) {
          const output = {
            property_id: params.property_id,
            room_id: params.room_id,
            from: params.from,
            to: params.to,
            resident_type: params.resident_type,
            rates,
          };
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
          };
        }

        const markdown = `# Room Rates
**Property:** ${params.property_id}
**Room:** ${params.room_id}
**Period:** ${params.from} to ${params.to}
${params.resident_type ? `**Resident Type:** ${params.resident_type}` : ""}

${formatRatesMarkdown(rates)}`;

        return {
          content: [{ type: "text", text: markdown }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching rates: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  /**
   * Update room availability
   */
  server.registerTool(
    "zafari_update_room_availability",
    {
      title: "Update Room Availability",
      description: "Set the number of available units for a room type across a date range. Use null for unlimited availability.",
      inputSchema: UpdateRoomAvailabilitySchema,
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
          `/properties/${params.property_id}/rooms/${params.room_id}/avl`,
          {
            from: params.from,
            to: params.to,
            availability: params.availability,
          }
        );

        const availText = params.availability === null 
          ? "unlimited" 
          : `${params.availability} units`;

        return {
          content: [{
            type: "text",
            text: `Successfully updated room availability to ${availText} for ${params.from} to ${params.to}.`
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error updating availability: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  /**
   * Update room rates
   */
  server.registerTool(
    "zafari_update_room_rates",
    {
      title: "Update Room Rates",
      description: "Set pricing for a room type across a date range for a specific resident type (resident or non-resident).",
      inputSchema: UpdateRoomRatesSchema,
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
          `/properties/${params.property_id}/rooms/${params.room_id}/rates`,
          {
            from: params.from,
            to: params.to,
            rate: params.rate,
            resident_type: params.resident_type,
          }
        );

        return {
          content: [{
            type: "text",
            text: `Successfully updated ${params.resident_type} rates to ${params.rate} for ${params.from} to ${params.to}.`
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error updating rates: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}
