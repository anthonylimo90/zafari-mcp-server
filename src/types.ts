// Core types from Zafari CRS API

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

export interface Email {
  email: string;
  is_verified: boolean;
  datetime_created: string;
  datetime_updated: string;
}

export interface Tel {
  calling_code: number;
  nsn: string;
  is_verified: boolean;
  datetime_created: string;
  datetime_updated: string;
}

export interface Property {
  id: string;
  business_entity_id: string;
  name: string;
  country_code: string;
  property_type_id: string;
  is_active: boolean;
  is_verified: boolean;
  is_deleted: boolean;
  logo_url?: string;
  address?: Address;
  email?: Email;
  tel?: Tel;
  datetime_created: string;
  datetime_updated: string;
}

export interface Room {
  id: string;
  property_id: string;
  name: string;
  category: string;
  short_description?: string;
  long_description?: string;
  base_adults: number;
  base_children: number;
  max_adults: number;
  max_children: number;
  max_capacity: number;
  units_count: number;
  is_active: boolean;
}

export interface RoomAvailability {
  date: string;
  availability: number | null;
}

export interface RoomRate {
  date: string;
  rate: number;
}

export interface ExtraService {
  id: string;
  property_id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  pricing_type: "per_person" | "per_booking" | "per_night" | "per_person_per_night";
  resident_type: "resident" | "non_resident" | "universal";
  category?: string;
  is_active: boolean;
  datetime_created: string;
  datetime_updated: string;
}

export interface ExtraServiceAvailability {
  date: string;
  availability: number | null;
}

export interface Booking {
  id: string;
  property_id: string;
  reference: string;
  status: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_amount: number;
  currency: string;
  guest_details: GuestDetails;
  rooms: BookingRoom[];
  extras: BookingExtra[];
  datetime_created: string;
  datetime_updated: string;
}

export interface GuestDetails {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  country?: string;
}

export interface BookingRoom {
  room_id: string;
  room_name: string;
  quantity: number;
  rate: number;
  nights: number;
}

export interface BookingExtra {
  extra_service_id: string;
  title: string;
  quantity: number;
  price: number;
}

export interface WebhookConfig {
  url: string;
  events: string[];
  rooms?: string[];
  extra_services?: string[];
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}
