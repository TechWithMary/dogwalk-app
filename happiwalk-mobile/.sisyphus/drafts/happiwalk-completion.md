# Draft: HappiWalk Mobile Completion Plan

## User's Goal (Verbatim)
"necesito que me has un plan detallado, para terminar la app mobile de paseo mundo, debe ser igual a la app web, con su misma logica y estructura, ya hay varias cosas que estan listas, pero le falta, debe quedar bien con sus integraciones y todo lo que ya esta en la app web tal cual, en la app mobile hay algunas cosas que no estan en la app web como la configuracion, eso necesito que funcione bien, para ver si lo implemento en la web, tambien necesito varias recomendaciones, para ver como esta esta app mobile y la app web, la web ya la tengo desplegada, entonces por ahora lo mas prioritario es la app mobile que funcione bien, para poder desplegarla en las tiendas de app store y play store, se muy profesional, con cada detalle y diseño"

## Requirements (confirmed)
- Mobile app must match web app exactly (features, logic, styles, structure)
- Mobile settings screen needs to work properly (unique to mobile, may be ported to web later)
- Priority: Get mobile app working well enough for App Store/Play Store submission
- Professional with every detail and design
- Supabase SQL schema provided for full data model understanding

## Technical Decisions
- Priority: Core flows first + professional quality (my professional recommendation)
- Payment: MercadoPago only for launch
- AI Agents: NOT included in launch plan (future consideration)

## Scope Boundaries
- INCLUDE: All web app features ported to mobile, app store readiness, professional polish
- EXCLUDE: AI agents, new features not in web app, offline-first architecture (nice to have but not blocking)

---

## Web App Business Logic (from exploration)

### Booking Flow
- Statuses: pending → confirmed → accepted → pickup_requested → picked_up → in_progress → completed | cancelled
- Pricing: 1h=$30k, 2h=$55k, 3h=$75k COP + $10k per additional pet
- Payment: Wallet balance or MercadoPago

### Walker Verification
- 7-step onboarding: Personal Data → Documents → Experience → Payment → Service Area → Availability → Complete
- Required docs: ID front/back, selfie with ID, criminal record cert
- Admin approves/rejects at /admin/verifications

### Payment Flow
- Platform commission: 20%, Gateway fee: 4%, Walker gets 76%
- Owner: Wallet top-up min $5k via MercadoPago
- Walker: Min $50k withdrawal request → admin approves/rejects

### Chat System
- Real-time via Supabase subscriptions
- Only text messages (no images/files in web)
- Read receipts NOT implemented in web
- Online status is hardcoded "En línea" in web

### Rating System
- Owner → Walker only (not bidirectional)
- 1-5 stars required + optional comment

### Live GPS Tracking
- Walker sends location every 10 seconds
- Owner sees real-time marker on map
- Status transitions controlled by walker

### Notifications
- In-app only in web (no push visible)
- Triggered on booking events, status changes, payouts

### Role Differences
- Owner: Home, Booking, Wallet, Pets, Live Walk, Notifications, Messages
- Walker: Dashboard, Balance, Accept walks, Start/finish GPS
- Admin: Verifications, Payouts

---

## Mobile App Gap Analysis (from exploration)

### COMPLETE / MOSTLY COMPLETE
- ✅ Auth flow (login, signup, OAuth, onboarding)
- ✅ Owner screens (home, booking, booking history, pets, profile, notifications)
- ✅ Walker screens (home, balance, settings, availability, service area)
- ✅ Booking lifecycle (all status transitions)
- ✅ Chat/messaging (conversation list, real-time, text messages)
- ✅ Navigation/routing (tabs, stack, deep linking)
- ✅ Live walk GPS tracking

### PARTIAL (needs work)
- ⚠️ Payment: Wallet top-up works, MercadoPago integration exists, BUT payout processing incomplete, card management empty, transaction history no pagination
- ⚠️ Push notifications: Token registration works, BUT message notifications missing, preferences not saved to DB
- ⚠️ Booking cancellation: Cancel button exists but refund flow missing, walker can't cancel
- ⚠️ Deployment: App configured but no env vars system, production entitlements missing

### MINIMAL / MISSING
- ❌ Offline support: No caching, no network detection, no retry logic
- ❌ Error handling: No global error boundary, no network error UI, no retry logic
- ❌ Password reset: No forgot password flow
- ❌ Terms/Privacy: Routes exist but screens are empty shells
- ❌ Admin panel: admin/ folder is empty
- ❌ Manage cards: Empty screen
- ❌ Transaction history pagination

---

## Research Findings
- Web app is deployed and functional
- Mobile app has ~70-75% feature parity with web
- Key gaps: admin panel, error handling, offline support, payment processing, some missing screens
- Walker onboarding recently restyled to dark theme matching web
- Colors unified: #13ec13 primary, #052e05 dark green, #111827 dark bg

## Open Questions
- AI Agents: User didn't answer - excluding from launch plan
- Timeline: User didn't answer - will recommend 3-4 weeks professional pace
- Offline support level: Basic network detection or full offline-first?

## Scope Boundaries
- INCLUDE: All web features in mobile, settings screen working, App Store readiness, professional polish
- EXCLUDE: AI Agents (future), new features not in web, full offline-first architecture