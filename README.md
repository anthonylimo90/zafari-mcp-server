# Zafari MCP Server with OAuth 2.1

A **production-ready**, security-hardened Model Context Protocol (MCP) server for the Zafari CRS API with OAuth 2.1 authentication, enabling secure remote access from Claude Desktop and other MCP clients for managing safari property operations.

## 🔒 Security Features

✅ **Password Hashing** - bcrypt with 10 salt rounds  
✅ **Token Storage** - Redis OR in-memory (configurable)  
✅ **Rate Limiting** - Auth: 5/15min, API: 100/req/min  
✅ **CORS Protection** - Configurable allowed origins  
✅ **Security Headers** - Helmet (CSP, HSTS, X-Frame-Options)  
✅ **Structured Logging** - Winston with security event tracking  
✅ **Client Validation** - OAuth client ID whitelist  
✅ **JWT Enforcement** - 32+ character secret required  
✅ **Replay Protection** - Authorization code tracking  

**Status**: ✅ Production-ready with proper configuration (0 npm vulnerabilities)

---

## 🌟 Features

- **🔐 OAuth 2.1 Authentication**: Secure token-based authentication with PKCE support
- **🏨 Property Management**: List and view safari properties
- **🛏️ Room Operations**: Availability, rates, and inventory management
- **✨ Extra Services**: Park fees, activities, and add-on management
- **📅 Booking Management**: Create, list, update, and track bookings
- **🔔 Webhook Configuration**: Event notification setup

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Zafari CRS API key
- Claude Desktop (Pro, Max, Team, or Enterprise plan)
- **(Production)** Redis server (optional, recommended)

### Installation

```bash
# Clone and install
npm install

# Generate JWT secret
openssl rand -base64 64

# Configure environment
cp .env.example .env
```

**Edit `.env` and set required values:**

```env
# Required
ZAFARI_API_KEY=your-zafari-api-key
JWT_SECRET=<paste-generated-secret-here>  # Must be 32+ characters
ADMIN_PASSWORD=MySecurePassword123!        # Minimum 12 characters
DEMO_PASSWORD=AnotherSecurePass456!        # Minimum 12 characters

# Server Configuration
TRANSPORT=http
PORT=3000

# Optional: Token Storage (use redis for production)
STORAGE_BACKEND=memory  # or 'redis'
# REDIS_URL=redis://localhost:6379

# Optional: Security
ALLOWED_ORIGINS=https://claude.ai
ALLOWED_CLIENT_IDS=claude-desktop,mcp-inspector
```

**Build and start:**

```bash
npm run build
npm start
```

### Add to Claude Desktop

1. Open Claude Desktop → **Settings > Connectors**
2. Click **"Add custom connector"**
3. Enter URL: `http://localhost:3000/mcp`
4. Click **"Add"**
5. Browser opens → Login with your credentials
6. Click **"Authorize"**
7. Done! ✨

**📖 Detailed Setup Guide**: See [CLAUDE_DESKTOP_SETUP.md](CLAUDE_DESKTOP_SETUP.md)

## ⚙️ Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ZAFARI_API_KEY` | Your Zafari CRS API key | `za_live_...` |
| `JWT_SECRET` | JWT signing secret (32+ chars) | Generate: `openssl rand -base64 64` |
| `ADMIN_PASSWORD` | Admin user password (12+ chars) | `MySecurePass123!` |
| `DEMO_PASSWORD` | Demo user password (12+ chars) | `AnotherPass456!` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPORT` | `stdio` | Use `http` for OAuth, `stdio` for legacy |
| `HOST` | `localhost` | Server host |
| `PORT` | `3000` | Server port |
| `STORAGE_BACKEND` | `memory` | Token storage: `memory` or `redis` |
| `REDIS_URL` | - | Redis connection string (required if using Redis) |
| `ALLOWED_ORIGINS` | `https://claude.ai` | CORS allowed origins (comma-separated) |
| `ALLOWED_CLIENT_IDS` | `claude-desktop,mcp-inspector` | Whitelisted OAuth clients |
| `LOG_LEVEL` | `info` | Logging level (error/warn/info/debug) |
| `NODE_ENV` | `development` | Environment (production/development) |
| `OAUTH_ISSUER` | `zafari-mcp-server` | JWT issuer claim |
| `OAUTH_AUDIENCE` | `zafari-mcp-api` | JWT audience claim |

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

## 🔒 Security Implementation

### Password Security

- **Hashing**: bcrypt with 10 salt rounds
- **Minimum Length**: 12 characters enforced
- **Complexity**: Uppercase, lowercase, numbers, and symbols recommended
- **No Defaults**: Server won't start without strong passwords
- **Constant-Time Comparison**: Prevents timing attacks

### Token Management

- **Storage Options**:
  - **Memory** (development): Simple, fast, tokens lost on restart
  - **Redis** (production): Persistent, scalable, survives restarts
- **Access Tokens**: JWT, 1-hour expiration, HS256 algorithm
- **Refresh Tokens**: 30-day expiration with rotation
- **Auto-Cleanup**: Expired tokens automatically purged

### Rate Limiting

- **Auth Endpoints** (`/oauth/authorize`, `/oauth/token`): 5 attempts per 15 minutes
- **MCP Endpoints** (`/mcp`): 100 requests per minute
- **Response**: 429 Too Many Requests with retry headers
- **Logging**: All violations logged for monitoring

### CORS Protection

- **Configurable Origins**: Set via `ALLOWED_ORIGINS` environment variable
- **Secure Default**: `https://claude.ai` (no wildcards)
- **Credentials Support**: Enabled for cookie-based auth
- **Multiple Origins**: Comma-separated list supported

