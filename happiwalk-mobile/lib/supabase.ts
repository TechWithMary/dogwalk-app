import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://trmleuxyneucveymqmod.supabase.co';
const supabaseAnonKey = 'sb_publishable_V2eOR6oVCy5j0uiCXJJGEA_4kUoHofZ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const STORAGE_URL = 'https://trmleuxyneucveymqmod.supabase.co/storage/v1/object/public/';
