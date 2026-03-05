import { z } from "zod";
import { DEFAULT_PAGE_SIZE } from "../constants.js";

export const OutputFormatSchema = z.enum(["json", "markdown", "text"]);
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const PropertyIdSchema = z.string().min(1, "Property ID is required");
export const RoomIdSchema = z.string().min(1, "Room ID is required");
export const BookingIdSchema = z.string().min(1, "Booking ID is required");
export const ExtraServiceIdSchema = z.string().min(1, "Extra service ID is required");

export const ResidentTypeSchema = z.enum(["resident", "non_resident"]);
export const BookingStatusSchema = z.enum(["pending", "confirmed", "cancelled", "completed"]);

export const RoomBookingSchema = z.object({
  room_id: RoomIdSchema,
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
});

export const ExtraBookingSchema = z.object({
  extra_service_id: ExtraServiceIdSchema,
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
});

export const BookingPayloadSchema = z.object({
  check_in: DateSchema,
  check_out: DateSchema,
  guest_first_name: z.string().min(1, "Guest first name is required"),
  guest_last_name: z.string().min(1, "Guest last name is required"),
  guest_email: z.string().email("Invalid email format"),
  guest_phone: z.string().optional(),
  guest_country: z.string().optional(),
  rooms: z.array(RoomBookingSchema).min(1, "At least one room is required"),
  extras: z.array(ExtraBookingSchema).optional(),
});
export type BookingPayload = z.infer<typeof BookingPayloadSchema>;

export const ListPropertiesOptionsSchema = z.object({});
export type ListPropertiesOptions = z.infer<typeof ListPropertiesOptionsSchema>;

export const ListRoomsOptionsSchema = z.object({
  property_id: PropertyIdSchema,
});
export type ListRoomsOptions = z.infer<typeof ListRoomsOptionsSchema>;

export const RoomAvailabilityOptionsSchema = z.object({
  property_id: PropertyIdSchema,
  room_id: RoomIdSchema,
  from: DateSchema,
  to: DateSchema,
});
export type RoomAvailabilityOptions = z.infer<typeof RoomAvailabilityOptionsSchema>;

export const RoomRatesOptionsSchema = z.object({
  property_id: PropertyIdSchema,
  room_id: RoomIdSchema,
  from: DateSchema,
  to: DateSchema,
  resident_type: ResidentTypeSchema.optional(),
});
export type RoomRatesOptions = z.infer<typeof RoomRatesOptionsSchema>;

export const UpdateRoomAvailabilityOptionsSchema = z.object({
  property_id: PropertyIdSchema,
  room_id: RoomIdSchema,
  from: DateSchema,
  to: DateSchema,
  availability: z.number().int().min(0).nullable(),
});
export type UpdateRoomAvailabilityOptions = z.infer<typeof UpdateRoomAvailabilityOptionsSchema>;

export const UpdateRoomRatesOptionsSchema = z.object({
  property_id: PropertyIdSchema,
  room_id: RoomIdSchema,
  from: DateSchema,
  to: DateSchema,
  rate: z.coerce.number().positive("Rate must be positive"),
  resident_type: ResidentTypeSchema,
});
export type UpdateRoomRatesOptions = z.infer<typeof UpdateRoomRatesOptionsSchema>;

export const ListExtraServicesOptionsSchema = z.object({
  property_id: PropertyIdSchema,
});
export type ListExtraServicesOptions = z.infer<typeof ListExtraServicesOptionsSchema>;

export const ExtraServiceAvailabilityOptionsSchema = z.object({
  property_id: PropertyIdSchema,
  extra_service_id: ExtraServiceIdSchema,
  from: DateSchema,
  to: DateSchema,
});
export type ExtraServiceAvailabilityOptions = z.infer<typeof ExtraServiceAvailabilityOptionsSchema>;

export const UpdateExtraServiceAvailabilityOptionsSchema = z.object({
  property_id: PropertyIdSchema,
  extra_service_id: ExtraServiceIdSchema,
  from: DateSchema,
  to: DateSchema,
  availability: z.number().int().min(0).nullable(),
});
export type UpdateExtraServiceAvailabilityOptions = z.infer<typeof UpdateExtraServiceAvailabilityOptionsSchema>;

export const ListBookingsOptionsSchema = z.object({
  property_id: PropertyIdSchema,
  status: BookingStatusSchema.optional(),
  from_date: DateSchema.optional(),
  to_date: DateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListBookingsOptions = z.infer<typeof ListBookingsOptionsSchema>;

export const GetBookingOptionsSchema = z.object({
  property_id: PropertyIdSchema,
  booking_id: BookingIdSchema,
});
export type GetBookingOptions = z.infer<typeof GetBookingOptionsSchema>;

export const CreateBookingOptionsSchema = BookingPayloadSchema.extend({
  property_id: PropertyIdSchema,
});
export type CreateBookingOptions = z.infer<typeof CreateBookingOptionsSchema>;

export const UpdateBookingStatusOptionsSchema = z.object({
  property_id: PropertyIdSchema,
  booking_id: BookingIdSchema,
  status: BookingStatusSchema,
});
export type UpdateBookingStatusOptions = z.infer<typeof UpdateBookingStatusOptionsSchema>;

export const GetWebhookConfigOptionsSchema = z.object({
  property_id: PropertyIdSchema,
});
export type GetWebhookConfigOptions = z.infer<typeof GetWebhookConfigOptionsSchema>;

export const UpdateWebhookConfigOptionsSchema = z.object({
  property_id: PropertyIdSchema,
  url: z.string().url("Invalid webhook URL"),
  events: z.array(z.string().min(1, "Event is required")).min(1, "At least one event is required"),
  rooms: z.array(z.string().min(1)).optional(),
  extra_services: z.array(z.string().min(1)).optional(),
});
export type UpdateWebhookConfigOptions = z.infer<typeof UpdateWebhookConfigOptionsSchema>;
