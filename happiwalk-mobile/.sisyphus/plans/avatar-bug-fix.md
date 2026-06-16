# HappiWalk Mobile - Avatar Bug Fix Plan

## TL;DR

> **Quick Summary**: Arreglar el bug de "avatars/avatars/" haciendo que el mobile app siga el mismo patrón que el web app para uploads de avatares.
> 
> **Deliverables**:
> - Upload de avatares con prefijo `avatars/` en el path (como web)
> - Almacenar URL pública completa en `profile_photo_url` (como web)
> - Display con URL pública directa (como web)
> - Cleanup de datos existentes en Supabase
> 
> **Estimated Effort**: Quick (1-2 horas)
> **Parallel Execution**: NO - tasks son secuenciales
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

---

## Context

### Problema Actual
Error 400 al cargar imágenes de avatar:
```
https://trmleuxyneucveymqmod.supabase.co/storage/v1/object/public/avatars/avatars/4687f52e-...jpg
```

La URL tiene el prefijo `avatars/` duplicado.

### Causa Raíz
- **Web app** sube a `avatars/filename.jpg` y almacena URL pública completa
- **Mobile app** sube a `filename.jpg` (sin prefijo) y almacena solo el filename
- El código de `getSignedAvatarUrl` asume que el path viene sin prefijo
- Cuando se mezclan datos (web escribe URL completa, mobile lee y re-escribe), se rompe

### Metis Review
**Identified Gaps:**
- No había manejo de URLs ya firmadas o URLs completas de OAuth (Google/Facebook)
- No había consistencia entre upload y display
- Datos existentes en DB pueden tener formatos mixtos

---

## Work Objectives

### Core Objective
Sincronizar el patrón de avatares entre web y mobile para evitar inconsistencias.

### Concrete Deliverables
1. `lib/supabase.ts` - Función `getAvatarUploadPath` corregida
2. `app/(tabs)/profile.tsx` - Upload actualizado
3. `app/edit-profile.tsx` - Upload actualizado
4. `lib/supabase.ts` - Función `getPublicAvatarUrl` nueva (como web)
5. `components/AvatarImage.tsx` - Display simplificado
6. Datos en Supabase limpiados

### Definition of Done
- [ ] Avatar upload guarda `avatars/filename.jpg` en storage
- [ ] `profile_photo_url` almacena URL pública completa
- [ ] Avatar se muestra correctamente sin errores 400
- [ ] No más "avatars/avatars/" en URLs

### Must Have
- El pattern de upload debe coincidir con web app
- Datos existentes en Supabase deben ser migrados o limpiados

### Must NOT Have
- No romper uploads existentes de otras partes de la app (pets, documents)
- No cambiar el formato de otras tablas (solo `user_profiles.profile_photo_url`)

---

## Verification Strategy

### QA Policy
Every task includes agent-executed QA scenarios.

**QA Scenarios:**

```
Scenario: Avatar upload + display (happy path)
  Tool: Bash
  Preconditions: Usuario logueado, imagen válida
  Steps:
    1. Navegar a profile tab
    2. Tocar avatar para cambiar foto
    3. Seleccionar imagen de galería
    4. Subir imagen
    5. Verificar que la imagen aparece en el profile
  Expected Result: Imagen visible sin errores 400
  Evidence: .sisyphus/evidence/avatar-upload-display.png

Scenario: Avatar fallido - archivo corrupto
  Tool: Bash
  Preconditions: Usuario logueado, archivo corrupto
  Steps:
    1. Navegar a profile tab
    2. Tocar avatar para cambiar foto
    3. Seleccionar archivo corrupto/inválido
    4. Intentar subir
  Expected Result: Error manejado graceful, mensaje al usuario
  Evidence: .sisyphus/evidence/avatar-upload-error.png
```

---

## Execution Strategy

```
Wave 1 (Foundation - shared utilities):
├── Task 1: Add path prefix to getAvatarUploadPath → `avatars/${userId}-${timestamp}.ext`
└── Task 2: Create getPublicAvatarUrl function (mirrors web app pattern)

Wave 2 (Upload fixes):
├── Task 3: Update profile.tsx upload to use new path format + store full URL
└── Task 4: Update edit-profile.tsx upload to use new path format + store full URL

Wave 3 (Display simplification):
├── Task 5: Simplify AvatarImage.tsx to use public URL directly (like web)
└── Task 6: Add logging for debugging avatar issues

Wave 4 (Cleanup):
├── Task 7: SQL to migrate/fix existing profile_photo_url values in Supabase
└── Task 8: Verify all avatars load correctly
```

---

## TODOs

