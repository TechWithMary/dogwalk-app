import { useState, useEffect } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { getSignedAvatarUrl, getSignedPetPhotoUrl } from '../lib/supabase';

interface Props {
  photoUrl: string | null | undefined;
  fallbackInitial: string;
  size?: number;
  style?: any;
  bucket?: 'avatars' | 'pet-photos';
}

export default function AvatarImage({ photoUrl, fallbackInitial, size = 96, style, bucket = 'avatars' }: Props) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      if (!photoUrl) {
        setResolvedUrl(null);
        return;
      }
      const url = bucket === 'pet-photos'
        ? await getSignedPetPhotoUrl(photoUrl)
        : await getSignedAvatarUrl(photoUrl);
      if (!cancelled) setResolvedUrl(url);
    };

    resolve();
    return () => { cancelled = true; };
  }, [photoUrl, bucket]);

  if (!resolvedUrl || hasError) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <Text style={[styles.initial, { fontSize: size * 0.375 }]}>{fallbackInitial[0]?.toUpperCase() || 'U'}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: resolvedUrl }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      resizeMode="cover"
      onError={(err) => {
        console.error('AvatarImage error:', err.nativeEvent);
        setHasError(true);
      }}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '900',
    color: '#13ec13',
  },
});
