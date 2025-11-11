# Zafari MCP Server with OAuth 2.1

A Model Context Protocol (MCP) server for the Zafari CRS API with OAuth 2.1 authentication, enabling secure remote access from Claude Desktop and other MCP clients for managing safari property operations.

## 🌟 Features

- **🔐 OAuth 2.1 Authentication**: Secure token-based authentication for Claude Desktop
- **🏨 Property Management**: List and view safari properties
- **🛏️ Room Operations**: Availability, rates, and inventory management
- **✨ Extra Services**: Park fees, activities, and add-on management
- **📅 Booking Management**: Create, list, update, and track bookings
- **🔔 Webhook Configuration**: Event notification setup

## 🚀 Quick Start for Claude Desktop

### Prerequisites

- Node.js 18+
- Zafari CRS API key
- Claude Desktop (Pro, Max, Team, or Enterprise plan)

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set ZAFARI_API_KEY

# Build the project
npm run build

# Start server with OAuth
TRANSPORT=http npm start
```

### Add to Claude Desktop

1. Open Claude Desktop → **Settings > Connectors**
2. Click **"Add custom connector"**
3. Enter URL: `http://localhost:3000/mcp`
4. Click **"Add"**
5. Browser opens → Login with `demo` / `demo123`
6. Click **"Authorize"**
7. Done! ✨

**📖 Detailed Setup Guide**: See [CLAUDE_DESKTOP_SETUP.md](CLAUDE_DESKTOP_SETUP.md)

## 📋 Available Tools

### Properties
- `zafari_list_properties` - Fetch all safari properties/lodges

### Rooms
- `zafari_list_rooms` - Get room types for a property
- `zafari_get_room_availability` - Check daily availability
- `zafari_get_room_rates` - Retrieve pricing
- `zafari_update_room_availability` - Set availability levels
- `zafari_update_room_rates` - Update pricing

### Bookings
- `zafari_list_bookings` - List bookings with filters
- `zafari_get_booking` - Get booking details
- `zafari_create_booking` - Create new booking
- `zafari_update_booking_status` - Update status

### Extra Services
- `zafari_list_extra_services` - List add-ons (park fees, activities)
- `zafari_get_extra_service_availability` - Check availability
- `zafari_update_extra_service_availability` - Update capacity

### Webhooks
- `zafari_get_webhook_config` - Get webhook settings
- `zafari_update_webhook_config` - Configure notifications

## ⚙️ Configuration

### Environment Variables

```env
# Required
ZAFARI_API_KEY=your-api-key

# Server Configuration
TRANSPORT=http           # Use 'http' for OAuth, 'stdio' for legacy
HOST=localhost
PORT=3000

# OAuth Security
JWT_SECRET=<random-secret>   # Generate: openssl rand -base64 32
OAUTH_ISSUER=zafari-mcp-server
OAUTH_AUDIENCE=zafari-mcp-api

# Development Credentials
ADMIN_PASSWORD=change-me
DEMO_PASSWORD=demo123
```

### Transport Modes

**HTTP Mode (Recommended for Claude Desktop)**:
```bash
TRANSPORT=http npm start
```
- OAuth 2.1 authentication
- Remote access support
- Compatible with Claude Desktop 2025+

**Stdio Mode (Legacy)**:
```bash
TRANSPORT=stdio npm start
```
- Local CLI usage
- No authentication
- For testing with MCP Inspector

## 🔒 OAuth 2.1 Authentication

### Authentication Flow

1. **Client requests access** → `/oauth/authorize`
2. **User authenticates** → Browser login page
3. **Server issues code** → Authorization code with PKCE
4. **Client exchanges code** → Access token (JWT)
5. **Client uses token** → Bearer token for MCP calls

### OAuth Endpoints

- **Authorization**: `http://localhost:3000/oauth/authorize`
- **Token Exchange**: `http://localhost:3000/oauth/token`
- **Server Metadata**: `http://localhost:3000/.well-known/oauth-authorization-server`
- **Protected MCP**: `http://localhost:3000/mcp`

### Security Features

✅ **JWT Tokens**: 1-hour access tokens with signature verification
✅ **Refresh Tokens**: 30-day refresh tokens for long-term access
✅ **PKCE Support**: Proof Key for Code Exchange for public clients
✅ **Scope Management**: Fine-grained permission control
✅ **Redirect Validation**: HTTPS enforcement for production

## 📚 Documentation

### User Guides
- **[CLAUDE_DESKTOP_SETUP.md](CLAUDE_DESKTOP_SETUP.md)** - Complete Claude Desktop setup guide
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick command reference

### Technical Documentation
- **[OAUTH_SETUP.md](OAUTH_SETUP.md)** - OAuth 2.1 implementation details
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Deployment and testing guide

### Tutorials
- **[TUTORIAL_BUILD_MCP_WITH_OAUTH.md](TUTORIAL_BUILD_MCP_WITH_OAUTH.md)** - Build your own OAuth MCP server

## 🏗️ Project Structure

