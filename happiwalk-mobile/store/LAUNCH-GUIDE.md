# HappiWalk - Guía Completa de Lanzamiento a Tiendas

Esta guía divide las tareas entre **TÚ (Mary)** y el **asistente (yo)**.

---

## 🟢 LO QUE YA ESTÁ HECHO (por mí)

- [x] Fix bug calificación UUID vs bigint
- [x] Rating con local storage tracking
- [x] Auto-online/offline del paseador
- [x] Notificaciones push (cliente)
- [x] Realtime subscriptions
- [x] LIVE walk con GPS haversine
- [x] Admin pages con role check
- [x] Schema sync migration con `mercadopago_preference_id`, `is_paid`, `payment_method`
- [x] RLS policies para `booking_reviews`
- [x] Edge Function `send-push-notification`
- [x] Trigger SQL para auto-enviar push al insertar notification
- [x] Payment webhook actualizado con `is_paid: true`
- [x] Schema file actualizado con UUID

---

## 🟡 LO QUE TENÉS QUE HACER VOS (Tareas Manuales)

### PASO 1: Aplicar migrations en Supabase (15 min)

1. Andá a https://supabase.com/dashboard/project/trmleuxyneucveymqmod
2. Click **SQL Editor** → **New query**
3. Pegá y ejecutá en este orden:

**a) Sync schema (payment fields, indexes, RLS):**
```sql
-- Contenido de supabase/migrations/20260602000000_sync_actual_schema.sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS mercadopago_preference_id text,
  ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_completed_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_walker_id ON public.bookings(walker_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_rating_null ON public.bookings(status) WHERE rating IS NULL;
CREATE INDEX IF NOT EXISTS idx_locations_booking_id ON public.locations(booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_booking_reviews_booking_id ON public.booking_reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_reviews_reviewee_id ON public.booking_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_walkers_is_online ON public.walkers(is_online);
CREATE INDEX IF NOT EXISTS idx_walkers_overall_verification_status ON public.walkers(overall_verification_status);

ALTER TABLE public.booking_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reviews" ON public.booking_reviews;
CREATE POLICY "Users can view their own reviews"
  ON public.booking_reviews FOR SELECT
  USING (auth.uid() = reviewer_id OR auth.uid() = reviewee_id OR is_public = true);

DROP POLICY IF EXISTS "Users can create reviews for their bookings" ON public.booking_reviews;
CREATE POLICY "Users can create reviews for their bookings"
  ON public.booking_reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.booking_reviews;
CREATE POLICY "Users can update their own reviews"
  ON public.booking_reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);
```

**b) Push notification trigger:**
```sql
-- Contenido de supabase/migrations/20260603000000_push_notification_trigger.sql
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.send_push_notification_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  supabase_url := 'https://trmleuxyneucveymqmod.supabase.co';

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        current_setting('app.settings.service_role_key', true), ''
      )
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.body,
      'link_to', NEW.link_to
    )
  ) INTO request_id;

  RAISE LOG 'Push notification request sent, id: %', request_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_send_push ON public.notifications;
CREATE TRIGGER on_notification_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_notification_trigger();
```

### PASO 2: Configurar Supabase Auth (5 min)

1. Andá a **Authentication** → **URL Configuration**
2. Site URL: `happiwalk://`
3. Redirect URLs: agregar `happiwalk://login`, `happiwalk://payment`
4. **Authentication** → **Providers** → **Email**: activá "Confirm email" (recomendado para evitar spam)
5. **Authentication** → **Providers** → **Google**: configurá OAuth credentials (necesitás crear proyecto en Google Cloud Console)

### PASO 3: Hostear Privacy Policy (10 min)

Opción más rápida - GitHub Pages:
```bash
cd /Users/techwithmary/paseomundo
git checkout -b gh-pages
cp happiwalk-mobile/privacy-policy.html ./index.html  # renombrar para que sea la home
git add index.html
git commit -m "Deploy privacy policy"
git push origin gh-pages
```

Tu URL será: `https://TechWithMary.github.io/dogwalk-app/`

(Anotá esta URL, la necesitás para App Store Connect)

### PASO 4: Configurar Apple Developer (60 min, $99/año)

1. Crear cuenta en https://developer.apple.com ($99 USD/año)
2. Crear App ID: `com.happiwalk.app` (Capabilities: Push Notifications, Sign in with Apple, Associated Domains)
3. Crear App en App Store Connect: https://appstoreconnect.apple.com
4. Bundle ID: `com.happiwalk.app`
5. SKU: cualquier cosa única (ej: `happiwalk-2026`)
6. Anotar el **Apple ID** y **App Store Connect App ID** (lo necesitás para eas.json)

### PASO 5: Configurar Google Play Console (30 min, $25 una vez)

