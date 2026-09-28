import type { NextFunction, Request, Response } from "express";
import { getRedisClient } from "../services/redis-client.js";
import { config } from "../config.js";

// Basic per-session/IP rate limiting on /chat, built in from the start per
// local/planning/01-architecture.md's production-readiness principles.
// Key layout matches local/planning/04-database-schema.md's Redis namespace.
export async function rateLimitChat(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const siteId = typeof req.body?.siteId === "string" ? req.body.siteId : "unknown";
  const identity = typeof req.body?.sessionId === "string" ? req.body.sessionId : req.ip;
  const key = `ratelimit:${siteId}:${identity}`;

  try {
    const client = await getRedisClient();
    const count = await client.incr(key);
    if (count === 1) {
      await client.pExpire(key, config.rateLimit.windowMs);
    }
    if (count > config.rateLimit.maxRequests) {
      res.status(429).json({ error: { message: "Too many requests, please slow down." } });
      return;
    }
    next();
  } catch (err) {
    // Rate limiting must never take the chat endpoint down over a Redis
    // hiccup — fail open, but loudly, rather than 500ing every chat request.
    console.error("rate limit check failed, allowing request", err);
    next();
  }
}