- [ ] 1. **Fix getAvatarUploadPath** - Add `avatars/` prefix

  **What to do**:
  - Modify `lib/supabase.ts` line 59-61
  - Change: `return `${userId}-${Date.now()}.${fileExt}``
  - To: `return `avatars/${userId}-${Date.now()}.${fileExt}``
  - This makes upload path match web app pattern

  **Must NOT do**:
  - Don't change pet-photos or document upload paths

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Simple string modification, no logic change

  **References**:
  - `lib/supabase.ts:59-61` - Current implementation
  - Web app: `Profile.jsx` line 92 - uses `avatars/${fileName}` pattern

  **Acceptance Criteria**:
  - [ ] `getAvatarUploadPath('user123', 'jpg')` returns `'avatars/user123-timestamp.jpg'`

  **QA Scenarios:**

  ```
  Scenario: getAvatarUploadPath returns correct format
    Tool: Bash (node REPL)
    Preconditions: None
    Steps:
      1. Import getAvatarUploadPath from lib/supabase
      2. Call getAvatarUploadPath('abc123', 'png')
      3. Assert result starts with 'avatars/' and ends with '.png'
    Expected Result: 'avatars/abc123-<timestamp>.png'
    Evidence: .sisyphus/evidence/task-1-path-format.js
  ```

- [ ] 2. **Create getPublicAvatarUrl function**

  **What to do**:
  - Add to `lib/supabase.ts`
  - Mirrors web app pattern: `supabase.storage.from('avatars').getPublicUrl(path)`
  - Returns full public URL like web app stores

  ```typescript
  export const getPublicAvatarUrl = (path: string | null): string | null => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };
  ```

  **References**:
  - Web app: `Profile.jsx` lines 100-102

  **Acceptance Criteria**:
  - [ ] `getPublicAvatarUrl('avatars/user123.jpg')` returns full public URL

  **QA Scenarios:**

  ```
  Scenario: getPublicAvatarUrl returns full URL
    Tool: Bash
    Preconditions: Valid path
    Steps:
      1. Call getPublicAvatarUrl('avatars/test.jpg')
      2. Verify returns URL containing storage.supabase.co + avatars/test.jpg
    Expected Result: URL matches expected format
    Evidence: .sisyphus/evidence/task-2-public-url.js
  ```

- [ ] 3. **Update profile.tsx upload**

  **What to do**:
  - In `app/(tabs)/profile.tsx`
  - After upload success, get public URL and store that in DB
  - Use `getPublicAvatarUrl(fileName)` instead of just `fileName`

  **References**:
  - `app/(tabs)/profile.tsx:175-220` - Current upload logic
  - Web app: `Profile.jsx` lines 100-106 - stores publicUrl

  **Acceptance Criteria**:
  - [ ] After upload, `profile_photo_url` contains full public URL
  - [ ] Same as web app behavior

  **QA Scenarios:**

  ```
  Scenario: profile.tsx stores full URL after upload
    Tool: Read (verify code change)
    Preconditions: Upload code modified
    Steps:
      1. Grep for 'getPublicAvatarUrl' in profile.tsx
      2. Verify it's called after successful upload
    Expected Result: Code exists
    Evidence: .sisyphus/evidence/task-3-profile-upload.js
  ```

- [ ] 4. **Update edit-profile.tsx upload**

  **What to do**:
  - Same changes as Task 3 for `app/edit-profile.tsx`
  - Get public URL after upload, store that

  **References**:
  - `app/edit-profile.tsx:234-278` - Current upload logic

  **Acceptance Criteria**:
  - [ ] After upload, `profile_photo_url` contains full public URL

- [ ] 5. **Simplify AvatarImage.tsx display**

  **What to do**:
  - In `components/AvatarImage.tsx`
  - Change from signed URL to public URL (like web app)
  - Remove `getSignedAvatarUrl` call, use `getPublicAvatarUrl` instead
  - This simplifies the flow and matches web app

  ```typescript
  // Instead of getSignedAvatarUrl, use getPublicAvatarUrl
  const resolvedUrl = getPublicAvatarUrl(photoUrl);
  ```

  **References**:
  - `components/AvatarImage.tsx:20-33` - Current useEffect
  - Web app: `Profile.jsx` line 148 - direct URL

  **Acceptance Criteria**:
  - [ ] Avatar displays correctly using public URL
  - [ ] No more 400 errors from malformed URLs

  **QA Scenarios:**

  ```
  Scenario: AvatarImage displays public URL correctly
    Tool: Playwright (simulate profile view)
    Preconditions: User has avatar uploaded
    Steps:
      1. Open app and login
      2. Navigate to profile tab
      3. Verify avatar image loads
      4. Check for any console errors about avatar
    Expected Result: Image visible, no 400 errors
    Evidence: .sisyphus/evidence/task-5-avatar-display.png
  ```

- [ ] 6. **Add logging for avatar debugging**

  **What to do**:
  - Add console.log in AvatarImage.tsx to log the path being resolved
  - This helps debug future issues

  ```typescript
  console.log('[AvatarImage] Resolving:', { photoUrl, resolvedUrl });
  ```

  **References**:
  - `components/AvatarImage.tsx:18-33`

  **Acceptance Criteria**:
  - [ ] Logs appear in development when avatar fails to load

