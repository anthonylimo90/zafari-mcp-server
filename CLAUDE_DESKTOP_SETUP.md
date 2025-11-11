# Claude Desktop Setup Guide

This guide explains how to add your Zafari MCP server as a custom connector in Claude Desktop (2025).

## Prerequisites

- **Claude Desktop Plan**: Pro, Max, Team, or Enterprise (remote MCP servers require a paid plan)
- **Running Server**: Your Zafari MCP server must be running and accessible via HTTP/HTTPS
- **OAuth Enabled**: Server must be running in HTTP mode with OAuth authentication

## Step 1: Start Your Zafari MCP Server

### 1.1 Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set the required variables:

```env
ZAFARI_API_KEY=your-actual-api-key
TRANSPORT=http
PORT=3000
HOST=localhost
JWT_SECRET=$(openssl rand -base64 32)
```

### 1.2 Install and Build

```bash
npm install
npm run build
```

### 1.3 Start the Server

```bash
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
```

## Step 2: Add Connector in Claude Desktop

### For Pro and Max Users

1. **Open Settings**
   - Launch Claude Desktop
   - Click the Settings icon (gear icon, usually in bottom-left)
   - Navigate to **Settings > Connectors**

2. **Add Custom Connector**
   - Scroll to the bottom
   - Click **"Add custom connector"**

3. **Enter Server URL**
   - Input your server URL: `http://localhost:3000/mcp`
   - For production: `https://your-domain.com/mcp`

4. **Configure OAuth (Optional but Recommended)**
   - Click **"Advanced settings"**
   - OAuth Client ID: `claude-desktop` (or leave default)
   - OAuth Client Secret: Leave empty (not required for development)
   - Click **"Done"** or **"Save"**

5. **Complete Setup**
   - Click **"Add"** to finish

### For Enterprise and Team Users

1. **Access Admin Settings**
   - Navigate to **Admin settings > Connectors**
   - (Only Primary Owners or Owners have access)

2. **Add Custom Connector**
   - Click **"Add custom connector"**

3. **Enter Server URL**
   - Input: `http://localhost:3000/mcp` (development)
   - Or: `https://your-domain.com/mcp` (production)

4. **Configure OAuth (Advanced Settings)**
   - Click **"Advanced settings"** if you need to specify OAuth credentials
   - OAuth Client ID: `claude-desktop`
   - OAuth Client Secret: (leave empty for development)

5. **Finalize**
   - Click **"Add"**

## Step 3: Authorize the Connection

### 3.1 OAuth Authorization Flow

When Claude Desktop first connects to your MCP server:

1. **Browser Window Opens**
   - Claude Desktop will automatically open a browser window
   - URL: `http://localhost:3000/oauth/authorize`

2. **Login Page**
   - You'll see the Zafari MCP authorization page
   - Enter credentials:
     - **Username**: `demo`
     - **Password**: `demo123`

3. **Authorize**
   - Click the **"Authorize"** button
   - You'll be redirected back to Claude Desktop

4. **Connection Established**
   - The browser window will close
   - Claude Desktop is now authenticated and connected

### 3.2 OAuth Callback URL

Claude uses the following callback URL:
- Primary: `https://claude.ai/api/mcp/auth_callback`
- Alternative: `https://claude.com/api/mcp/auth_callback`

Your server is configured to allow both `localhost` and HTTPS redirect URIs.

## Step 4: Verify Connection

### 4.1 Check Connection Status

In Claude Desktop:
1. Go to **Settings > Connectors**
2. You should see "Zafari MCP Server" listed
3. Status should show as "Connected" or "Active"

### 4.2 Test the Tools

Start a new conversation in Claude Desktop and try:

```
Can you list all safari properties in the Zafari system?
```

Claude should be able to call the `zafari_list_properties` tool through your MCP server.

### 4.3 Available Tools

Once connected, Claude Desktop has access to:

- **Properties**: `zafari_list_properties`
- **Rooms**: `zafari_list_rooms`, `zafari_get_room_availability`, `zafari_get_room_rates`, `zafari_update_room_availability`, `zafari_update_room_rates`
- **Extras**: `zafari_list_extra_services`, `zafari_get_extra_service_availability`, `zafari_update_extra_service_availability`
- **Bookings**: `zafari_list_bookings`, `zafari_get_booking`, `zafari_create_booking`, `zafari_update_booking_status`
- **Webhooks**: `zafari_get_webhook_config`, `zafari_update_webhook_config`

## Production Deployment

### Using a Public URL

For production use, your server needs to be publicly accessible:

#### Option 1: Cloud Deployment

Deploy to a cloud platform with HTTPS:

```env
ZAFARI_API_KEY=your-production-key
TRANSPORT=http
HOST=mcp.your-domain.com
PORT=443
JWT_SECRET=<strong-random-secret>
```

Add to Claude Desktop:
- URL: `https://mcp.your-domain.com/mcp`

#### Option 2: Tunnel for Testing (ngrok/cloudflared)

For temporary public access during development:

```bash
# Using ngrok
ngrok http 3000

# Using Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3000
```

Then use the provided HTTPS URL in Claude Desktop.

### Security Considerations

1. **HTTPS Required**: Always use HTTPS for production (not localhost)
2. **Strong Secrets**: Generate a strong JWT_SECRET:
   ```bash
   openssl rand -base64 64
   ```
3. **Secure Passwords**: Change default OAuth passwords in production
4. **IP Whitelisting**: Consider restricting access to Claude's IP ranges
5. **Rate Limiting**: Implement rate limiting for production deployments

## Troubleshooting

### "Unable to connect to server"

**Check:**
1. Server is running: `curl http://localhost:3000/health`
2. OAuth metadata is accessible: `curl http://localhost:3000/.well-known/oauth-authorization-server`
3. Firewall isn't blocking connections
4. URL is correct (check for typos)

### "Authentication failed"

**Solutions:**
1. Check credentials (default: `demo` / `demo123`)
2. Verify JWT_SECRET is set and consistent
3. Clear browser cookies and try again
4. Check server logs for specific error messages

### "OAuth callback error"

**Fixes:**
1. Ensure redirect URI validation allows Claude's callback URLs
2. Check server logs for the actual redirect URI being used
3. Verify OAuth endpoints are responding:
   ```bash
   curl http://localhost:3000/.well-known/oauth-authorization-server
   ```

### Connection Works but Tools Don't Appear

1. **Restart Claude Desktop** after adding the connector
2. **Check ZAFARI_API_KEY** is valid in your `.env`
3. **Verify server logs** for any errors when tools are registered
4. **Test MCP endpoint directly**:
   ```bash
   # Get access token first (see OAUTH_SETUP.md)
   curl -X POST http://localhost:3000/mcp \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

### OAuth Token Expired

If you get "Invalid or expired access token":

1. The access token expires after 1 hour
2. Claude Desktop should automatically refresh using the refresh token
3. If refresh fails, remove and re-add the connector
4. Re-authenticate through the OAuth flow

## Advanced Configuration

### Custom OAuth Client

If you're using a custom OAuth provider:

1. **Configure Provider**
   - Set up your OAuth provider (Auth0, Okta, etc.)
   - Configure redirect URIs to allow Claude's callback URLs
   - Get client credentials

2. **Update Server Environment**
   ```env
   OAUTH_ISSUER=https://your-auth-provider.com
   OAUTH_AUDIENCE=zafari-mcp-api
   JWT_SECRET=your-jwt-secret
   ```

3. **In Claude Desktop Advanced Settings**
   - OAuth Client ID: Your provider's client ID
   - OAuth Client Secret: Your provider's client secret

### Dynamic Client Registration (DCR)

The server can support DCR for automatic client credential management. See [OAUTH_SETUP.md](OAUTH_SETUP.md) for implementation details.

## Removing the Connector

To disconnect:

1. Go to **Settings > Connectors**
2. Find "Zafari MCP Server"
3. Click the **remove** or **disconnect** button
4. Confirm the action

This will revoke Claude Desktop's access to your MCP server.

## Support

### Documentation
- [OAUTH_SETUP.md](OAUTH_SETUP.md) - Complete OAuth setup guide
- [README.md](README.md) - General MCP server documentation
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - API quick reference

### Common Issues
- **Server won't start**: Check ZAFARI_API_KEY is set
- **OAuth fails**: Verify credentials (demo/demo123 for development)
- **Tools don't work**: Check Zafari API key permissions
- **Connection timeout**: Ensure server is accessible from Claude Desktop

### Getting Help
- Check server logs for detailed error messages
- Verify all environment variables are set correctly
- Review the OAuth flow in [OAUTH_SETUP.md](OAUTH_SETUP.md)
- Test endpoints manually with curl to isolate issues

---

**Note**: Remote MCP server support requires a Claude Pro, Max, Team, or Enterprise plan. Free users must use local STDIO connections or third-party MCP proxies.

**Security Warning**: Only add connectors from trusted sources. The MCP server will have access to your Zafari CRS data and can perform operations on your behalf.
