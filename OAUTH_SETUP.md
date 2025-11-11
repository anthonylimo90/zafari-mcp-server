# OAuth 2.1 Setup Guide for Zafari MCP Server

This guide explains how to set up and use the Zafari MCP server as a remote OAuth-enabled server for Claude Desktop and other MCP clients.

## Overview

The Zafari MCP server now supports OAuth 2.1 authentication, making it compatible with Claude Desktop's remote MCP server requirements. This enables secure, token-based access to your safari property management tools.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
ZAFARI_API_KEY=your-actual-zafari-api-key
TRANSPORT=http
PORT=3000
JWT_SECRET=$(openssl rand -base64 32)
```

### 3. Build and Run

```bash
npm run build
npm start
```

You should see:

```
====================================
Zafari MCP Server with OAuth 2.1
====================================
MCP Endpoint: http://localhost:3000/mcp
OAuth Metadata: http://localhost:3000/.well-known/oauth-authorization-server
Authorization: http://localhost:3000/oauth/authorize
Health Check: http://localhost:3000/health
====================================
OAuth Credentials (Development):
  Username: demo
  Password: demo123
====================================
```

## Claude Desktop Configuration

### Step 1: Update Claude Desktop Config

Edit your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

Add the Zafari MCP server configuration:

```json
{
  "mcpServers": {
    "zafari": {
      "url": "http://localhost:3000/mcp",
      "transport": "http",
      "oauth": {
        "authorizationUrl": "http://localhost:3000/oauth/authorize",
        "tokenUrl": "http://localhost:3000/oauth/token",
        "clientId": "claude-desktop",
        "scopes": ["mcp:*"]
      }
    }
  }
}
```

### Step 2: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Restart the application
3. Claude Desktop will automatically initiate the OAuth flow when it needs to access the MCP server

### Step 3: Authorize Access

When Claude Desktop first connects:

1. A browser window will open to `http://localhost:3000/oauth/authorize`
2. Log in with credentials:
   - **Username**: `demo`
   - **Password**: `demo123`
3. Click "Authorize"
4. You'll be redirected back to Claude Desktop
5. The connection is now established and authenticated

## OAuth Endpoints

The server exposes the following OAuth 2.1 endpoints:

### Authorization Endpoint
- **URL**: `/oauth/authorize`
- **Method**: GET/POST
- **Purpose**: User authorization and code generation
- **Parameters**:
  - `response_type`: must be `code`
  - `client_id`: your client identifier
  - `redirect_uri`: callback URL (must be HTTPS or localhost)
  - `state`: recommended for CSRF protection
  - `code_challenge`: PKCE code challenge (recommended)
  - `code_challenge_method`: must be `S256`

### Token Endpoint
- **URL**: `/oauth/token`
- **Method**: POST
- **Purpose**: Exchange authorization code for access token
- **Grant Types**:
  - `authorization_code`: Initial token request
  - `refresh_token`: Refresh expired token

### Metadata Endpoint
- **URL**: `/.well-known/oauth-authorization-server`
- **Method**: GET
- **Purpose**: Server capability discovery (RFC 8414)

## Security Features

### PKCE (Proof Key for Code Exchange)
- Required for public clients
- Uses SHA-256 challenge method
- Prevents authorization code interception attacks

### Token Security
- Access tokens expire after 1 hour
- Refresh tokens expire after 30 days
- JWT-based access tokens with signature verification
- Automatic token cleanup for expired tokens

### Redirect URI Validation
- Allows `localhost` and `127.0.0.1` for development
- Requires HTTPS for production redirect URIs
- Prevents open redirect vulnerabilities

## Testing the OAuth Flow

### Manual Testing with cURL

#### 1. Get Authorization Code

Open in browser:
```
http://localhost:3000/oauth/authorize?response_type=code&client_id=test&redirect_uri=http://localhost:3000/callback&state=random123
```

Log in and you'll be redirected to:
```
http://localhost:3000/callback?code=AUTH_CODE&state=random123
```

#### 2. Exchange Code for Token

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTH_CODE" \
  -d "client_id=test"
```

Response:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

#### 3. Use Access Token

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'
```

#### 4. Refresh Token

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=YOUR_REFRESH_TOKEN" \
  -d "client_id=test"
```

## Production Deployment

### Environment Variables

For production, set these environment variables:

```bash
# Required
ZAFARI_API_KEY=your-production-api-key
TRANSPORT=http

# Server Configuration
HOST=your-domain.com
PORT=443  # Use HTTPS in production

