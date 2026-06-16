import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEntry = {
  url: string;
  expiresAt: number;
};

type PendingEntry = Promise<string | null>;

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, PendingEntry>();
const CACHE_TTL_MS = 50 * 60 * 1000;
const MAX_CACHE_SIZE = 200;
const STORAGE_KEY = 'avatar_url_cache';

let cacheLoaded: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function loadCacheFromStorage(): Promise<void> {
  return (async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const entries: Record<string, { url: string; expiresAt: number }> = JSON.parse(stored);
        const now = Date.now();
        for (const [key, entry] of Object.entries(entries)) {
          if (entry.expiresAt > now) {
            cache.set(key, entry);
          }
        }
      }
    } catch (e) {
      console.error('[AvatarCache] Failed to load:', e);
    }
  })();
}

function persistCacheToStorage(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      const now = Date.now();
      const entries: Record<string, { url: string; expiresAt: number }> = {};
      for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt > now) {
          entries[key] = entry;
        }
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('[AvatarCache] Failed to persist:', e);
    }
  }, 300);
}

function ensureCacheLoaded(): Promise<void> {
  if (!cacheLoaded) {
    cacheLoaded = loadCacheFromStorage();
  }
  return cacheLoaded;
}

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

export async function getCachedSignedUrl(
  bucket: 'avatars' | 'pet-photos',
  path: string,
  fetcher: () => Promise<string | null>,
): Promise<string | null> {
  await ensureCacheLoaded();

  const cleanPath = path.replace(/^(avatars|pet-photos)\//, '');
  const cacheKey = `${bucket}:${cleanPath}`;
  const now = Date.now();

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  const inFlight = pending.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = fetcher()
    .then((url) => {
      pending.delete(cacheKey);
      if (url) {
        cache.set(cacheKey, { url, expiresAt: Date.now() + CACHE_TTL_MS });
        evictIfNeeded();
        persistCacheToStorage();
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
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
