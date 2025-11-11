# Zafari MCP Server

A Model Context Protocol (MCP) server for the Zafari CRS API, enabling AI assistants to manage safari property operations including bookings, room inventory, rates, extra services, and webhooks.

## Features

- **Property Management**: List and view safari properties
- **Room Operations**: 
  - List room types
  - Check availability
  - Manage rates (resident/non-resident)
  - Update inventory levels
- **Extra Services**: 
  - List add-ons (park fees, activities, etc.)
  - Check availability
  - Update capacity
- **Booking Management**:
  - List and filter bookings
  - Create new bookings
  - Update booking status
  - Retrieve booking details
- **Webhook Configuration**: Set up event notifications

## Installation

### Prerequisites

- Node.js 18+ with npm
- Zafari CRS API key
- TypeScript 5.6+

### Setup

1. **Clone or create project directory**:
```bash
mkdir zafari-mcp-server
cd zafari-mcp-server
```

2. **Install dependencies**:
```bash
npm install
```

3. **Build the project**:
```bash
npm run build
```

4. **Set up environment**:
```bash
export ZAFARI_API_KEY="your-api-key-here"
```

## Usage

### Stdio Transport (Local/CLI)

For integration with local MCP clients:

```bash
ZAFARI_API_KEY=your-api-key node dist/index.js
```

### HTTP Transport (Remote)

For remote access or web integrations:

```bash
ZAFARI_API_KEY=your-api-key TRANSPORT=http PORT=3000 node dist/index.js
```

The server will be available at `http://localhost:3000/mcp`

## Available Tools

### Property Tools

#### `zafari_list_properties`
Fetch all properties in the system.

**Parameters:**
- `response_format`: 'markdown' | 'json' (default: 'markdown')

**Example:**
```json
{
  "response_format": "json"
}
```

---

### Room Tools

#### `zafari_list_rooms`
List all room types for a property.

**Parameters:**
- `property_id`: string (required)
- `response_format`: 'markdown' | 'json'

#### `zafari_get_room_availability`
Check daily availability for a room type.

**Parameters:**
- `property_id`: string (required)
- `room_id`: string (required)
- `from`: string YYYY-MM-DD (required)
- `to`: string YYYY-MM-DD (required)
- `response_format`: 'markdown' | 'json'

**Example:**
```json
{
  "property_id": "prop_abc123",
  "room_id": "room_xyz789",
  "from": "2025-01-01",
  "to": "2025-01-31",
  "response_format": "json"
}
```

#### `zafari_get_room_rates`
Retrieve daily rates for a room type.

**Parameters:**
- `property_id`: string (required)
- `room_id`: string (required)
- `from`: string YYYY-MM-DD (required)
- `to`: string YYYY-MM-DD (required)
- `resident_type`: 'resident' | 'non_resident' (optional)
- `response_format`: 'markdown' | 'json'

#### `zafari_update_room_availability`
Update availability for a room across a date range.

**Parameters:**
- `property_id`: string (required)
- `room_id`: string (required)
- `from`: string YYYY-MM-DD (required)
- `to`: string YYYY-MM-DD (required)
- `availability`: number | null (required, null = unlimited)

**Example:**
```json
{
  "property_id": "prop_abc123",
  "room_id": "room_xyz789",
  "from": "2025-01-01",
  "to": "2025-01-31",
  "availability": 5
}
```

#### `zafari_update_room_rates`
Update rates for a room type.

**Parameters:**
- `property_id`: string (required)
- `room_id`: string (required)
- `from`: string YYYY-MM-DD (required)
- `to`: string YYYY-MM-DD (required)
- `rate`: number (required, must be positive)
- `resident_type`: 'resident' | 'non_resident' (required)

---

### Extra Service Tools

#### `zafari_list_extra_services`
List all extra services/add-ons for a property.

**Parameters:**
- `property_id`: string (required)
- `response_format`: 'markdown' | 'json'

#### `zafari_get_extra_service_availability`
Check availability for an extra service.

**Parameters:**
- `property_id`: string (required)
- `extra_service_id`: string UUID (required)
- `from`: string YYYY-MM-DD (required)
- `to`: string YYYY-MM-DD (required)
- `response_format`: 'markdown' | 'json'

#### `zafari_update_extra_service_availability`
Update capacity for an extra service.

**Parameters:**
- `property_id`: string (required)
- `extra_service_id`: string UUID (required)
- `from`: string YYYY-MM-DD (required)
- `to`: string YYYY-MM-DD (required)
- `availability`: number | null (required, null = unlimited)

---

### Booking Tools

#### `zafari_list_bookings`
List bookings with optional filters.

