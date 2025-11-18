# Security Assessment & Recommendations

## Executive Summary

This document provides a comprehensive security assessment of the Zafari MCP Server, identifying vulnerabilities, security best practices implemented, and recommendations for production deployment.

**Assessment Date:** November 2025
**Version:** 2.0.0 (OAuth-enabled)
**Overall Security Status:** ⚠️ **Development-Ready** (Requires hardening for production)

---

## 🔍 Security Audit Findings

### ✅ Security Strengths

#### 1. **Input Validation**
- ✅ **Zod Schemas**: All user inputs are validated using comprehensive Zod schemas
- ✅ **Type Safety**: Full TypeScript implementation with strict mode
- ✅ **Date Validation**: Regex validation for date formats (YYYY-MM-DD)
- ✅ **Email Validation**: Proper email format checking
- ✅ **Range Validation**: Min/max constraints on numeric inputs
- ✅ **Required Fields**: All critical fields marked as required

#### 2. **Authentication & Authorization**
- ✅ **OAuth 2.1 Standard**: Implements OAuth 2.1 authorization code flow
- ✅ **JWT Tokens**: Secure token-based authentication with jose library
- ✅ **Token Expiration**: Access tokens expire in 1 hour
- ✅ **Refresh Tokens**: 30-day refresh tokens with rotation
- ✅ **PKCE Support**: Proof Key for Code Exchange for public clients (S256)
- ✅ **Scope Management**: Granular permission control with scopes
- ✅ **Bearer Token Auth**: Standard Authorization header implementation

#### 3. **API Security**
- ✅ **HTTPS Enforcement**: Redirect URI validation requires HTTPS (except localhost)
- ✅ **API Key Protection**: API key never exposed in responses
- ✅ **Error Handling**: Generic error messages (no sensitive data leakage)
- ✅ **Timeout Protection**: 30-second request timeout prevents hanging
- ✅ **No SQL Injection**: No direct database queries (API-based)
- ✅ **No XSS**: No dangerous functions (eval, innerHTML, etc.) detected

#### 4. **Code Quality**
- ✅ **No Hardcoded Secrets**: Uses environment variables
- ✅ **Secure Dependencies**: Modern, well-maintained packages
- ✅ **Clean Separation**: Auth middleware properly isolates protected routes
- ✅ **Type Safety**: Explicit types throughout codebase

---

## 🚨 Critical Security Issues (Production Blockers)

