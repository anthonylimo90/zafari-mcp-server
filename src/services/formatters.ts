import { Property, Room, ExtraService, Booking, RoomAvailability, RoomRate } from "../types.js";
import { CHARACTER_LIMIT } from "../constants.js";

/**
 * Format property data as markdown
 */
export function formatPropertyMarkdown(property: Property): string {
  return `## ${property.name}
**ID:** ${property.id}
**Status:** ${property.is_active ? "Active" : "Inactive"}${property.is_verified ? " (Verified)" : ""}
**Country:** ${property.country_code}
**Business Entity:** ${property.business_entity_id}
${property.address ? `**Address:** ${formatAddress(property.address)}` : ""}
${property.email ? `**Email:** ${property.email.email}` : ""}
${property.tel ? `**Phone:** +${property.tel.calling_code} ${property.tel.nsn}` : ""}`;
}

/**
 * Format room data as markdown
 */
export function formatRoomMarkdown(room: Room): string {
  return `### ${room.name}
**ID:** ${room.id}
**Category:** ${room.category}
**Status:** ${room.is_active ? "Active" : "Inactive"}
**Capacity:** ${room.base_adults} adults, ${room.base_children} children (max: ${room.max_capacity} total)
**Units Available:** ${room.units_count}
${room.short_description ? `**Description:** ${room.short_description}` : ""}`;
}

/**
 * Format extra service data as markdown
 */
export function formatExtraServiceMarkdown(extra: ExtraService): string {
  return `### ${extra.title}
**ID:** ${extra.id}
**Price:** ${extra.currency} ${extra.price}
**Pricing Type:** ${extra.pricing_type}
**Resident Type:** ${extra.resident_type}
**Status:** ${extra.is_active ? "Active" : "Inactive"}
${extra.category ? `**Category:** ${extra.category}` : ""}
${extra.description ? `**Description:** ${extra.description}` : ""}`;
}

/**
 * Format booking data as markdown
 */
export function formatBookingMarkdown(booking: Booking): string {
  const roomsText = booking.rooms.map(r => 
    `  - ${r.room_name} x${r.quantity} @ ${booking.currency} ${r.rate}/night (${r.nights} nights)`
  ).join("\n");
  
  const extrasText = booking.extras?.length 
    ? "\n**Extras:**\n" + booking.extras.map(e => 
        `  - ${e.title} x${e.quantity} @ ${booking.currency} ${e.price}`
      ).join("\n")
    : "";

  return `## Booking ${booking.reference}
**ID:** ${booking.id}
**Status:** ${booking.status}
**Check-in:** ${booking.check_in}
**Check-out:** ${booking.check_out}
**Guests:** ${booking.guests}
**Total Amount:** ${booking.currency} ${booking.total_amount}

**Guest:**
${booking.guest_details.first_name} ${booking.guest_details.last_name}
${booking.guest_details.email}${booking.guest_details.phone ? `\n${booking.guest_details.phone}` : ""}

**Rooms:**
${roomsText}${extrasText}`;
}

/**
 * Format availability data as markdown table
 */
export function formatAvailabilityMarkdown(availability: RoomAvailability[]): string {
  if (availability.length === 0) {
    return "No availability data found.";
  }

  const header = "| Date | Available Units |\n|------|----------------|";
  const rows = availability.map(a => 
    `| ${a.date} | ${a.availability === null ? "Unlimited" : a.availability} |`
  ).join("\n");

  return `${header}\n${rows}`;
}

/**
 * Format rate data as markdown table
 */
export function formatRatesMarkdown(rates: RoomRate[]): string {
  if (rates.length === 0) {
    return "No rate data found.";
  }

  const header = "| Date | Rate |\n|------|------|";
  const rows = rates.map(r => 
    `| ${r.date} | ${r.rate} |`
  ).join("\n");

  return `${header}\n${rows}`;
}

/**
 * Format address object as string
 */
function formatAddress(address: Property["address"]): string {
  if (!address) return "";
  const parts = [address.street, address.city, address.state, address.country, address.postal_code]
    .filter(Boolean);
  return parts.join(", ");
}

/**
 * Truncate text if it exceeds the character limit
 */
export function truncateIfNeeded(text: string, limit: number = CHARACTER_LIMIT): string {
  if (text.length <= limit) {
    return text;
  }

  const truncated = text.substring(0, limit - 100);
  return `${truncated}\n\n... (Response truncated. ${text.length - truncated.length} characters omitted. Use filtering or pagination to get specific results.)`;
}

/**
 * Format array of items with markdown
 */
export function formatList<T>(
  items: T[],
  formatter: (item: T) => string,
  emptyMessage: string = "No items found."
): string {
  if (items.length === 0) {
    return emptyMessage;
  }

  return items.map(formatter).join("\n\n---\n\n");
}