**Parameters:**
- `property_id`: string (required)
- `status`: 'pending' | 'confirmed' | 'cancelled' | 'completed' (optional)
- `from_date`: string YYYY-MM-DD (optional)
- `to_date`: string YYYY-MM-DD (optional)
- `limit`: number 1-100 (default: 50)
- `offset`: number (default: 0)
- `response_format`: 'markdown' | 'json'

**Example:**
```json
{
  "property_id": "prop_abc123",
  "status": "confirmed",
  "from_date": "2025-01-01",
  "limit": 20,
  "response_format": "json"
}
```

#### `zafari_get_booking`
Get details for a specific booking.

**Parameters:**
- `property_id`: string (required)
- `booking_id`: string (required)
- `response_format`: 'markdown' | 'json'

#### `zafari_create_booking`
Create a new booking.

**Parameters:**
- `property_id`: string (required)
- `check_in`: string YYYY-MM-DD (required)
- `check_out`: string YYYY-MM-DD (required)
- `guest_first_name`: string (required)
- `guest_last_name`: string (required)
- `guest_email`: string email (required)
- `guest_phone`: string (optional)
- `guest_country`: string (optional)
- `rooms`: array of `{room_id: string, quantity: number}` (required, min: 1)
- `extras`: array of `{extra_service_id: string, quantity: number}` (optional)

**Example:**
```json
{
  "property_id": "prop_abc123",
  "check_in": "2025-02-01",
  "check_out": "2025-02-05",
  "guest_first_name": "John",
  "guest_last_name": "Doe",
  "guest_email": "john.doe@example.com",
  "guest_phone": "+1234567890",
  "rooms": [
    {"room_id": "room_xyz789", "quantity": 2}
  ],
  "extras": [
    {"extra_service_id": "extra_abc123", "quantity": 4}
  ]
}
```

#### `zafari_update_booking_status`
Update booking status.

**Parameters:**
- `property_id`: string (required)
- `booking_id`: string (required)
- `status`: 'pending' | 'confirmed' | 'cancelled' | 'completed' (required)

---

### Webhook Tools

#### `zafari_get_webhook_config`
Retrieve webhook configuration.

**Parameters:**
- `property_id`: string (required)

#### `zafari_update_webhook_config`
Configure webhook settings.

**Parameters:**
- `property_id`: string (required)
- `url`: string URL (required, must be valid HTTPS)
- `events`: array of strings (required, min: 1)
- `rooms`: array of strings (optional)
- `extra_services`: array of strings (optional)

**Example:**
```json
{
  "property_id": "prop_abc123",
  "url": "https://example.com/webhooks/zafari",
  "events": ["booking.created", "booking.updated", "availability.updated"],
  "rooms": ["room_xyz789"]
}
```

## Configuration

### Environment Variables

- `ZAFARI_API_KEY` (required): Your Zafari CRS API key
- `TRANSPORT` (optional): Transport type - 'stdio' (default) or 'http'
- `PORT` (optional): HTTP server port (default: 3000, only for http transport)

### API Configuration

The server connects to:
- **Base URL**: `https://api.be.zafari.africa/v2`
- **Auth Header**: `x-api-key`

## Development

### Project Structure

```
zafari-mcp-server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── types.ts              # TypeScript type definitions
│   ├── constants.ts          # Configuration constants
│   ├── schemas/
│   │   └── index.ts          # Zod validation schemas
│   ├── services/
│   │   ├── api-client.ts     # API client with error handling
│   │   └── formatters.ts     # Response formatting utilities
│   └── tools/
│       ├── properties.ts     # Property management tools
│       ├── rooms.ts          # Room operation tools
│       ├── extras.ts         # Extra service tools
│       ├── bookings.ts       # Booking management tools
│       └── webhooks.ts       # Webhook configuration tools
├── dist/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Run the compiled server
- `npm run dev`: Watch mode for development

### Building

```bash
npm run build
```

Outputs to `dist/` directory with source maps.

### Testing

Use MCP Inspector for testing:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Error Handling

All tools include comprehensive error handling:

- **400 Bad Request**: Invalid parameters or malformed data
- **401 Unauthorized**: Invalid or missing API key
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **429 Rate Limit**: Too many requests
- **500 Server Error**: Internal server issues

Errors are returned with clear, actionable messages.

## Security

- API key authentication required
- HTTPS recommended for webhook endpoints
- Input validation using Zod schemas
- No sensitive data in logs
- Rate limit handling

## Support

For API issues or questions:
- API Documentation: Contact Zafari team
- MCP Server Issues: Check GitHub repository

## License

Apache-2.0

## Version

1.0.0

---

Built with the [Model Context Protocol](https://modelcontextprotocol.io/) SDK.