- [ ] 7. **Cleanup existing Supabase data**

  **What to do**:
  - Run SQL or create a migration script to fix existing data
  - Problem: Some `profile_photo_url` have full URLs, some have just filenames, some have `avatars/` prefix
  - Need to normalize all to full public URLs

  **SQL to run in Supabase SQL Editor:**

  ```sql
  -- First, see what formats exist
  SELECT profile_photo_url, COUNT(*) 
  FROM user_profiles 
  WHERE profile_photo_url IS NOT NULL 
  GROUP BY profile_photo_url;

  -- Fix entries that are just filenames (no http, no avatars/ prefix)
  -- These need avatars/ prefix added and getPublicUrl called
  UPDATE user_profiles 
  SET profile_photo_url = (
    SELECT data->>'publicUrl' 
    FROM supabase.storage.buckets 
    WHERE name = 'avatars'
  ) || '/avatars/' || profile_photo_url
  WHERE profile_photo_url IS NOT NULL 
  AND profile_photo_url NOT LIKE 'http%' 
  AND profile_photo_url NOT LIKE 'avatars/%';

  -- Fix entries that have double prefix
  UPDATE user_profiles 
  SET profile_photo_url = REPLACE(profile_photo_url, 'avatars/avatars/', 'avatars/')
  WHERE profile_photo_url LIKE 'avatars/avatars/%';
  ```

  **References**:
  - Web app uploads to `avatars/filename.jpg`
  - Mobile uploads to `filename.jpg` (before fix)

  **Acceptance Criteria**:
  - [ ] All profile_photo_url values are valid full public URLs
  - [ ] No entries with `avatars/avatars/` pattern exist

  **QA Scenarios:**

  ```
  Scenario: Check existing data for issues
    Tool: Bash (curl to Supabase)
    Preconditions: None
    Steps:
      1. Query user_profiles for profile_photo_url
      2. Check for patterns: 'http://', 'avatars/', 'avatars/avatars/'
      3. Count rows per pattern
    Expected Result: All rows either NULL or valid http://... URL
    Evidence: .sisyphus/evidence/task-7-data-check.json
  ```

- [ ] 8. **Verify all avatars load correctly**

  **What to do**:
  - After all changes, do a final verification
  - Check that existing users can see their avatars
  - Check that new uploads work correctly

  **Acceptance Criteria**:
  - [ ] Test with existing user who has avatar URL
  - [ ] Test with user who has no avatar
  - [ ] Test upload new avatar and verify display

  **QA Scenarios:**

  ```
  Scenario: Existing user sees their avatar
    Tool: Playwright
    Preconditions: User with existing avatar_url in DB
    Steps:
      1. Login with user that has existing avatar
      2. Navigate to profile
      3. Verify avatar image is visible
      4. No console errors about 400 or network
    Expected Result: Avatar loads correctly
    Evidence: .sisyphus/evidence/task-8-existing-user.png

  Scenario: New avatar upload and display
    Tool: Playwright
    Preconditions: User without avatar
    Steps:
      1. Login
      2. Go to profile
      3. Tap to change avatar
      4. Upload new image
      5. Verify it displays immediately
    Expected Result: New avatar visible
    Evidence: .sisyphus/evidence/task-8-new-upload.png
  ```

---

## Final Verification Wave

- [ ] F1. **Verify consistency with web app** - `oracle`
  Compare mobile upload pattern with web app upload pattern to ensure they match exactly.
  Output: `Pattern MATCH / MISMATCH | Files verified`

- [ ] F2. **Code quality check** - `unspecified-high`
  Run tsc, verify no type errors, no console.log in production.
  Output: `Build PASS/FAIL | Type check PASS/FAIL`

- [ ] F3. **Manual QA - avatar flow** - `unspecified-high`
  Test complete avatar flow: upload, save to DB, display in profile, display in other screens.
  Output: `Flow PASS/FAIL | Screens verified`

---

## Commit Strategy

- **1**: `fix(avatar): normalize upload path and storage to match web app pattern`

---

## Success Criteria

### Verification Commands
```bash
# Check upload path format
node -e "const {getAvatarUploadPath} = require('./lib/supabase'); console.log(getAvatarUploadPath('test', 'jpg'));"
# Expected: avatars/test-<timestamp>.jpg

# Check public URL generation
node -e "const {getPublicAvatarUrl} = require('./lib/supabase'); console.log(getPublicAvatarUrl('avatars/test.jpg'));"
# Expected: https://trmleuxyneucveymqmod.supabase.co/storage/v1/object/public/avatars/test.jpg
```

### Final Checklist
- [ ] All avatars upload with `avatars/` prefix in storage path
- [ ] All `profile_photo_url` stored as full public URLs
- [ ] AvatarImage displays correctly using public URL
- [ ] No more "avatars/avatars/" URLs
- [ ] Web and mobile use consistent patterns