```
zafari-mcp-server/
├── src/
│   ├── index.ts              # Main server with OAuth
│   ├── types.ts              # TypeScript definitions
│   ├── constants.ts          # Configuration
│   ├── schemas/
│   │   └── index.ts          # Zod validation schemas
│   ├── services/
│   │   ├── api-client.ts     # Zafari API client
│   │   ├── formatters.ts     # Response formatting
│   │   └── oauth.ts          # OAuth utilities
│   ├── routes/
│   │   └── oauth.ts          # OAuth endpoints
│   ├── middleware/
│   │   └── auth.ts           # Authentication middleware
│   └── tools/
│       ├── properties.ts     # Property tools
│       ├── rooms.ts          # Room tools
│       ├── extras.ts         # Extra service tools
│       ├── bookings.ts       # Booking tools
│       └── webhooks.ts       # Webhook tools
├── dist/                     # Compiled output
├── .env.example              # Environment template
└── README.md                 # This file
```

## 🛠️ Development

### Scripts

```bash
npm run build    # Compile TypeScript
npm start        # Run server
npm run dev      # Watch mode
```

### Testing

**With MCP Inspector**:
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

**Manual OAuth Testing**:
```bash
# 1. Health check
curl http://localhost:3000/health

# 2. OAuth metadata
curl http://localhost:3000/.well-known/oauth-authorization-server

# 3. Get authorization (browser)
open http://localhost:3000/oauth/authorize?response_type=code&client_id=test&redirect_uri=http://localhost:3000/callback

# 4. Exchange code for token
curl -X POST http://localhost:3000/oauth/token \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_CODE" \
  -d "client_id=test"

# 5. Use token
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 🚢 Production Deployment

### Deployment Options

**Docker**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
ENV TRANSPORT=http PORT=3000
CMD ["node", "dist/index.js"]
```

**Cloud Platforms**:
- Railway, Render, Fly.io
- AWS ECS, Google Cloud Run, Azure Container Apps
- Set environment variables in platform dashboard

**HTTPS Setup** (Required for production):
```bash
# Use reverse proxy (nginx, Apache, Caddy)
# Or cloud platform with built-in SSL
# Or CDN (Cloudflare, CloudFront)
```

### Production Checklist

- [ ] Set strong `JWT_SECRET` (64+ characters)
- [ ] Use HTTPS (required, not localhost)
- [ ] Update `ADMIN_PASSWORD` and `DEMO_PASSWORD`
- [ ] Set proper `OAUTH_ISSUER` and `OAUTH_AUDIENCE`
- [ ] Implement real user authentication (not hardcoded)
- [ ] Use database for token storage (not in-memory)
- [ ] Add rate limiting
- [ ] Enable monitoring and logging
- [ ] Configure CORS properly
- [ ] Add security headers

## 🔍 API Examples

### List Properties

**Request**:
```json
{
  "tool": "zafari_list_properties",
  "params": {
    "response_format": "json"
  }
}
```

### Create Booking

**Request**:
```json
{
  "tool": "zafari_create_booking",
  "params": {
    "property_id": "prop_123",
    "check_in": "2025-02-01",
    "check_out": "2025-02-05",
    "guest_first_name": "John",
    "guest_last_name": "Doe",
    "guest_email": "john@example.com",
    "rooms": [{"room_id": "room_456", "quantity": 1}]
  }
}
```

### Update Room Rates

**Request**:
```json
{
  "tool": "zafari_update_room_rates",
  "params": {
    "property_id": "prop_123",
    "room_id": "room_456",
    "from": "2025-03-01",
    "to": "2025-03-31",
    "rate": 500,
    "resident_type": "non_resident"
  }
}
```

## 🐛 Troubleshooting

### Server Won't Start

```bash
# Check API key is set
echo $ZAFARI_API_KEY

# Verify build completed
npm run build

# Check port availability
lsof -i :3000
```

### OAuth Authentication Fails

- Verify credentials: `demo` / `demo123`
- Check JWT_SECRET is set
- Review server logs for errors
- Clear browser cookies

### Claude Desktop Can't Connect

```bash
# 1. Verify server is running
curl http://localhost:3000/health

# 2. Test OAuth metadata
curl http://localhost:3000/.well-known/oauth-authorization-server

# 3. Check URL in connector settings (no typos)
# 4. Restart Claude Desktop
# 5. Try removing and re-adding connector
```

### Tools Not Working

- Check ZAFARI_API_KEY is valid
- Verify API key has correct permissions
- Review server logs for API errors
- Test API directly with curl

## 🔗 Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)
- [Zafari CRS API](https://api.be.zafari.africa/docs)
- [Claude Desktop](https://claude.ai/download)

## 📄 License

Apache-2.0

## 🤝 Support

For issues or questions:
- **Zafari API**: Contact Zafari support team
- **MCP Integration**: Review documentation in this repository
- **OAuth Issues**: See [OAUTH_SETUP.md](OAUTH_SETUP.md)

---

**Version**: 2.0.0 (OAuth-enabled)
**Built with**: MCP SDK v1.0.4, OAuth 2.1, Express, JWT (jose)
**API**: Zafari CRS v2

🦁 Built for safari property management excellence
