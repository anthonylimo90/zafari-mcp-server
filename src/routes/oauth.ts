import { Router, Request, Response } from "express";
import {
  generateAuthCode,
  verifyAuthCode,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  authenticateUser,
  validateRedirectUri,
} from "../services/oauth.js";

const router = Router();

/**
 * OAuth 2.1 Authorization Endpoint
 * GET /oauth/authorize
 */
router.get("/authorize", (req: Request, res: Response) => {
  const {
    response_type,
    client_id,
    redirect_uri,
    state,
    scope,
    code_challenge,
    code_challenge_method,
  } = req.query;

  // Validate required parameters
  if (!response_type || response_type !== "code") {
    return res.status(400).json({
      error: "invalid_request",
      error_description: "response_type must be 'code'",
    });
  }

  if (!client_id) {
    return res.status(400).json({
      error: "invalid_request",
      error_description: "client_id is required",
    });
  }

  if (!redirect_uri || !validateRedirectUri(redirect_uri as string)) {
    return res.status(400).json({
      error: "invalid_request",
      error_description: "redirect_uri is required and must be valid",
    });
  }

  // PKCE: code_challenge is recommended
  if (code_challenge && code_challenge_method !== "S256") {
    return res.status(400).json({
      error: "invalid_request",
      error_description: "code_challenge_method must be S256",
    });
  }

  // Render simple login page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Zafari MCP - Authorization</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 400px;
          margin: 100px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        .card {
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 { margin: 0 0 20px 0; font-size: 24px; }
        input {
          width: 100%;
          padding: 10px;
          margin: 10px 0;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-sizing: border-box;
        }
        button {
          width: 100%;
          padding: 12px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }
        button:hover { background: #0056b3; }
        .error { color: #dc3545; margin-top: 10px; }
        .info { color: #666; font-size: 14px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🦁 Zafari MCP Authorization</h1>
        <p>Client: <strong>${client_id}</strong></p>
        <p>Scopes: <strong>${scope || "mcp:*"}</strong></p>

        <form id="loginForm">
          <input type="text" name="username" placeholder="Username" required>
          <input type="password" name="password" placeholder="Password" required>
          <button type="submit">Authorize</button>
        </form>

        <div id="error" class="error"></div>
        <div class="info">
          Development credentials:<br>
          Username: <code>demo</code><br>
          Password: <code>demo123</code>
        </div>
      </div>

      <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const params = new URLSearchParams({
            username: formData.get('username'),
            password: formData.get('password'),
            redirect_uri: '${redirect_uri}',
            state: '${state || ""}',
            code_challenge: '${code_challenge || ""}',
            scope: '${scope || "mcp:*"}'
          });

          try {
            const response = await fetch('/oauth/authorize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params
            });

            const data = await response.json();

            if (data.redirect) {
              window.location.href = data.redirect;
            } else if (data.error) {
              document.getElementById('error').textContent = data.error_description || data.error;
            }
          } catch (err) {
            document.getElementById('error').textContent = 'Authentication failed';
          }
        });
      </script>
    </body>
    </html>
  `);
  return;
});

/**
 * OAuth 2.1 Authorization POST Handler
 * POST /oauth/authorize
 */
router.post("/authorize", (req: Request, res: Response) => {
  const { username, password, redirect_uri, state, code_challenge } = req.body;

  // Authenticate user
  const userId = authenticateUser(username, password);
  if (!userId) {
    return res.status(401).json({
      error: "invalid_credentials",
      error_description: "Invalid username or password",
    });
  }

  // Generate authorization code
  const code = generateAuthCode(userId, code_challenge);

  // Build redirect URL
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  res.json({ redirect: redirectUrl.toString() });
  return;
});

/**
 * OAuth 2.1 Token Endpoint
 * POST /oauth/token
 */
router.post("/token", async (req: Request, res: Response) => {
  const { grant_type, code, code_verifier, refresh_token } = req.body;

  if (!grant_type) {
    return res.status(400).json({
      error: "invalid_request",
      error_description: "grant_type is required",
    });
  }

  // Authorization Code flow
  if (grant_type === "authorization_code") {
    if (!code) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "code is required",
      });
    }

    const result = verifyAuthCode(code, code_verifier);
    if (!result) {
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "Invalid or expired authorization code",
      });
    }

    const accessToken = await generateAccessToken(result.userId);
    const refreshToken = generateRefreshToken(result.userId);

    return res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: "mcp:*",
    });
  }

  // Refresh Token flow
  if (grant_type === "refresh_token") {
    if (!refresh_token) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "refresh_token is required",
      });
    }

    const result = verifyRefreshToken(refresh_token);
    if (!result) {
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "Invalid or expired refresh token",
      });
    }

    const accessToken = await generateAccessToken(result.userId);
    const newRefreshToken = generateRefreshToken(result.userId);

    // Revoke old refresh token
    revokeRefreshToken(refresh_token);

    return res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: "mcp:*",
    });
  }

  return res.status(400).json({
    error: "unsupported_grant_type",
    error_description: "Only authorization_code and refresh_token are supported",
  });
});

/**
 * Protected Resource Metadata (RFC 8414)
 * GET /.well-known/oauth-authorization-server
 */
router.get("/.well-known/oauth-authorization-server", (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.json({
    issuer: process.env.OAUTH_ISSUER || "zafari-mcp-server",
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp:read", "mcp:write", "mcp:*"],
  });
});

export default router;
