import {
  Booking,
  ExtraService,
  ExtraServiceAvailability,
  Property,
  Room,
  RoomAvailability,
  RoomRate,
  WebhookConfig,
} from "../types.js";
import type { ZafariAPIClient } from "./api-client.js";
import type {
  CreateBookingOptions,
  ExtraServiceAvailabilityOptions,
  GetBookingOptions,
  GetWebhookConfigOptions,
  ListBookingsOptions,
  ListExtraServicesOptions,
  ListRoomsOptions,
  RoomAvailabilityOptions,
  RoomRatesOptions,
  UpdateBookingStatusOptions,
  UpdateExtraServiceAvailabilityOptions,
  UpdateRoomAvailabilityOptions,
  UpdateRoomRatesOptions,
  UpdateWebhookConfigOptions,
} from "../schemas/index.js";

export async function listProperties(client: ZafariAPIClient): Promise<Property[]> {
  return client.get<Property[]>("/properties");
}

export async function listRooms(
  client: ZafariAPIClient,
  options: ListRoomsOptions,
): Promise<Room[]> {
  return client.get<Room[]>(`/properties/${options.property_id}/rooms`);
}

export async function getRoomAvailability(
  client: ZafariAPIClient,
  options: RoomAvailabilityOptions,
): Promise<RoomAvailability[]> {
  return client.get<RoomAvailability[]>(
    `/properties/${options.property_id}/rooms/${options.room_id}/avl`,
    { from: options.from, to: options.to },
  );
}

export async function getRoomRates(
  client: ZafariAPIClient,
  options: RoomRatesOptions,
): Promise<RoomRate[]> {
  return client.get<RoomRate[]>(
    `/properties/${options.property_id}/rooms/${options.room_id}/rates`,
    {
      from: options.from,
      to: options.to,
      resident_type: options.resident_type,
    },
  );
}

export async function updateRoomAvailability(
  client: ZafariAPIClient,
  options: UpdateRoomAvailabilityOptions,
): Promise<{ updated: true }> {
  await client.put(`/properties/${options.property_id}/rooms/${options.room_id}/avl`, {
    from: options.from,
    to: options.to,
    availability: options.availability,
  });

  return { updated: true };
}

export async function updateRoomRates(
  client: ZafariAPIClient,
  options: UpdateRoomRatesOptions,
): Promise<{ updated: true }> {
  await client.put(`/properties/${options.property_id}/rooms/${options.room_id}/rates`, {
    from: options.from,
    to: options.to,
    rate: options.rate,
    resident_type: options.resident_type,
  });

  return { updated: true };
}

export async function listExtraServices(
  client: ZafariAPIClient,
  options: ListExtraServicesOptions,
): Promise<ExtraService[]> {
  return client.get<ExtraService[]>(`/properties/${options.property_id}/extras`);
}

export async function getExtraServiceAvailability(
  client: ZafariAPIClient,
  options: ExtraServiceAvailabilityOptions,
): Promise<ExtraServiceAvailability[]> {
  return client.get<ExtraServiceAvailability[]>(
    `/properties/${options.property_id}/extra-services/${options.extra_service_id}/avl`,
    { from: options.from, to: options.to },
  );
}

export async function updateExtraServiceAvailability(
  client: ZafariAPIClient,
  options: UpdateExtraServiceAvailabilityOptions,
): Promise<{ updated: true }> {
  await client.put(
    `/properties/${options.property_id}/extra-services/${options.extra_service_id}/avl`,
    {
      from: options.from,
      to: options.to,
      availability: options.availability,
    },
  );

  return { updated: true };
}

export async function listBookings(
  client: ZafariAPIClient,
  options: ListBookingsOptions,
): Promise<Booking[]> {
  return client.get<Booking[]>(`/properties/${options.property_id}/bookings`, {
    status: options.status,
    from_date: options.from_date,
    to_date: options.to_date,
    limit: options.limit,
    offset: options.offset,
  });
}

export async function getBooking(
  client: ZafariAPIClient,
  options: GetBookingOptions,
): Promise<Booking> {
  return client.get<Booking>(
    `/properties/${options.property_id}/bookings/${options.booking_id}`,
  );
}

export async function createBooking(
  client: ZafariAPIClient,
  options: CreateBookingOptions,
): Promise<Booking> {
  return client.post<Booking>(`/properties/${options.property_id}/bookings`, {
    check_in: options.check_in,
    check_out: options.check_out,
    guest_details: {
      first_name: options.guest_first_name,
      last_name: options.guest_last_name,
      email: options.guest_email,
      phone: options.guest_phone,
      country: options.guest_country,
    },
    rooms: options.rooms,
    extras: options.extras,
  });
}

export async function updateBookingStatus(
  client: ZafariAPIClient,
  options: UpdateBookingStatusOptions,
): Promise<{ updated: true }> {
  await client.put(
    `/properties/${options.property_id}/bookings/${options.booking_id}/status`,
    { status: options.status },
  );

  return { updated: true };
}

export async function getWebhookConfig(
  client: ZafariAPIClient,
  options: GetWebhookConfigOptions,
): Promise<WebhookConfig> {
  return client.get<WebhookConfig>(`/properties/${options.property_id}/kvs/webhook`);
}

export async function updateWebhookConfig(
  client: ZafariAPIClient,
  options: UpdateWebhookConfigOptions,
): Promise<{ updated: true }> {
  await client.put(`/properties/${options.property_id}/kvs/webhook`, {
    url: options.url,
    events: options.events,
    rooms: options.rooms,
    extra_services: options.extra_services,
  });

  return { updated: true };
}
