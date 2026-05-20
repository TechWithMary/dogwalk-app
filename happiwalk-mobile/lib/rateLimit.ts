/**
 * Rate limiter utility to prevent excessive API calls or user actions
 */

interface RateLimiterEntry {
  timestamps: number[];
}

const rateLimiters: Map<string, RateLimiterEntry> = new Map();

/**
 * Check if an action should be rate limited
 * @param key - Unique identifier for the action (e.g., 'upload-photo', 'send-message')
 * @param maxAttempts - Maximum allowed attempts in the time window
 * @param windowMs - Time window in milliseconds
 * @returns {boolean} - True if the action is allowed, false if rate limited
 */
export function checkRateLimit(key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimiters.get(key);

  if (!entry) {
    rateLimiters.set(key, { timestamps: [now] });
    return true;
  }

  const windowStart = now - windowMs;
  entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

  if (entry.timestamps.length >= maxAttempts) {
    return false;
  }

  entry.timestamps.push(now);
  return true;
}

/**
 * Get remaining attempts for a rate limited action
 */
export function getRemainingAttempts(key: string, maxAttempts: number = 5, windowMs: number = 60000): number {
  const now = Date.now();
  const entry = rateLimiters.get(key);

  if (!entry) {
    return maxAttempts;
  }

  const validTimestamps = entry.timestamps.filter(ts => now - ts < windowMs);
  return Math.max(0, maxAttempts - validTimestamps.length);
}

/**
 * Clear rate limiter for a specific key
 */
export function clearRateLimit(key: string): void {
  rateLimiters.delete(key);
}

/**
 * Debounce function to limit how often a function can fire
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit execution to once per specified period
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