1. Crear cuenta en https://play.google.com/console ($25 USD una vez)
2. Crear app nueva
3. Package name: `com.happiwalk.app`
4. Crear service account:
   - Google Cloud Console → IAM & Admin → Service Accounts
   - Crear service account con rol "Firebase Admin"
   - Descargar JSON key → guardar como `happiwalk-mobile/google-services.json`
5. Anotar el **service account email**

### PASO 6: Configurar Push Notifications (45 min)

**iOS (APNs):**
1. Apple Developer → Certificates, Identifiers & Profiles
2. Keys → Create a new key con "Apple Push Notifications service (APNs)"
3. Descargar el `.p8` file
4. Anotar: Key ID, Team ID
5. En EAS: `eas credentials` → configurar APNs

**Android (FCM):**
1. https://console.firebase.google.com → Create project
2. Add Firebase to Android app (package: com.happiwalk.app)
3. Descargar `google-services.json` → ya lo hiciste en paso 5
4. En EAS: `eas credentials` → subir google-services.json

### PASO 7: Tomar Screenshots (30 min)

Necesitás un iPhone físico o Simulator con la app corriendo:
- iPhone 6.7" (1290 x 2796) - **requerido**
- iPhone 6.5" (1179 x 2556) - opcional pero recomendado
- iPhone 5.5" (1242 x 2208) - opcional

Pantallas a capturar (ver `store/SCREENSHOT-SPEC.md`):
1. Home (owner)
2. Booking flow
3. Walker profile
4. Chat
5. Profile/Settings

### PASO 8: Configurar EAS y hacer primer build (20 min)

1. Editar `happiwalk-mobile/eas.json`:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "TU_APPLE_ID@example.com",
        "ascAppId": "1234567890"  // el ID de App Store Connect
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json"
      }
    }
  }
}
```

2. Login en EAS:
```bash
cd happiwalk-mobile
npx eas login
```

3. Configurar credentials:
```bash
npx eas credentials
```

4. Build de producción:
```bash
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

### PASO 9: Submit a las tiendas (20 min)

**iOS:**
```bash
npx eas submit --platform ios
```

**Android:**
```bash
npx eas submit --platform android
```

---

## 🔵 LO QUE VOY A HACER YO (ahora)

Voy a:
1. ✅ Actualizar `remote_schema.sql` con UUID real (HECHO)
2. ✅ Crear migration con payment fields y RLS (HECHO)
3. ✅ Crear Edge Function `send-push-notification` (HECHO)
4. ✅ Crear trigger SQL para auto-push (HECHO)
5. ✅ Actualizar payment-webhook con `is_paid: true` (HECHO)
6. ⏳ Hacer commit y push de todo
7. ⏳ Verificar que no haya otros `Number(bookingId)` en el código
8. ⏳ Refactor: usar `isUuid` helper en un solo lugar
9. ⏳ Documentar todo

---

## 📋 CHECKLIST RÁPIDO

```
[ ] PASO 1: Aplicar migrations en Supabase
[ ] PASO 2: Configurar Supabase Auth
[ ] PASO 3: Hostear privacy policy
[ ] PASO 4: Apple Developer + App Store Connect
[ ] PASO 5: Google Play Console + google-services.json
[ ] PASO 6: APNs + FCM
[ ] PASO 7: Tomar screenshots
[ ] PASO 8: Configurar eas.json + build
[ ] PASO 9: Submit

[ ] Verificar calificación con UUID funciona
[ ] Verificar admin pages solo para admins
[ ] Verificar push notifications llegan
```

---

## 💰 Costos totales

- Apple Developer: **$99 USD/año**
- Google Play Console: **$25 USD una vez**
- EAS: **Gratis** para plan Free (suficiente para empezar)
- Supabase: **Gratis** hasta 500MB DB + 2GB bandwidth (suficiente para ~1000 users)
- Expo Push: **Gratis** hasta 1000 notificaciones/mes (después, ver pricing)

**Total: ~$124 USD para arrancar**

---

## 🆘 Si algo falla

1. **Calificación no se guarda** → revisá los logs `[Rating]` en la consola
2. **Push notifications no llegan** → verificá que APNs/FCM estén configurados correctamente
3. **App rejected por Apple** → típico: falta privacy policy URL, falta Sign in with Apple, faltan screenshots
4. **App rejected por Google** → típico: falta content rating, target API level muy bajo
5. **Build falla** → corré `npx eas build --platform ios --profile production --clear-cache`

---

## 🎯 Próximo paso INMEDIATO

**Vos:** Aplicar las 2 migrations en Supabase (PASO 1)
**Yo:** Commit + push de todo el código nuevo

Después seguimos con el PASO 2.
