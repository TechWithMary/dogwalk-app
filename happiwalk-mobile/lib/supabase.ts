import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedSignedUrl } from './avatarCache';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const STORAGE_URL = 'https://trmleuxyneucveymqmod.supabase.co/storage/v1/object/public/';

async function fetchSignedUrl(bucket: 'avatars' | 'pet-photos', cleanPath: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase
        .storage
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

      if (data?.signedUrl) {
        return data.signedUrl;
      }
    } catch (err: any) {
      if (attempt < 2 && (err?.statusCode === 502 || err?.message?.includes('502'))) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      console.error(`Exception generating signed URL for ${bucket}:`, err);
      return null;
    }
  }
  return null;
}

export const getSignedAvatarUrl = (path: string | null): Promise<string | null> => {
  if (!path) return Promise.resolve(null);
  let cleanPath = path;
  if (path.startsWith('http')) {
    const match = path.match(/\/storage\/v1\/object\/(?:public|sign)\/avatars\/(.+)$/);
    if (match) {
      cleanPath = match[1].split('?')[0];
    } else {
      return Promise.resolve(path);
    }
  }
  return getCachedSignedUrl('avatars', cleanPath, () => fetchSignedUrl('avatars', cleanPath));
};

export const getAvatarUploadPath = (userId: string, fileExt: string): string => {
  return `${userId}-${Date.now()}.${fileExt}`;
};

export const getSignedPetPhotoUrl = (path: string | null): Promise<string | null> => {
  if (!path) return Promise.resolve(null);
  let cleanPath = path;
  if (path.startsWith('http')) {
    const match = path.match(/\/storage\/v1\/object\/(?:public|sign)\/pet-photos\/(.+)$/);
    if (match) {
      cleanPath = match[1].split('?')[0];
    } else {
      return Promise.resolve(path);
    }
  }
  return getCachedSignedUrl('pet-photos', cleanPath, () => fetchSignedUrl('pet-photos', cleanPath));
};