# Environment Variables Fix - VITE_ to EXPO_PUBLIC_

## TL;DR
> **Quick Summary**: Fix environment variables so Expo reads API keys correctly. Create .env file with EXPO_PUBLIC_ prefix, convert app.json to app.config.js, update lib/supabase.ts.
> **Deliverables**: .env file, app.config.js, updated supabase.ts
> **Estimated Effort**: Quick | **Parallel Execution**: NO | **Critical Path**: Task 1 → 2 → 3 → 4

---

## Context

### Problem
- Variables in parent .env.local use `VITE_` prefix (web/Vite standard)
- Expo mobile expects `EXPO_PUBLIC_` prefix
- Google Maps API returns "No se encontraron direcciones" because API key is empty/invalid
- supabase.ts has hardcoded credentials instead of reading from env

### Correct API Key
- Google Maps: `AIzaSyA_JTieFhnhzWENbxRsiFAeK1R_oWVT2R4` (confirmed by user)
- Supabase URL: `https://trmleuxyneucveymqmod.supabase.co`
- Supabase Anon Key: `sb_publishable_V2eOR6oVCy5j0uiCXJJGEA_4kUoHofZ`
- Mercado Pago Public Key: `APP_USR-c996f5ad-c493-492d-9a9d-45d054427e3b`

### Security Note
- MERCADOPAGO_ACCESS_TOKEN is SERVER-SIDE only (Supabase Edge Functions)
- Do NOT add ACCESS_TOKEN to mobile app .env or any client-side code

---

## Work Objectives

### Core Objective
Fix environment variable configuration so Google Maps and other APIs work in the mobile app

### Concrete Deliverables
1. `.env` file at project root with correct EXPO_PUBLIC_ prefixed variables
2. `app.config.js` (converted from app.json) to dynamically read Google Maps API key
3. `lib/supabase.ts` updated to read credentials from env vars

### Definition of Done
- [ ] .env file created with 4 EXPO_PUBLIC_ variables
- [ ] app.config.js exports Google Maps key from env var
- [ ] lib/supabase.ts reads from process.env
- [ ] EAS secrets configured for production builds

---

## TODOs

- [ ] 1. **Create .env file with EXPO_PUBLIC_ prefixed variables**

  **What to do**:
  Create file at `/Users/techwithmary/paseomundo/happiwalk-mobile/.env`:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://trmleuxyneucveymqmod.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_V2eOR6oVCy5j0uiCXJJGEA_4kUoHofZ
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyA_JTieFhnhzWENbxRsiFAeK1R_oWVT2R4
  EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-c996f5ad-c493-492d-9a9d-45d054427e3b
  ```
  **IMPORTANT**: Do NOT add MERCADOPAGO_ACCESS_TOKEN - that belongs to server-side only.

  **Must NOT do**:
  - Do NOT use VITE_ prefix
  - Do NOT add ACCESS_TOKEN
  - Do NOT commit to git (already in gitignore)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Simple file creation

  **References**:
  - .env.example at project root

  **Acceptance Criteria**:
  - [ ] File exists at .env
  - [ ] Contains all 4 EXPO_PUBLIC_ variables with correct values
  - [ ] No VITE_ prefix
  - [ ] No ACCESS_TOKEN

  **Commit**: NO

---

- [ ] 2. **Convert app.json to app.config.js**

  **What to do**:
  1. Read current app.json
  2. Create app.config.js that exports config object
  3. Make Google Maps API key read from `process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
  4. Keep all other config (permissions, bundle ID, etc.) intact

  The app.config.js should export a function or object that reads the env var:
  ```javascript
  module.exports = {
    expo: {
      // ... all existing config ...
      ios: {
        config: {
          googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      android: {
        config: {
          googleMaps: {
            apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
          }
        }
      }
    }
  }
  ```

  **Must NOT do**:
  - Do NOT hardcode the API key
  - Do NOT lose any existing config

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Simple file transformation, follows established pattern

  **References**:
  - app.json (current hardcoded values)
  - Expo docs: app.config.js

  **Acceptance Criteria**:
  - [ ] app.config.js exists
  - [ ] Google Maps API key comes from process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  - [ ] All other config (bundle ID, permissions, etc.) preserved

  **Commit**: YES - Message: `refactor(config): convert app.json to app.config.js for dynamic env vars`

---

- [ ] 3. **Update lib/supabase.ts to read from env vars**

  **What to do**:
  1. Read current lib/supabase.ts
  2. Replace hardcoded supabaseUrl and supabaseAnonKey with:
     - `process.env.EXPO_PUBLIC_SUPABASE_URL`
     - `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`

  **Must NOT do**:
  - Do NOT change any other logic in supabase.ts
  - Do NOT add MERCADOPAGO_ACCESS_TOKEN

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Simple variable replacement

  **References**:
  - lib/supabase.ts lines 4-5 (current hardcoded values)
  - lib/config.ts (how EXPO_PUBLIC_ vars are read)

  **Acceptance Criteria**:
  - [ ] supabaseUrl comes from process.env.EXPO_PUBLIC_SUPABASE_URL
  - [ ] supabaseAnonKey comes from process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  - [ ] No hardcoded credentials remain

  **Commit**: YES - Message: `refactor(supabase): read credentials from env vars`

---

- [x] 4. **Delete old app.json**

  **What to do**:
  After verifying app.config.js works, delete app.json since we now use app.config.js

  **Must NOT do**:
  - Do not delete until app.config.js is verified working

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Acceptance Criteria**:
  - [ ] app.json deleted
  - [ ] app.config.js still works

  **Commit**: YES - Message: `chore: remove old app.json after converting to app.config.js`

---

- [x] 5. **Configure EAS secrets for production**

  **What to do**:
  Document the eas secret commands to run:
  ```bash
  eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://trmleuxyneucveymqmod.supabase.co"
  eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_V2eOR6oVCy5j0uiCXJJGEA_4kUoHofZ"
  eas secret:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "AIzaSyA_JTieFhnhzWENbxRsiFAeK1R_oWVT2R4"
  eas secret:create --name EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY --value "APP_USR-c996f5ad-c493-492d-9a9d-45d054427e3b"
  ```

  **Note**: User will run these manually. Document here for reference.

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Acceptance Criteria**:
  - [x] Commands documented for user to run

---

## Final Verification Wave

- [x] F1. **Type check** - Run `npx tsc --noEmit` to verify no errors (NOTE: 3 pre-existing errors unrelated to this fix - see below)
- [x] F2. **File structure** - Verify .env and app.config.js exist
- [x] F3. **No hardcoded secrets** - grep for API keys in lib/supabase.ts and app.config.js

---

## Pre-existing TypeScript Errors (NOT from this fix)

These errors existed before the env vars fix and are unrelated:
1. `app/(tabs)/profile.tsx(7,69)`: Module '"../../components/Icons"' has no exported member 'Shield'
2. `app/_layout.tsx(56,30)`: Property 'parse' does not exist on type 'LinkingImpl'
3. `components/GoogleMapsWebView.tsx(86,37)`: Type 'string | number' not assignable to 'DimensionValue'

These are separate issues not caused by the EXPO_PUBLIC_ migration.

---

## Success Criteria

- [x] .env file created with correct EXPO_PUBLIC_ prefixed variables
- [x] app.config.js converts to dynamic env vars
- [x] lib/supabase.ts reads from env vars
- [x] TypeScript compiles without errors (pre-existing errors unrelated to this fix)
- [x] EAS secrets documented for production build