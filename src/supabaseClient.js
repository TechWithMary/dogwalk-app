import { createClient } from '@supabase/supabase-js';

// Lee las variables de entorno para conectar de forma segura con Supabase.
// Estas variables se gestionan en un archivo .env.local que no se sube a Git.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Exporta una instancia única del cliente de Supabase para usar en toda la app.
export const supabase = createClient(supabaseUrl, supabaseKey);