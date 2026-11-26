// Fixed-window rate limiter keyed by an arbitrary string (IP address, socket id).
// Small and dependency-free; state is in memory like everything else.

export class RateLimiter {
  private hits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Record one attempt; returns false if the key is over its limit for the current window. */
  take(key: string): boolean {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || t - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: t });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  /** Drop expired windows so the map doesn't grow forever. */
  sweep(): void {
    const t = this.now();
    for (const [key, entry] of this.hits) if (t - entry.windowStart >= this.windowMs) this.hits.delete(key);
  }

  forget(key: string): void {
    this.hits.delete(key);
  }

  get size(): number {
    return this.hits.size;
  }
}

/**
 * Limits, sized for a whole party sharing one Wi-Fi (one public IP) while still making
 * room-code guessing pointless: 23^4 ≈ 280k codes at 60 tries a minute is ~3 days per code.
 */
export const LIMITS = {
  createPerIp: { limit: 10, windowMs: 60_000 },
  joinPerIp: { limit: 60, windowMs: 60_000 },
  resumePerIp: { limit: 60, windowMs: 60_000 },
  /** Any event from one socket (steppers can be tapped fast, so this is generous). */
  eventsPerSocket: { limit: 60, windowMs: 10_000 },
  connectionsPerIp: 80,
} as const;
