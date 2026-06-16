# Draft: Environment Variables Fix - VITE_ to EXPO_PUBLIC_

## Problem
- Variables in `.env.local` use `VITE_` prefix
- Expo expects `EXPO_PUBLIC_` prefix for all env vars
- This causes API keys and config to not be loaded

## Variables to Change

### Current → New
| Current | New |
|---------|-----|
| `VITE_GOOGLE_MAPS_API_KEY` | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` |
| `VITE_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| `VITE_MERCADOPAGO_PUBLIC_KEY` | `EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY` |

### New Variables to Add
- `EXPO_PUBLIC_MERCADOPAGO_ACCESS_TOKEN` = `APP_USR-4790528051316951-011911-0e76753a82e34c2bcf4fef1215739615-3139617865`
- (Mercado Pago access token is separate from public key)

## Tasks
1. Update .env.local with EXPO_PUBLIC_ prefix
2. Verify lib/config.ts reads correctly
3. Test the app to confirm APIs load

## Status
- User approved: YES
- Plan to be created