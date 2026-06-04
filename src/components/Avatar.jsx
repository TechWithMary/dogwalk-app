import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Avatar({ photoUrl, fallbackInitial, size = 40, className = '', shape = 'full' }) {
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      if (!photoUrl) {
        setResolvedUrl(null);
        return;
      }

      if (photoUrl.startsWith('http')) {
        setResolvedUrl(photoUrl);
        return;
      }

      const cleanPath = photoUrl.replace(/^avatars\//, '');

      try {
        const { data, error } = await supabase.storage
          .from('avatars')
          .createSignedUrl(cleanPath, 3600);

        if (cancelled) return;
        if (error) {
          console.error('Avatar signed URL error:', error);
          setResolvedUrl(null);
          return;
        }
        setResolvedUrl(data?.signedUrl || null);
      } catch (err) {
        if (cancelled) return;
        console.error('Avatar exception:', err);
        setResolvedUrl(null);
      }
    };

    resolve();
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
      onError={() => setHasError(true)}
    />
  );
}
