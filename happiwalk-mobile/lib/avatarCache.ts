type CacheEntry = {
  url: string;
  expiresAt: number;
};

type PendingEntry = Promise<string | null>;

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, PendingEntry>();
const CACHE_TTL_MS = 50 * 60 * 1000;
const MAX_CACHE_SIZE = 200;

function evictIfNeeded() {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  const toDelete: string[] = [];
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) toDelete.push(key);
  }
  for (const key of toDelete) cache.delete(key);
  while (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) break;
    cache.delete(firstKey);
  }
}

export function getCachedSignedUrl(
  bucket: 'avatars' | 'pet-photos',
  path: string,
  fetcher: () => Promise<string | null>,
): Promise<string | null> {
  const cleanPath = path.replace(/^(avatars|pet-photos)\//, '');
  const cacheKey = `${bucket}:${cleanPath}`;
  const now = Date.now();

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.url);
  }

  const inFlight = pending.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = fetcher()
    .then((url) => {
      pending.delete(cacheKey);
      if (url) {
        cache.set(cacheKey, { url, expiresAt: Date.now() + CACHE_TTL_MS });
        evictIfNeeded();
      }
      return url;
    })
    .catch((err) => {
      pending.delete(cacheKey);
      throw err;
    });

  pending.set(cacheKey, promise);
  return promise;
}

export function getCachedSignedUrlSync(
  bucket: 'avatars' | 'pet-photos',
  path: string,
): string | null {
  const cleanPath = path.replace(/^(avatars|pet-photos)\//, '');
  const cacheKey = `${bucket}:${cleanPath}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  return null;
}

export function prefetchSignedUrl(
  bucket: 'avatars' | 'pet-photos',
  path: string,
  fetcher: () => Promise<string | null>,
): void {
  getCachedSignedUrl(bucket, path, fetcher).catch(() => {});
}

export function clearAvatarCache(): void {
  cache.clear();
  pending.clear();
}
