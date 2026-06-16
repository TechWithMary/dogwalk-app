# HappiWalk Mobile App - Completion Plan

## Objective
Achieve **exact feature parity** between HappiWalk mobile app and Paseo Mundo web app. The mobile app must be production-ready for App Store and Play Store submission with professional quality, matching all web app logic, APIs, styles, and user flows.

## Current State
- **Mobile app completion**: ~70-75% relative to web app
- **Already done**: Auth, onboarding (owner+walker), owner home, booking, live walk tracking, chat, notifications, walker home, walker settings, wallet, top-up, booking history, rating, pets management, profile editing, color unification (#13ec13, #052e05), dark theme onboarding
- **Tech stack**: Expo SDK 54, React Native 0.81.5, expo-router, Supabase (auth, db, storage, realtime, edge functions)

## Key References
- **Web app source**: `/Users/techwithmary/paseomundo/src/`
- **Mobile app source**: `/Users/techwithmary/paseomundo/happiwalk-mobile/`
- **Supabase schema**: Provided in user's initial message (13 tables)

---

## PHASE 1: Critical Missing Screens & Features
These are screens/features that exist in the web app but are missing or empty in the mobile app. Blocking for App Store submission.

### 1.1 Password Reset Flow
**Web reference**: Login page has "Forgot password" link
**Mobile status**: MISSING - No password reset functionality
**Files to create/modify**:
- Create `app/(auth)/forgot-password.tsx` - Email input, send reset link via `supabase.auth.resetPasswordForEmail()`
- Modify `app/(auth)/login.tsx` - Add "Forgot password?" link pointing to new screen
**Acceptance Criteria**:
- [x] User can tap "Forgot password?" on login screen
- [x] Enter email → receives Supabase reset email
- [x] After reset, can login with new password
- [x] Error handling for invalid emails, network errors

### 1.2 Admin Panel - Walker Verifications
**Web reference**: `/src/pages/AdminVerifications.jsx` - 289 lines
**Mobile status**: `app/admin/` folder is EMPTY
**Files to create**:
- Create `app/admin/verifications.tsx` - List pending walkers, preview documents (signed URLs), approve/reject
- Use `SecureDocumentViewer` component (already exists in mobile)
**Acceptance Criteria**:
- [x] Admin sees list of pending walker applications
- [x] Can preview ID front/back, selfie, criminal record via signed URLs
- [x] Approve → `overall_verification_status = 'approved'`
- [x] Reject → `overall_verification_status = 'rejected'` with reason
- [x] Matches web functionality exactly

### 1.3 Admin Panel - Payout Processing
**Web reference**: `/src/pages/AdminPayouts.jsx` - 171 lines
**Mobile status**: EMPTY
**Files to create**:
- Create `app/admin/payouts.tsx` - List withdrawal requests by status (pending/completed/rejected), process approvals
**Acceptance Criteria**:
- [x] Admin sees pending withdrawal requests
- [x] Can approve → deducts from walker balance, status `completed`
- [x] Can reject → status `rejected`, balance unchanged
- [x] Transaction history updated on approval

### 1.4 Terms & Conditions Content
**Web reference**: `/src/pages/Terms.jsx`
**Mobile status**: Route exists but screen is EMPTY SHELL
**Files to modify**:
- `app/terms.tsx` - Add actual terms content (can use same content as web or placeholder legal text)
**Acceptance Criteria**:
- [x] Screen displays actual terms and conditions text
- [x] Scrollable, readable, professional layout
- [x] Accessible from onboarding and profile

### 1.5 Privacy Policy Content
**Web reference**: `/src/pages/Privacy.jsx`
**Mobile status**: Route exists but screen is EMPTY SHELL
**Files to modify**:
- `app/privacy.tsx` - Add actual privacy policy content
**Acceptance Criteria**:
- [x] Screen displays actual privacy policy text
- [x] Scrollable, readable, professional layout
- [x] Accessible from onboarding and profile

### 1.6 Booking Cancellation with Refund Logic
**Web reference**: Booking.jsx has cancellation handling
**Mobile status**: Cancel button exists in booking-details but no refund logic, walker can't cancel
**Files to modify**:
- `app/booking-details.tsx` - Add refund calculation logic, cancel for both owner and walker
- `app/walker-home.tsx` - Add walker-side cancellation capability
**Acceptance Criteria**:
- [x] Owner can cancel pending/confirmed bookings
- [x] Walker can cancel accepted bookings (with penalty consideration)
- [x] Wallet payments → automatic refund to balance
- [x] MercadoPago payments → refund status recorded (manual processing)
- [x] Notification sent to other party on cancellation
- [x] Status transitions: `pending/confirmed/accepted → cancelled`

### 1.7 Manage Cards Screen
**Web reference**: ManageCards.jsx is a "Coming Soon" placeholder
**Mobile status**: Route exists but likely empty
**Decision**: Since web has it as placeholder, mobile should also show "Coming Soon" placeholder - don't build full card management
**Files to modify**:
- `app/manage-cards.tsx` - Show professional "Coming Soon" message with credit card icon
**Acceptance Criteria**:
- [x] Screen shows "Coming Soon" with explanation
- [x] Professional appearance, not empty/broken

---

## PHASE 2: Business Logic Parity
These ensure all business logic matches the web app exactly.

### 2.1 Payment Commission Calculation
**Web reference**: PaymentsAgent.js - 20% platform + 4% gateway = walker gets 76%
**Mobile status**: Need to verify commission calculation in walker payout logic
**Files to verify/fix**:
- `app/walker-home.tsx` - `finishWalk()` function
- `app/walker-balance.tsx` - earnings display
**Acceptance Criteria**:
- [x] Commission: 20% platform fee calculated on walk completion
- [x] Walker receives 76% of total price
- [x] Transaction records include `platform_fee`, `net_earning`, `gateway_fee`
- [x] Matches web exactly

### 2.2 Pricing Logic Verification
**Web reference**: Booking.jsx - 1h=$30k, 2h=$55k, 3h=$75k COP + $10k/extra pet
**Mobile status**: Need to verify pricing matches
**Files to verify/fix**:
- `app/booking.tsx` - price calculation
**Acceptance Criteria**:
- [x] 1 hour = $30,000 COP
- [x] 2 hours = $55,000 COP
- [x] 3 hours = $75,000 COP
- [x] Additional pets = $10,000 COP each after first
- [x] Total displayed correctly before payment

### 2.3 Transaction History Pagination
**Web reference**: Wallet.jsx shows transactions with LIMIT
**Mobile status**: Only shows last 10 transactions, no pagination
**Files to modify**:
- `app/wallet.tsx` - Add pagination (infinite scroll or "Load More")
- `app/booking-history.tsx` - Add pagination if missing
**Acceptance Criteria**:
- [x] Initial load shows 20 transactions
- [x] "Load More" or infinite scroll for additional records
- [x] Loading indicator while fetching

### 2.4 Walker Profile View
**Web reference**: WalkerProfileView.jsx - public profile with stats, bio, verification badge, "Book now"
**Mobile status**: `app/walker-profile.tsx` exists - need to verify it matches web
**Files to verify/fix**:
- `app/walker-profile.tsx` - Compare against web version
**Acceptance Criteria**:
- [x] Shows walker name, photo, rating, reviews count
- [x] Shows bio, years of experience, price
- [x] Verification badge visible
- [x] "Book with this walker" button works
- [x] Layout matches web design

### 2.5 Edit Profile - Address Autocomplete
**Web reference**: EditProfile.jsx uses Google Places Autocomplete + GPS location
**Mobile status**: Need to verify address autocomplete works in mobile
**Files to verify/fix**:
- `app/edit-profile.tsx` - Ensure Google Places autocomplete + GPS location picker works
**Acceptance Criteria**:
- [x] Address field has autocomplete suggestions
- [x] GPS button to get current location
- [x] Lat/lng saved with address
- [x] Map preview of location

### 2.6 Notification Preferences Saved to DB
**Web reference**: user_profiles has `notification_preferences` JSON field
**Mobile status**: Walker settings has switches but preferences not saved to DB
**Files to modify**:
- `app/walker-settings.tsx` - Save notification preferences to `user_profiles.notification_preferences`
- `app/(tabs)/profile.tsx` - Add notification preferences for owner too
**Acceptance Criteria**:
- [x] Push/email/SMS toggle switches
- [x] Preferences saved to `notification_preferences` JSON field
- [x] Loaded on screen mount
- [x] Matches web behavior

### 2.7 Onboarding Owner - Address with Map
**Web reference**: OnboardingOwner.jsx uses Google Places Autocomplete + map preview
**Mobile status**: Need to verify address selection works with map
**Files to verify/fix**:
- `app/onboarding-owner.tsx` - Ensure address picker has autocomplete + map preview
**Acceptance Criteria**:
- [x] Google Places autocomplete for address
- [x] Map shows selected location marker
- [x] GPS button for current location
- [x] Lat/lng saved to user_profiles

---

## PHASE 3: Push Notifications (Server-Side)
The mobile app registers for push tokens, but actual push sending needs server-side setup.

### 3.1 Supabase Edge Function for Push Notifications
**Web reference**: No push notifications in web (in-app only)
**Mobile status**: Token registration works, but no server sends pushes
**Files to create** (Supabase Edge Functions - outside mobile app):
- Create Supabase Edge Function `send-push-notification` that sends via Expo Push API
**Acceptance Criteria**:
- [x] Edge function accepts: user_id, title, body, data
- [x] Looks up push token from user_profiles or separate table
- [x] Sends via Expo Push API (https://exp.host/--/api/v2/push/send)
- [x] Triggered on: new booking, walker accepted, walk started, walk completed, new message

### 3.2 Push Notification Triggers
**Modify web app or create database triggers** to call edge function on events:
- New booking nearby → notify walkers
- Walker accepted → notify owner
- Walk started → notify owner
- Walk completed → notify owner
- New message → notify recipient
**Acceptance Criteria**:
- [x] Push notifications received on device for all events
- [x] Tapping notification routes to correct screen
- [x] Notification badge count updates

### 3.3 Chat Message Push Notifications
**Mobile status**: Messages work in real-time when app is open, but no push when app is closed
**Files to modify**:
- Ensure message notifications include conversation_id in data payload
- Handle deep link from notification to specific chat
**Acceptance Criteria**:
- [x] New message push when app is backgrounded/closed
- [x] Tapping opens specific conversation
- [x] Unread count badge on messages tab

---

## PHASE 4: Error Handling & Resilience
Professional-grade error handling for production.

### 4.1 Global Error Boundary
**Mobile status**: No global error boundary - crashes are unhandled
**Files to create**:
- Create `components/ErrorBoundary.tsx` - React error boundary with fallback UI
- Modify `app/_layout.tsx` - Wrap app in ErrorBoundary
**Acceptance Criteria**:
- [x] Unhandled JS errors caught gracefully
- [x] User sees friendly error screen with "Try Again" button
- [x] Error logged (can use console.error for now, Sentry later)
- [x] App doesn't crash to white screen

### 4.2 Network Error Detection
**Mobile status**: No offline detection, no retry logic
**Files to create/modify**:
- Create `lib/network.ts` - Network status detection using `@react-native-community/netinfo`
- Modify key screens to show offline banner
**Acceptance Criteria**:
- [x] Offline banner shown when no connection
- [x] API calls queued or retried when connection restored
- [x] User can't submit forms while offline
- [x] Graceful degradation (cached data shown if available)

### 4.3 API Error Handling
**Mobile status**: Mixed - some screens have try/catch, some don't
**Files to modify**:
- Review ALL screens and ensure every Supabase call has error handling
- Consistent error message pattern (user-friendly, not raw API errors)
**Acceptance Criteria**:
- [x] Every API call wrapped in try/catch
- [x] User-friendly error messages in Spanish
- [x] Loading states for all async operations
- [x] Retry button on failed operations

---

## PHASE 5: App Store Readiness

### 5.1 Environment Variables
**Mobile status**: API keys hardcoded in app.json and code
**Files to modify**:
- Create `.env.example` with all required variables
- Modify `app.json` to use env vars where possible
- Modify code files to use `process.env.EXPO_PUBLIC_*` variables
**Acceptance Criteria**:
- [x] No hardcoded API keys in source code
- [x] `.env.example` documents all required variables
- [x] `.env` in `.gitignore`
- [x] Works with `eas build` environment secrets

### 5.2 App Store Metadata
**Files to create**:
- App Store screenshots (6.7", 6.5", 5.5" iPhone)
- App description in Spanish
- Keywords
- Privacy policy URL
- Support URL
**Acceptance Criteria**:
- [ ] All required screenshots captured
- [x] App description professional and accurate
- [ ] Privacy policy accessible via URL
- [x] Support contact information

### 5.3 Play Store Metadata
**Files to create**:
- Feature graphic (1024x500)
- Screenshots (phone, tablet)
- Short description + full description in Spanish
- Content rating questionnaire
**Acceptance Criteria**:
- [ ] All required assets created
- [x] Descriptions professional and accurate
- [ ] Content rating completed

### 5.4 Production Build Configuration
**Files to modify**:
- `app.json` / `app.config.js` - Production bundle ID, version bump
- `eas.json` - Production build profile
**Acceptance Criteria**:
- [ ] `eas build --platform ios --profile production` works
- [ ] `eas build --platform android --profile production` works
- [x] Version number incremented
- [x] Bundle identifiers correct

### 5.5 App Icon & Splash Screen
**Mobile status**: Likely already configured
**Files to verify**:
- `assets/icon.png` (1024x1024)
- `assets/splash.png`
- `assets/adaptive-icon.png` (Android)
**Acceptance Criteria**:
- [x] Icon is professional, 1024x1024, no transparency
- [x] Splash screen loads correctly
- [x] Android adaptive icon works

---

## PHASE 6: Professional Polish

### 6.1 Loading States Consistency
**Mobile status**: Mixed - some screens have skeleton loaders, some have spinners, some have nothing
**Files to modify**:
- All screens that fetch data should use SkeletonLoader or consistent ActivityIndicator
**Acceptance Criteria**:
- [x] Every screen with data fetching shows loading state
- [x] Consistent loading pattern (SkeletonLoader preferred)
- [x] No blank screens during load

### 6.2 Empty States
**Mobile status**: EmptyState component exists, may not be used everywhere
**Files to modify**:
- All list screens (notifications, booking history, messages, pets) should show EmptyState when no data
**Acceptance Criteria**:
- [x] Every list shows friendly empty state with icon and message
- [x] Relevant CTA button (e.g., "Book your first walk")

### 6.3 Haptic Feedback
**Files to modify**:
- Add haptic feedback on key interactions (button taps, booking confirmations, walk start/finish)
**Acceptance Criteria**:
- [x] Light haptic on button taps
- [x] Success haptic on booking confirmation
- [x] Uses `expo-haptics`

### 6.4 Keyboard Handling
**Files to modify**:
- All forms should use `KeyboardAvoidingView` or `ScrollView` with `keyboardShouldPersistTaps`
**Acceptance Criteria**:
- [x] Inputs don't get hidden by keyboard
- [x] Tap outside keyboard dismisses it
- [x] Consistent behavior across iOS/Android

---

## RECOMMENDATIONS (Post-Launch)

### R1: AI Agents Integration
The web app has an Agent system (`src/agents/`) with BaseAgent, AgentRegistry, BackendAgent, FrontendAgent, PaymentsAgent. Consider porting to mobile for:
- Walker matching algorithm (PaymentsAgent has commission logic)
- Automated notifications
- Smart scheduling

### R2: Offline-First Architecture
Implement with:
- React Query or TanStack Query for caching
- AsyncStorage for offline data
- Background sync when connection restored

### R3: Analytics & Crashlytics
- Firebase Analytics or Amplitude for user behavior tracking
- Sentry or Crashlytics for crash reporting
- Track: booking conversion, walker retention, payment success rate

### R4: Advanced Chat Features
- Image/file messages (web only has text)
- Typing indicators
- Read receipts
- Voice messages

### R5: Rating System Enhancement
- Bidirectional ratings (walker rates owner too)
- Rating breakdown (punctuality, communication, care) - already in booking_reviews table
- Average rating calculation on walker profile

---

## Implementation Order (Priority)

| Priority | Phase | Tasks | Estimated Effort |
|----------|-------|-------|-----------------|
| **P0 - Critical** | Phase 1 | 1.1-1.7 (Missing screens) | 3-4 days |
| **P1 - Important** | Phase 2 | 2.1-2.7 (Logic parity) | 2-3 days |
| **P2 - Required** | Phase 4 | 4.1-4.3 (Error handling) | 1-2 days |
| **P3 - Required** | Phase 5 | 5.1-5.5 (App Store) | 2-3 days |
| **P4 - Nice to have** | Phase 3 | 3.1-3.3 (Push notifications) | 2-3 days |
| **P5 - Polish** | Phase 6 | 6.1-6.4 (Professional polish) | 1-2 days |

**Total estimated: 11-17 days for production-ready app**

---

## Technical Notes

### Color Scheme (Already Applied)
- Primary green: `#13ec13`
- Dark green text: `#052e05`
- Dark background: `#111827`
- Card dark: `#1F2937`
- Input dark: `#374151`
- Text white: `#FFFFFF`
- Text gray: `#9CA3AF`

### Database Tables (13 tables)
1. `auth.users` - Supabase auth
2. `user_profiles` - User info, role, balance, preferences
3. `walkers` - Walker-specific data, verification, service area
4. `pets` - Pet CRUD with health notes
5. `bookings` - Booking lifecycle with status transitions
6. `walker_availability` - Day/time availability slots
7. `locations` - GPS tracking data
8. `notifications` - In-app notifications
9. `transactions` - Payment records
10. `conversations` - Chat conversations
11. `messages` - Chat messages
12. `booking_reviews` - Rating/review system
13. `payouts` - Walker withdrawal requests

### Status Transitions
```
pending → confirmed (payment)
confirmed → accepted (walker accepts)
accepted → pickup_requested (walker arrives)
pickup_requested → picked_up (owner confirms)
picked_up → in_progress (walker starts GPS)
in_progress → completed (walker finishes)
Any → cancelled (with refund logic)
```

### Commission Structure
- Platform fee: 20%
- Gateway fee: 4%
- Walker net: 76%
