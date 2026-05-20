import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const getSignedAvatarUrl = async (path: string | null): Promise<string | null> => {
  if (!path) return null;

  let cleanPath = path;

  if (path.startsWith('http')) {
    const match = path.match(/\/storage\/v1\/object\/(?:public|sign)\/avatars\/(.+)$/);
    if (match) {
      cleanPath = match[1].split('?')[0];
    } else {
      return path;
    }
  }

  cleanPath = cleanPath.replace(/^avatars\//, '');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase
        .storage
        .from('avatars')
        .createSignedUrl(cleanPath, 3600);

      if (error) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        console.error('Error generating signed URL:', error);
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
      console.error('Exception generating signed URL:', err);
      return null;
    }
  }

  return null;
};

export const getAvatarUploadPath = (userId: string, fileExt: string): string => {
  return `${userId}-${Date.now()}.${fileExt}`;
};

export const getSignedPetPhotoUrl = async (path: string | null): Promise<string | null> => {
  if (!path) return null;

  let cleanPath = path;

  if (path.startsWith('http')) {
    const match = path.match(/\/storage\/v1\/object\/(?:public|sign)\/pet-photos\/(.+)$/);
    if (match) {
      cleanPath = match[1].split('?')[0];
    } else {
      return path;
    }
  }

  cleanPath = cleanPath.replace(/^pet-photos\//, '');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase
        .storage
        .from('pet-photos')
        .createSignedUrl(cleanPath, 3600);

      if (error) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        console.error('Error generating signed URL for pet photo:', error);
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
      console.error('Exception generating signed URL for pet photo:', err);
      return null;
    }
  }

  return null;
};