### 1. **Plaintext Password Storage** 🔴 CRITICAL
**Location:** [src/services/oauth.ts:161-174](src/services/oauth.ts#L161-L174)

**Issue:**
```typescript
export function authenticateUser(username: string, password: string): string | null {
  const validUsers = new Map<string, string>([
    ["admin", process.env.ADMIN_PASSWORD || "admin123"],
    ["demo", process.env.DEMO_PASSWORD || "demo123"],
  ]);

  const storedPassword = validUsers.get(username);
  if (storedPassword && storedPassword === password) {  // ❌ Plaintext comparison
    return username;
  }
  return null;
}
```

**Risk:** Passwords are stored and compared in plaintext, vulnerable to memory dumps and logs.

**Recommendation:**
```typescript
import bcrypt from 'bcrypt';

// Store hashed passwords
const validUsers = new Map<string, string>([
  ["admin", await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)],
  ["demo", await bcrypt.hash(process.env.DEMO_PASSWORD, 10)],
]);

// Use constant-time comparison
if (storedPassword && await bcrypt.compare(password, storedPassword)) {
  return username;
}
```

**Action Required:**
- [ ] Install bcrypt: `npm install bcrypt @types/bcrypt`
- [ ] Hash passwords using bcrypt with salt rounds ≥ 10
- [ ] Use constant-time comparison to prevent timing attacks

---

### 2. **In-Memory Token Storage** 🔴 CRITICAL
**Location:** [src/services/oauth.ts:10-11](src/services/oauth.ts#L10-L11)

**Issue:**
```typescript
const authCodes = new Map<string, { userId: string; codeChallenge?: string; expiresAt: number }>();
const refreshTokens = new Map<string, { userId: string; expiresAt: number }>();
```

**Risk:**
- Tokens lost on server restart (users logged out)
- No horizontal scaling possible
- No token revocation across instances
- Memory leaks with many tokens

**Recommendation:**
```typescript
// Use Redis or database
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export async function generateAuthCode(userId: string, codeChallenge?: string): Promise<string> {
  const code = crypto.randomBytes(32).toString("base64url");
  await redis.setex(`auth:${code}`, 600, JSON.stringify({ userId, codeChallenge }));
  return code;
}
```

**Action Required:**
- [ ] Implement Redis for token storage
- [ ] Or use database (PostgreSQL, MongoDB) with TTL indexes
- [ ] Ensure persistence across restarts

---

### 3. **Weak Default Credentials** 🟠 HIGH
**Location:** [src/services/oauth.ts:164-165](src/services/oauth.ts#L164-L165), [.env.example:29-30](.env.example#L29-L30)

**Issue:**
```typescript
["admin", process.env.ADMIN_PASSWORD || "admin123"],  // ❌ Weak default
["demo", process.env.DEMO_PASSWORD || "demo123"],     // ❌ Weak default
```

**Risk:**
- Default credentials are publicly visible in documentation
- Easily guessable passwords
- No password complexity requirements

**Recommendation:**
```typescript
// Require strong passwords, no defaults
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword || adminPassword.length < 12) {
  throw new Error("ADMIN_PASSWORD must be set and at least 12 characters");
}

// Or enforce complexity
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
if (!passwordRegex.test(adminPassword)) {
  throw new Error("Password must meet complexity requirements");
}
```

**Action Required:**
- [ ] Remove default password fallbacks
- [ ] Enforce minimum password length (12+ characters)
- [ ] Require password complexity (uppercase, lowercase, numbers, symbols)
- [ ] Document password requirements clearly

---

### 4. **No Rate Limiting** 🟠 HIGH
**Location:** [src/index.ts:41-76](src/index.ts#L41-L76)

**Issue:** No rate limiting on OAuth endpoints or MCP calls.

**Risk:**
- Brute-force attacks on login
- Credential stuffing attacks
- API abuse and DoS
- Resource exhaustion

**Recommendation:**
```typescript
import rateLimit from 'express-rate-limit';

// Auth endpoints - strict
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many authentication attempts, please try again later',
});

// API endpoints - generous
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests
});

app.use('/oauth/authorize', authLimiter);
app.use('/oauth/token', authLimiter);
app.use('/mcp', apiLimiter);
```

**Action Required:**
- [ ] Install express-rate-limit: `npm install express-rate-limit`
- [ ] Add rate limiting to all auth endpoints (5 attempts per 15 min)
- [ ] Add rate limiting to MCP endpoints (100 requests per min)
- [ ] Log rate limit violations for monitoring

---

### 5. **JWT Secret Generation** 🟠 HIGH
**Location:** [src/services/oauth.ts:16-32](src/services/oauth.ts#L16-L32)

**Issue:**
```typescript
if (!secretEnv) {
  // Generate a new secret (only for development)
  const generatedSecret = await generateSecret("HS256");
  console.warn("⚠️  Generated new JWT secret. Set JWT_SECRET env var for production.");
}
```

**Risk:**
- Secret regenerated on each restart
- All existing tokens invalidated on restart
- Unpredictable behavior in production

**Recommendation:**
```typescript
async function getJWTSecret(): Promise<Uint8Array> {
  const secretEnv = process.env.JWT_SECRET;

  // Require JWT_SECRET in production
  if (process.env.NODE_ENV === 'production' && !secretEnv) {
    throw new Error("JWT_SECRET must be set in production");
  }

  if (!secretEnv) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  // Validate secret strength
  if (secretEnv.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }

  return new TextEncoder().encode(secretEnv);
}
```

**Action Required:**
- [ ] Require JWT_SECRET in all environments
- [ ] Generate strong secret: `openssl rand -base64 64`
- [ ] Store securely (environment variable, secret manager)
- [ ] Never commit JWT_SECRET to version control

---

## ⚠️ Medium Priority Issues

### 6. **No CORS Configuration** 🟡 MEDIUM
**Location:** [src/index.ts:45-47](src/index.ts#L45-L47)

**Issue:** No CORS headers configured for HTTP transport.

**Risk:**
- CORS errors in browser-based clients
- Overly permissive access if misconfigured

**Recommendation:**
```typescript
import cors from 'cors';

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://claude.ai',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

**Action Required:**
- [ ] Install cors: `npm install cors @types/cors`
- [ ] Configure allowed origins
- [ ] Set appropriate credentials policy

---

### 7. **Missing Security Headers** 🟡 MEDIUM
**Location:** [src/index.ts](src/index.ts)

**Issue:** No security headers (HSTS, CSP, X-Frame-Options, etc.).

**Recommendation:**
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

**Action Required:**
- [ ] Install helmet: `npm install helmet`
- [ ] Configure CSP, HSTS, X-Frame-Options
- [ ] Test with security scanners

---

### 8. **No Request Logging** 🟡 MEDIUM
**Location:** [src/index.ts](src/index.ts)

**Issue:** No structured logging for security events.

**Risk:**
- Cannot detect attacks
- No audit trail
- Difficult to debug security issues

**Recommendation:**
```typescript
import morgan from 'morgan';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Security event logging
logger.info('Authentication attempt', { userId, ip: req.ip, success: true });
logger.warn('Rate limit exceeded', { ip: req.ip, endpoint: req.path });
logger.error('Token verification failed', { error: error.message });
```

**Action Required:**
- [ ] Implement structured logging (winston, pino)
- [ ] Log authentication attempts (success/failure)
- [ ] Log authorization failures
- [ ] Log rate limit violations
- [ ] Never log sensitive data (passwords, tokens)

---

### 9. **Authorization Code Replay** 🟡 MEDIUM
**Location:** [src/services/oauth.ts:50-76](src/services/oauth.ts#L50-L76)

**Issue:** Authorization codes are properly consumed after use ✅, but no additional replay protection.

**Current Implementation (Good):**
```typescript
// Consume code (one-time use)
authCodes.delete(code);  // ✅ Good: Code deleted after use
return { userId: data.userId };
```

**Additional Hardening:**
```typescript
// Add used code tracking for paranoid mode
const usedCodes = new Set<string>();

export function verifyAuthCode(code: string, codeVerifier?: string): { userId: string } | null {
  // Check if code was already used
  if (usedCodes.has(code)) {
    logger.warn('Authorization code replay attempt', { code: code.substring(0, 10) });
    return null;
  }

  const data = authCodes.get(code);
  if (!data) return null;

  // ... verification logic ...

  authCodes.delete(code);
  usedCodes.add(code);  // Track used codes

  // Clean up old used codes after 1 hour
  setTimeout(() => usedCodes.delete(code), 60 * 60 * 1000);

  return { userId: data.userId };
}
```

---

### 10. **Client ID Validation** 🟡 MEDIUM
**Location:** [src/routes/oauth.ts:38-43](src/routes/oauth.ts#L38-L43)

**Issue:** Client ID is accepted but not validated against a whitelist.

**Risk:**
- Any client can request authorization
- No client authentication
- Difficult to revoke specific clients

**Recommendation:**
```typescript
const ALLOWED_CLIENTS = new Set([
  'claude-desktop',
  'mcp-inspector',
  process.env.CUSTOM_CLIENT_ID,
].filter(Boolean));

if (!client_id || !ALLOWED_CLIENTS.has(client_id as string)) {
  return res.status(400).json({
    error: "unauthorized_client",
    error_description: "Invalid or unregistered client_id",
  });
}
```

**Action Required:**
- [ ] Maintain whitelist of allowed client IDs
- [ ] Validate client_id in authorization endpoint
- [ ] Document client registration process

---

## ℹ️ Low Priority Issues

### 11. **Token Cleanup Interval** 🟢 LOW
**Location:** [src/services/oauth.ts:221](src/services/oauth.ts#L221)

**Issue:** 5-minute cleanup interval is reasonable but could be optimized.

**Current:** `setInterval(cleanupExpiredTokens, 5 * 60 * 1000);`

**Recommendation:** Use Redis TTL or database TTL indexes instead of manual cleanup.

---

### 12. **Error Message Verbosity** 🟢 LOW
**Location:** [src/services/api-client.ts:70-101](src/services/api-client.ts#L70-L101)

**Issue:** Error messages are appropriately generic, good security practice ✅

**Note:** Current implementation is secure. Do not add more details that could leak information.

---

## 🛡️ Security Best Practices Implemented

### ✅ Already Implemented
1. **Environment Variables**: Sensitive data stored in .env (not committed)
2. **TypeScript**: Strong typing prevents many common errors
3. **Zod Validation**: Input validation on all endpoints
4. **JWT Standard**: Industry-standard authentication
5. **PKCE Support**: Enhanced security for public clients
6. **HTTPS Redirect Validation**: Prevents redirect attacks
7. **Token Expiration**: Short-lived access tokens
8. **Refresh Token Rotation**: Limits exposure window
9. **No Dangerous Functions**: No eval, innerHTML, etc.
10. **Error Handling**: Generic error messages (no info leakage)

### ⚠️ Needs Implementation
1. **Password Hashing**: Use bcrypt for password storage
2. **Persistent Storage**: Use Redis/database for tokens
3. **Rate Limiting**: Protect against brute-force attacks
4. **Request Logging**: Security event monitoring
5. **CORS**: Configure allowed origins
6. **Security Headers**: Use Helmet.js
7. **Input Sanitization**: Additional XSS protection
8. **Client Whitelisting**: Validate client IDs

---

## 📋 Production Deployment Checklist

### Pre-Deployment (Critical)
- [ ] Hash all passwords with bcrypt (salt rounds ≥ 10)
- [ ] Implement Redis/database for token storage
- [ ] Set strong JWT_SECRET (64+ characters)
- [ ] Change all default passwords
- [ ] Remove password fallbacks from code
- [ ] Add rate limiting to all endpoints
- [ ] Configure CORS with specific origins
- [ ] Add security headers (Helmet.js)
- [ ] Implement structured logging
- [ ] Validate client IDs against whitelist

### Environment Configuration
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS only (no localhost exceptions)
- [ ] Set strong `ADMIN_PASSWORD` (16+ chars, complex)
- [ ] Generate `JWT_SECRET`: `openssl rand -base64 64`
- [ ] Configure `ALLOWED_ORIGINS` for CORS
- [ ] Set up Redis URL or database connection
- [ ] Configure logging output (file/service)

### Infrastructure Security
- [ ] Enable firewall rules (only 443/80 exposed)
- [ ] Use reverse proxy (nginx, Apache, Cloudflare)
- [ ] Enable TLS 1.3 only
- [ ] Configure rate limiting at proxy level
- [ ] Set up DDoS protection
- [ ] Enable WAF (Web Application Firewall)
- [ ] Configure security monitoring/alerts

### Application Security
- [ ] Run `npm audit` and fix all vulnerabilities
- [ ] Update all dependencies to latest versions
- [ ] Remove development dependencies from production
- [ ] Enable read-only file system (if possible)
- [ ] Run as non-root user
- [ ] Set resource limits (memory, CPU)

### Monitoring & Logging
- [ ] Set up centralized logging (ELK, Datadog, etc.)
- [ ] Configure error alerting (Sentry, PagerDuty)
- [ ] Monitor authentication failures
- [ ] Track rate limit violations
- [ ] Monitor API response times
- [ ] Set up health check monitoring

### Testing
- [ ] Run OWASP ZAP security scan
- [ ] Test rate limiting effectiveness
- [ ] Verify CORS configuration
- [ ] Test token expiration/refresh flow
- [ ] Verify password complexity enforcement
- [ ] Test with invalid inputs (fuzzing)

---

## 🔧 Quick Fixes (Apply Immediately)

### 1. Update .env.example
```env
# Remove weak defaults, require strong passwords
JWT_SECRET=REQUIRED_SET_THIS_TO_64_CHAR_RANDOM_STRING
ADMIN_PASSWORD=REQUIRED_MIN_16_CHARS
DEMO_PASSWORD=REQUIRED_MIN_16_CHARS

# Add security settings
NODE_ENV=development
ALLOWED_ORIGINS=https://claude.ai
REDIS_URL=redis://localhost:6379
```

### 2. Update README Security Section
Add prominent security warning:
```markdown
## ⚠️ SECURITY WARNING

**This server is NOT production-ready out of the box.** Before deploying to production:

1. Read [SECURITY.md](SECURITY.md) completely
2. Implement password hashing (bcrypt)
3. Use Redis/database for token storage
4. Add rate limiting
5. Configure security headers
6. Set strong passwords (16+ characters)
7. Enable HTTPS only (no localhost)

**DO NOT use default credentials in production!**
```

### 3. Add Security Headers Now
```typescript
// Minimal security headers (add to src/index.ts)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

---

## 📚 Security Resources

### Standards & Specifications
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-11)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security](https://owasp.org/API-Security/)

### Libraries & Tools
- [bcrypt](https://www.npmjs.com/package/bcrypt) - Password hashing
- [helmet](https://www.npmjs.com/package/helmet) - Security headers
- [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) - Rate limiting
- [cors](https://www.npmjs.com/package/cors) - CORS configuration
- [winston](https://www.npmjs.com/package/winston) - Logging

### Testing Tools
- [OWASP ZAP](https://www.zaproxy.org/) - Security scanner
- [npm audit](https://docs.npmjs.com/cli/v10/commands/npm-audit) - Dependency vulnerabilities
- [Snyk](https://snyk.io/) - Continuous security monitoring

---

## 📞 Security Contact

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email security concerns privately
3. Include steps to reproduce
4. Allow reasonable time for fix before disclosure

---

## 📄 License & Disclaimer

This security assessment is provided as-is for informational purposes. The maintainers are not responsible for security issues arising from deployment without following these recommendations.

**Always conduct your own security audit before production deployment.**

---

**Last Updated:** November 11, 2025
**Next Review:** Before production deployment
