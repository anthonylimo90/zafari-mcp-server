import { z } from "zod";

// Common schemas
export const ResponseFormatSchema = z.enum(["markdown", "json"])
  .default("json")
  .describe("Output format: 'json' for structured data (recommended for Claude Desktop) or 'markdown' for human-readable");

export const DateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .describe("Date in YYYY-MM-DD format");

export const PropertyIdSchema = z.string()
  .min(1, "Property ID is required")
  .describe("Property ID");

// Property schemas
export const ListPropertiesSchema = {
  response_format: ResponseFormatSchema,
};

// Room schemas
export const ListRoomsSchema = {
  property_id: PropertyIdSchema,
  response_format: ResponseFormatSchema,
};

export const GetRoomAvailabilitySchema = {
  property_id: PropertyIdSchema,
  room_id: z.string().min(1, "Room ID is required").describe("Room type ID"),
  from: DateSchema.describe("Start date for availability check"),
  to: DateSchema.describe("End date for availability check"),
  response_format: ResponseFormatSchema,
};

export const GetRoomRatesSchema = {
  property_id: PropertyIdSchema,
  room_id: z.string().min(1, "Room ID is required").describe("Room type ID"),
  from: DateSchema.describe("Start date for rates"),
  to: DateSchema.describe("End date for rates"),
  resident_type: z.enum(["resident", "non_resident"])
    .optional()
    .describe("Resident type filter (resident or non_resident)"),
  response_format: ResponseFormatSchema,
};

export const UpdateRoomAvailabilitySchema = {
  property_id: PropertyIdSchema,
  room_id: z.string().min(1, "Room ID is required").describe("Room type ID"),
  from: DateSchema.describe("Start date for availability update"),
  to: DateSchema.describe("End date for availability update"),
  availability: z.number()
    .int()
    .min(0, "Availability must be non-negative")
    .nullable()
    .describe("Number of available units (null for unlimited)"),
};

export const UpdateRoomRatesSchema = {
  property_id: PropertyIdSchema,
  room_id: z.string().min(1, "Room ID is required").describe("Room type ID"),
  from: DateSchema.describe("Start date for rate update"),
  to: DateSchema.describe("End date for rate update"),
  rate: z.number()
    .positive("Rate must be positive")
    .describe("Rate amount"),
  resident_type: z.enum(["resident", "non_resident"])
    .describe("Resident type (resident or non_resident)"),
};

// Extra service schemas
export const ListExtraServicesSchema = {
  property_id: PropertyIdSchema,
  response_format: ResponseFormatSchema,
};

export const GetExtraServiceAvailabilitySchema = {
  property_id: PropertyIdSchema,
  extra_service_id: z.string()
    .min(1, "Extra service ID is required")
    .describe("Extra service ID (UUID format)"),
  from: DateSchema.describe("Start date for availability check"),
  to: DateSchema.describe("End date for availability check"),
  response_format: ResponseFormatSchema,
};

export const UpdateExtraServiceAvailabilitySchema = {
  property_id: PropertyIdSchema,
  extra_service_id: z.string()
    .min(1, "Extra service ID is required")
    .describe("Extra service ID (UUID format)"),
  from: DateSchema.describe("Start date for availability update"),
  to: DateSchema.describe("End date for availability update"),
  availability: z.number()
    .int()
    .min(0, "Availability must be non-negative")
    .nullable()
    .describe("Number of available units (null for unlimited)"),
};

// Booking schemas
export const ListBookingsSchema = {
  property_id: PropertyIdSchema,
  status: z.enum(["pending", "confirmed", "cancelled", "completed"])
    .optional()
    .describe("Filter by booking status"),
  from_date: DateSchema.optional().describe("Filter bookings from this date"),
  to_date: DateSchema.optional().describe("Filter bookings until this date"),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("Maximum results to return (1-100)"),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip for pagination"),
  response_format: ResponseFormatSchema,
};

export const GetBookingSchema = {
  property_id: PropertyIdSchema,
  booking_id: z.string().min(1, "Booking ID is required").describe("Booking ID"),
  response_format: ResponseFormatSchema,
};

export const CreateBookingSchema = {
  property_id: PropertyIdSchema,
  check_in: DateSchema.describe("Check-in date"),
  check_out: DateSchema.describe("Check-out date"),
  guest_first_name: z.string().min(1, "Guest first name is required").describe("Guest first name"),
  guest_last_name: z.string().min(1, "Guest last name is required").describe("Guest last name"),
  guest_email: z.string().email("Invalid email format").describe("Guest email address"),
  guest_phone: z.string().optional().describe("Guest phone number"),
  guest_country: z.string().optional().describe("Guest country"),
  rooms: z.array(z.object({
    room_id: z.string().min(1, "Room ID is required"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
  })).min(1, "At least one room is required").describe("Array of room bookings"),
  extras: z.array(z.object({
    extra_service_id: z.string().min(1, "Extra service ID is required"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
  })).optional().describe("Array of extra service bookings"),
};

export const UpdateBookingStatusSchema = {
  property_id: PropertyIdSchema,
  booking_id: z.string().min(1, "Booking ID is required").describe("Booking ID"),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"])
    .describe("New booking status"),
};

// Webhook schemas
export const GetWebhookConfigSchema = {
  property_id: PropertyIdSchema,
};

export const UpdateWebhookConfigSchema = {
  property_id: PropertyIdSchema,
  url: z.string()
    .url("Invalid URL format")
    .describe("Webhook endpoint URL"),
  events: z.array(z.string())
    .min(1, "At least one event is required")
    .describe("Array of event types to listen for"),
  rooms: z.array(z.string())
    .optional()
    .describe("Array of room IDs to filter events (optional)"),
  extra_services: z.array(z.string())
    .optional()
    .describe("Array of extra service IDs to filter events (optional)"),
};
