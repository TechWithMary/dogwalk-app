import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getCachedSignedUrlSync } from '../lib/avatarCache';

async function fetchSignedUrl(bucket, cleanPath) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(cleanPath, 3600);
      if (error) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        console.error(`Error generating signed URL for ${bucket}:`, error);
        return null;
      }
      if (data?.signedUrl) return data.signedUrl;
    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      console.error(`Exception generating signed URL for ${bucket}:`, err);
      return null;
    }
  }
  return null;
}

export function resolveSignedAvatarUrl(path) {
  if (!path) return Promise.resolve(null);
  if (path.startsWith('http') && !path.includes('/sign/avatars/')) {
    return Promise.resolve(path);
  }
  const match = path.match(/\/storage\/v1\/object\/(?:public|sign)\/avatars\/(.+?)(?:\?|$)/);
  const cleanPath = match ? match[1] : path.replace(/^avatars\//, '');
  const { getCachedSignedUrl } = require('../lib/avatarCache');
  return getCachedSignedUrl('avatars', cleanPath, () => fetchSignedUrl('avatars', cleanPath));
}

export function resolveSignedPetPhotoUrl(path) {
  if (!path) return Promise.resolve(null);
  if (path.startsWith('http') && !path.includes('/sign/pet-photos/')) {
    return Promise.resolve(path);
  }
  const match = path.match(/\/storage\/v1\/object\/(?:public|sign)\/pet-photos\/(.+?)(?:\?|$)/);
  const cleanPath = match ? match[1] : path.replace(/^pet-photos\//, '');
  const { getCachedSignedUrl } = require('../lib/avatarCache');
  return getCachedSignedUrl('pet-photos', cleanPath, () => fetchSignedUrl('pet-photos', cleanPath));
}

export default function Avatar({ photoUrl, fallbackInitial, size = 40, className = '', shape = 'full' }) {
  const initialSync = photoUrl ? getCachedSignedUrlSync('avatars', photoUrl) : null;
  const [resolvedUrl, setResolvedUrl] = useState(initialSync);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!photoUrl) {
      setResolvedUrl(null);
      return;
    }

    const sync = getCachedSignedUrlSync('avatars', photoUrl);
    if (sync) {
      setResolvedUrl(sync);
      return;
    }

    if (photoUrl.startsWith('http') && !photoUrl.includes('/sign/avatars/')) {
      setResolvedUrl(photoUrl);
      return;
    }

    resolveSignedAvatarUrl(photoUrl).then((url) => {
      if (!cancelled) setResolvedUrl(url);
    });

    return () => { cancelled = true; };
  }, [photoUrl]);

  const initial = (fallbackInitial || '?')[0]?.toUpperCase() || '?';
  const shapeClass = shape === 'square' ? 'rounded-xl' : 'rounded-full';
  const useExplicitSize = !className.includes('w-full') && !className.includes('h-full');
  const inlineStyle = useExplicitSize
    ? { width: size, height: size, fontSize: size * 0.4 }
    : { fontSize: size * 0.4 };

  if (!resolvedUrl || hasError) {
    return (
      <div
        className={`flex items-center justify-center ${shapeClass} bg-emerald-100 text-emerald-700 font-black shrink-0 select-none ${className}`}
        style={inlineStyle}
        aria-label={`Avatar de ${fallbackInitial || 'usuario'}`}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={`Avatar de ${fallbackInitial || 'usuario'}`}
      className={`${shapeClass} object-cover shrink-0 ${className}`}
      style={useExplicitSize ? { width: size, height: size } : undefined}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
    />
  );
}
