// app/api/agent/lib/rateLimit.ts

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

interface WindowConfig {
  windowMs: number;
  maxRequests: number;
}

function envInt(key: string): number | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const ipTimestamps = new Map<string, number[]>();

class RequestRateLimiter {
  private readonly perMinute: WindowConfig;
  private readonly perHour: WindowConfig;

  constructor() {
    this.perMinute = {
      windowMs: 60_000,
      maxRequests: envInt("RATE_LIMIT_PER_MINUTE") ?? 10,
    };
    this.perHour = {
      windowMs: 3_600_000,
      maxRequests: envInt("RATE_LIMIT_PER_HOUR") ?? 120,
    };

    setInterval(() => this.cleanup(), 60_000);
  }

  check(ip: string): RateLimitResult {
    if (process.env.NODE_ENV === "development") {
      return { allowed: true, remaining: Infinity };
    }

    const now = Date.now();
    const timestamps = ipTimestamps.get(ip) ?? [];

    // Prune anything older than the larger window (1 hour)
    const pruned = timestamps.filter((t) => now - t < this.perHour.windowMs);

    // Check per-minute
    const recentMinute = pruned.filter(
      (t) => now - t < this.perMinute.windowMs
    );
    if (recentMinute.length >= this.perMinute.maxRequests) {
      const oldestInWindow = recentMinute[0];
      const retryAfterSeconds = Math.ceil(
        (oldestInWindow + this.perMinute.windowMs - now) / 1000
      );
      ipTimestamps.set(ip, pruned);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    // Check per-hour
    if (pruned.length >= this.perHour.maxRequests) {
      const oldestInWindow = pruned[0];
      const retryAfterSeconds = Math.ceil(
        (oldestInWindow + this.perHour.windowMs - now) / 1000
      );
      ipTimestamps.set(ip, pruned);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    // Allowed
    pruned.push(now);
    ipTimestamps.set(ip, pruned);
    const minuteRemaining =
      this.perMinute.maxRequests - recentMinute.length - 1;
    const hourRemaining = this.perHour.maxRequests - pruned.length;
    return {
      allowed: true,
      remaining: Math.min(minuteRemaining, hourRemaining),
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [ip, timestamps] of ipTimestamps) {
      const newest = timestamps[timestamps.length - 1];
      if (newest === undefined || now - newest > this.perHour.windowMs) {
        ipTimestamps.delete(ip);
      }
    }
  }
}

export function extractIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

export const requestRateLimiter = new RequestRateLimiter();