### Security Headers

Implemented via Helmet.js:
- **Content-Security-Policy**: Prevents XSS attacks
- **HSTS**: Enforces HTTPS (1-year max-age)
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-Frame-Options**: Prevents clickjacking
- **X-XSS-Protection**: Browser XSS filter

### Logging & Monitoring

Structured logging with Winston:
- **Security Events**: Auth attempts, token failures, rate limits
- **Request Logging**: Method, path, IP, user agent
- **Production Files**: `error.log`, `combined.log` (5MB rotation)
- **No Sensitive Data**: Passwords and tokens never logged

### OAuth Security

- **Client Validation**: Whitelist-based client ID checking
- **Replay Protection**: Authorization codes tracked and invalidated
- **JWT Secret**: 32+ character requirement enforced
- **PKCE Support**: Proof Key for Code Exchange (S256)
- **Redirect Validation**: HTTPS required (localhost exempted for dev)

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

## 🔐 OAuth 2.1 Authentication

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
│   ├── index.ts              # Main server with OAuth & middleware
│   ├── types.ts              # TypeScript definitions
│   ├── constants.ts          # Configuration
│   ├── schemas/
│   │   └── index.ts          # Zod validation schemas
│   ├── services/
│   │   ├── api-client.ts     # Zafari API client
│   │   ├── formatters.ts     # Response formatting
│   │   ├── oauth.ts          # OAuth utilities (bcrypt, JWT)
│   │   ├── logger.ts         # Winston logging (NEW)
│   │   └── storage.ts        # Token storage abstraction (NEW)
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
├── test-security.sh          # Security verification script (NEW)
└── README.md                 # This file
```

## 🛠️ Development

### Scripts

```bash
npm run build    # Compile TypeScript
npm start        # Run server
npm run dev      # Watch mode
```

### Security Testing

**Run security verification:**
```bash
./test-security.sh
```

Tests include:
- Password hashing functionality
- Dependency installation
- TypeScript compilation
- NPM vulnerability audit

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Manual OAuth Testing

```bash
# 1. Health check
curl http://localhost:3000/health

# 2. OAuth metadata
curl http://localhost:3000/.well-known/oauth-authorization-server

# 3. Get authorization (browser)
open "http://localhost:3000/oauth/authorize?response_type=code&client_id=claude-desktop&redirect_uri=http://localhost:3000/callback"

# 4. Exchange code for token
curl -X POST http://localhost:3000/oauth/token \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_CODE" \
  -d "client_id=claude-desktop"

# 5. Use token
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Rate Limiting Test

```bash
# Make 6 rapid requests (6th should be rate limited)
for i in {1..6}; do 
  curl -I http://localhost:3000/oauth/authorize
done
# Expected: 6th returns 429 Too Many Requests
```

### CORS & Security Headers Test

```bash
# Test CORS
curl -H "Origin: https://claude.ai" -I http://localhost:3000/health

# Test security headers
curl -I http://localhost:3000/health
# Should include: X-Content-Type-Options, Strict-Transport-Security, X-Frame-Options
```

## 🚢 Production Deployment

### Prerequisites

✅ **Security Checklist Completed**:
- [x] Password hashing with bcrypt
- [x] Rate limiting implemented
- [x] Security headers configured
- [x] CORS protection enabled
- [x] Structured logging active
- [x] Client ID validation
- [x] JWT secret enforcement
- [ ] Redis configured for token storage
- [ ] HTTPS enabled
- [ ] Strong passwords set (16+ characters)
- [ ] Environment variables configured
- [ ] Monitoring and alerts set up

### Deployment Options

**Docker**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
ENV NODE_ENV=production TRANSPORT=http PORT=3000
CMD ["node", "dist/index.js"]
```

**Cloud Platforms**:
- Railway, Render, Fly.io
- AWS ECS, Google Cloud Run, Azure Container Apps
- Set environment variables in platform dashboard

### Production Environment Variables

```env
# Required
NODE_ENV=production
ZAFARI_API_KEY=your-production-api-key
JWT_SECRET=<64-char-secret>
ADMIN_PASSWORD=<strong-16-char-password>
DEMO_PASSWORD=<strong-16-char-password>

# Redis (Recommended)
STORAGE_BACKEND=redis
REDIS_URL=redis://your-redis-server:6379

# Security
ALLOWED_ORIGINS=https://your-domain.com
ALLOWED_CLIENT_IDS=claude-desktop,your-custom-client
TRANSPORT=http
PORT=3000
```

### HTTPS Setup (Required)

**Option 1: Reverse Proxy**
```bash
# nginx, Apache, or Caddy
# Configure SSL/TLS certificates
```

**Option 2: Cloud Platform**
- Most platforms provide automatic HTTPS
- Configure custom domain with SSL

**Option 3: CDN**
- Cloudflare, CloudFront
- Enable SSL/TLS termination

### Post-Deployment Checklist

- [ ] Test OAuth flow end-to-end
- [ ] Verify rate limiting is working
- [ ] Check security headers with securityheaders.com
- [ ] Review logs for security events
- [ ] Set up monitoring alerts
- [ ] Test token persistence (if using Redis)
- [ ] Verify CORS with your domain
- [ ] Run OWASP ZAP security scan

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

**Version**: 2.1.0 (Security-Hardened)  
**Security**: ✅ Production-ready (0 vulnerabilities)  
**Built with**: MCP SDK v1.0.4, OAuth 2.1, bcrypt, Express, JWT (jose), Winston, Helmet  
**API**: Zafari CRS v2

🦁 Built for safari property management excellence