# OAuth Security
JWT_SECRET=$(openssl rand -base64 64)  # Strong random secret
OAUTH_ISSUER=https://your-domain.com
OAUTH_AUDIENCE=zafari-mcp-api

# User Management (replace with real auth system)
ADMIN_PASSWORD=strong-secure-password
```

### HTTPS Setup

In production, always use HTTPS. You can:

1. **Use a reverse proxy** (recommended):
   - nginx or Apache with SSL termination
   - Let's Encrypt for free SSL certificates

2. **Use a cloud platform**:
   - AWS ELB/ALB with ACM certificates
   - Google Cloud Load Balancer
   - Cloudflare

3. **Update Node.js to use HTTPS**:
   ```typescript
   import https from 'https';
   import fs from 'fs';

   const options = {
     key: fs.readFileSync('private-key.pem'),
     cert: fs.readFileSync('certificate.pem')
   };

   https.createServer(options, app).listen(443);
   ```

### User Authentication

The current implementation uses hardcoded credentials for development. For production:

1. **Integrate with existing auth system**:
   - LDAP/Active Directory
   - Database with bcrypt password hashing
   - OAuth provider (Auth0, Okta, etc.)

2. **Update `authenticateUser` in `src/services/oauth.ts`**:
   ```typescript
   export async function authenticateUser(
     username: string,
     password: string
   ): Promise<string | null> {
     // Query your database
     const user = await db.users.findOne({ username });
     if (!user) return null;

     // Verify bcrypt hash
     const valid = await bcrypt.compare(password, user.passwordHash);
     if (!valid) return null;

     return user.id;
   }
   ```

3. **Consider multi-factor authentication (MFA)**

### Token Storage

The current implementation uses in-memory storage. For production:

1. **Use Redis** for token storage:
   - Fast access
   - Automatic expiration
   - Scalable across multiple servers

2. **Use a database**:
   - PostgreSQL with token table
   - MongoDB with TTL indexes

## Troubleshooting

### "Invalid or expired access token"

- Token may have expired (1 hour lifetime)
- Use refresh token to get a new access token
- Check JWT_SECRET hasn't changed (would invalidate all tokens)

### "redirect_uri is required and must be valid"

- Ensure redirect URI uses HTTPS or is localhost
- URI must be URL-encoded if it contains special characters
- Check for typos in the URI

### "Invalid username or password"

- Default credentials are `demo` / `demo123`
- Check DEMO_PASSWORD environment variable
- In production, verify your authentication integration

### Claude Desktop Connection Issues

1. Check server is running: `curl http://localhost:3000/health`
2. Verify OAuth metadata: `curl http://localhost:3000/.well-known/oauth-authorization-server`
3. Check Claude Desktop config syntax (valid JSON)
4. Restart Claude Desktop after config changes
5. Check Claude Desktop logs for errors

## Advanced Configuration

### Custom Scopes

Modify scopes in `src/routes/oauth.ts`:

```typescript
router.get("/.well-known/oauth-authorization-server", (req, res) => {
  res.json({
    // ...
    scopes_supported: [
      "mcp:read",
      "mcp:write",
      "mcp:bookings",
      "mcp:rooms",
      "mcp:*"
    ],
  });
});
```

### Token Lifetime

Adjust in `src/services/oauth.ts`:

```typescript
export async function generateAccessToken(userId: string) {
  return await new SignJWT({ sub: userId })
    .setExpirationTime("2h")  // Change from 1h to 2h
    .sign(secret);
}
```

### Rate Limiting

Add rate limiting to prevent abuse:

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts'
});

app.use('/oauth/token', authLimiter);
```

## Migration from Stdio

If you were using stdio mode (legacy Claude Desktop integration):

1. **Update transport**: Change `TRANSPORT=stdio` to `TRANSPORT=http` in `.env`
2. **Update Claude config**: Replace `command`/`args` with `url` and `oauth` configuration
3. **Remove local path dependencies**: Server now runs remotely
4. **Add authentication**: Configure OAuth credentials

## Support

For issues or questions:
- Check the main [README.md](README.md) for general documentation
- Review [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for deployment options
- Open an issue on the project repository

---

**Security Note**: This OAuth implementation is designed for development and testing. For production use with sensitive data, consider:
- Professional security audit
- Integration with enterprise OAuth providers (Auth0, Okta, AWS Cognito)
- Multi-factor authentication
- Rate limiting and DDoS protection
- Comprehensive audit logging
