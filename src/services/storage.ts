import Redis from "ioredis";
import { logger } from "./logger.js";

/**
 * Token storage abstraction layer
 * Supports both in-memory (development) and Redis (production) backends
 */

// Types for stored data
export interface AuthCodeData {
    userId: string;
    codeChallenge?: string;
    expiresAt: number;
}

export interface RefreshTokenData {
    userId: string;
    expiresAt: number;
}

/**
 * Storage interface
 */
export interface TokenStorage {
    // Auth codes
    setAuthCode(code: string, data: AuthCodeData): Promise<void>;
    getAuthCode(code: string): Promise<AuthCodeData | null>;
    deleteAuthCode(code: string): Promise<void>;

    // Refresh tokens
    setRefreshToken(token: string, data: RefreshTokenData): Promise<void>;
    getRefreshToken(token: string): Promise<RefreshTokenData | null>;
    deleteRefreshToken(token: string): Promise<void>;

    // Cleanup
    cleanup(): Promise<void>;
}

/**
 * In-memory storage implementation (for development)
 */
class MemoryStorage implements TokenStorage {
    private authCodes = new Map<string, AuthCodeData>();
    private refreshTokens = new Map<string, RefreshTokenData>();

    async setAuthCode(code: string, data: AuthCodeData): Promise<void> {
        this.authCodes.set(code, data);
    }

    async getAuthCode(code: string): Promise<AuthCodeData | null> {
        return this.authCodes.get(code) || null;
    }

    async deleteAuthCode(code: string): Promise<void> {
        this.authCodes.delete(code);
    }

    async setRefreshToken(token: string, data: RefreshTokenData): Promise<void> {
        this.refreshTokens.set(token, data);
    }

    async getRefreshToken(token: string): Promise<RefreshTokenData | null> {
        return this.refreshTokens.get(token) || null;
    }

    async deleteRefreshToken(token: string): Promise<void> {
        this.refreshTokens.delete(token);
    }

    async cleanup(): Promise<void> {
        const now = Date.now();

        // Clean expired auth codes
        for (const [code, data] of this.authCodes.entries()) {
            if (now > data.expiresAt) {
                this.authCodes.delete(code);
            }
        }

        // Clean expired refresh tokens
        for (const [token, data] of this.refreshTokens.entries()) {
            if (now > data.expiresAt) {
                this.refreshTokens.delete(token);
            }
        }
    }
}

/**
 * Redis storage implementation (for production)
 */
class RedisStorage implements TokenStorage {
    private client: Redis;

    constructor(redisUrl: string) {
        this.client = new Redis(redisUrl, {
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        this.client.on("error", (err) => {
            logger.error("Redis connection error", { error: err.message });
        });

        this.client.on("connect", () => {
            logger.info("Redis connected successfully");
        });
    }

    async setAuthCode(code: string, data: AuthCodeData): Promise<void> {
        const key = `auth:code:${code}`;
        const ttl = Math.floor((data.expiresAt - Date.now()) / 1000);
        await this.client.setex(key, ttl, JSON.stringify(data));
    }

    async getAuthCode(code: string): Promise<AuthCodeData | null> {
        const key = `auth:code:${code}`;
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async deleteAuthCode(code: string): Promise<void> {
        const key = `auth:code:${code}`;
        await this.client.del(key);
    }

    async setRefreshToken(token: string, data: RefreshTokenData): Promise<void> {
        const key = `auth:refresh:${token}`;
        const ttl = Math.floor((data.expiresAt - Date.now()) / 1000);
        await this.client.setex(key, ttl, JSON.stringify(data));
    }

    async getRefreshToken(token: string): Promise<RefreshTokenData | null> {
        const key = `auth:refresh:${token}`;
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async deleteRefreshToken(token: string): Promise<void> {
        const key = `auth:refresh:${token}`;
        await this.client.del(key);
    }

    async cleanup(): Promise<void> {
        // Redis handles TTL automatically, no manual cleanup needed
    }
}

/**
 * Storage factory - creates appropriate storage based on configuration
 */
export function createTokenStorage(): TokenStorage {
    const backend = process.env.STORAGE_BACKEND || "memory";

    if (backend === "redis") {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            throw new Error(
                "REDIS_URL environment variable is required when STORAGE_BACKEND=redis"
            );
        }
        logger.info("Using Redis token storage", { redisUrl });
        return new RedisStorage(redisUrl);
    }

    // Default to memory storage
    if (process.env.NODE_ENV === "production") {
        logger.warn(
            "⚠️  Using in-memory token storage in production! Tokens will be lost on restart. Set STORAGE_BACKEND=redis for production."
        );
    } else {
        logger.info("Using in-memory token storage (development mode)");
    }

    return new MemoryStorage();
}

// Create and export singleton instance
export const tokenStorage = createTokenStorage();

// Set up periodic cleanup for memory storage
if (process.env.STORAGE_BACKEND !== "redis") {
    setInterval(() => {
        tokenStorage.cleanup().catch((err) => {
            logger.error("Token cleanup failed", { error: err.message });
        });
    }, 5 * 60 * 1000); // Every 5 minutes
}
