import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAPIClient } from "../services/api-client.js";
import { Booking, ResponseFormat } from "../types.js";
import {
  ListBookingsSchema,
  GetBookingSchema,
  CreateBookingSchema,
  UpdateBookingStatusSchema,
} from "../schemas/index.js";
import { formatBookingMarkdown, formatList, truncateIfNeeded } from "../services/formatters.js";

export function registerBookingTools(server: McpServer): void {
  /**
   * List bookings for a property
   */
  server.registerTool(
    "zafari_list_bookings",
    {
      title: "List Bookings",
      description: "Get all bookings for a property with optional filters for status, date range, and pagination support.",
      inputSchema: ListBookingsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const client = getAPIClient();
        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          offset: params.offset,
        };
        if (params.status) queryParams.status = params.status;
        if (params.from_date) queryParams.from_date = params.from_date;
        if (params.to_date) queryParams.to_date = params.to_date;

        const bookings = await client.get<Booking[]>(
          `/properties/${params.property_id}/bookings`,
          queryParams
        );

        if (params.response_format === ResponseFormat.JSON) {
          const output = {
            property_id: params.property_id,
            filters: {
              status: params.status,
              from_date: params.from_date,
              to_date: params.to_date,
            },
            pagination: {
              limit: params.limit,
              offset: params.offset,
              returned: bookings.length,
            },
            bookings,
          };
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
          };
        }

        const markdown = formatList(
          bookings,
          formatBookingMarkdown,
          "No bookings found matching the criteria."
        );

        const header = `# Bookings for Property ${params.property_id}
${params.status ? `**Status Filter:** ${params.status}` : ""}
${params.from_date || params.to_date ? `**Date Range:** ${params.from_date || "any"} to ${params.to_date || "any"}` : ""}
**Results:** ${bookings.length} bookings (offset: ${params.offset}, limit: ${params.limit})

---

`;

        return {
          content: [{ type: "text", text: truncateIfNeeded(header + markdown) }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching bookings: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  /**
   * Get a specific booking
   */
  server.registerTool(
    "zafari_get_booking",
    {
      title: "Get Booking Details",
      description: "Retrieve complete details for a specific booking including guest info, rooms, extras, and payment status.",
      inputSchema: GetBookingSchema,
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
        const booking = await client.get<Booking>(
          `/properties/${params.property_id}/bookings/${params.booking_id}`
        );

        if (params.response_format === ResponseFormat.JSON) {
          const output = { booking };
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
          };
        }

        const markdown = formatBookingMarkdown(booking);
        return {
          content: [{ type: "text", text: markdown }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching booking: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  /**
   * Create a new booking
   */
  server.registerTool(
    "zafari_create_booking",
    {
      title: "Create New Booking",
      description: "Create a new booking with guest details, room selections, and optional extra services. Returns booking ID and reference.",
      inputSchema: CreateBookingSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const client = getAPIClient();
        const booking = await client.post<Booking>(
          `/properties/${params.property_id}/bookings`,
          {
            check_in: params.check_in,
            check_out: params.check_out,
            guest_details: {
              first_name: params.guest_first_name,
              last_name: params.guest_last_name,
              email: params.guest_email,
              phone: params.guest_phone,
              country: params.guest_country,
            },
            rooms: params.rooms,
            extras: params.extras,
          }
        );

        const output = {
          success: true,
          message: "Booking created successfully",
          booking_id: booking.id,
          reference: booking.reference,
          booking,
        };

        return {
          content: [{
            type: "text",
            text: `✅ Booking created successfully!

**Booking ID:** ${booking.id}
**Reference:** ${booking.reference}
**Guest:** ${booking.guest_details.first_name} ${booking.guest_details.last_name}
**Check-in:** ${booking.check_in}
**Check-out:** ${booking.check_out}
**Total Amount:** ${booking.currency} ${booking.total_amount}
**Status:** ${booking.status}

Use booking ID ${booking.id} to retrieve or update this booking.`
          }],
          structuredContent: output,
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error creating booking: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );

  /**
   * Update booking status
   */
  server.registerTool(
    "zafari_update_booking_status",
    {
      title: "Update Booking Status",
      description: "Change a booking's status to pending, confirmed, cancelled, or completed. May affect inventory and financial records.",
      inputSchema: UpdateBookingStatusSchema,
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
          `/properties/${params.property_id}/bookings/${params.booking_id}/status`,
          { status: params.status }
        );

        return {
          content: [{
            type: "text",
            text: `✅ Booking ${params.booking_id} status updated to '${params.status}'.`
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error updating booking status: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}
