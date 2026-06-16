# Happiwalk Completion - Learnings

## Cancellation Logic Implementation (2026-05-13)

### Database Schema Notes
- **transactions** table: `user_id`, `booking_id`, `transaction_type` ('payment'|'refund'), `amount`, `payment_method` ('wallet'|'mercadopago'), `status` ('completed'|'pending'), `description`
- **user_profiles** table: `user_id`, `balance`
- **notifications** table: `user_id`, `title`, `body`, `link_to`
- **bookings** table: `user_id` (owner), `walker_id`, `status`, `total_price`

### Payment Flows
- **Wallet payment**: Created in `booking.tsx` with `payment_method: 'wallet'`, `status: 'completed'`. Balance deducted from `user_profiles.balance`.
- **MercadoPago payment**: Created via Supabase Edge Function (`create-payment-intent`). `payment_method: 'mercadopago'`. Webhook sets status.
- **Walk completion**: Walker earns 80% of total_price (net_earning), recorded in transactions as `transaction_type: 'payment'`, `payment_method: 'wallet'`.

### TypeScript with Supabase Relations
- When using `.select('walker_id, walkers(user_id, name)')` with `.single()`, Supabase returns `walkers` as a nested object, but TypeScript may infer it as an array. Use `(data as any)?.walkers?.user_id` to avoid type errors.

### Cancellation Logic
- **Owner cancels** (pending/confirmed): booking-details.tsx — refunds to owner's balance, notifies walker
- **Walker cancels** (accepted): walker-home.tsx — refunds to owner's balance, notifies owner
- **No transaction** (pending without payment): skip refund, just cancel and notify
- **Wallet refund**: Update `user_profiles.balance` + insert refund transaction with `status: 'completed'`
- **MercadoPago refund**: Insert refund transaction with `status: 'pending'` (manual processing)

### Status Transitions
- `pending → cancelled` (owner)
- `confirmed → cancelled` (owner)
- `accepted → cancelled` (walker)

## Audit: API Error Handling across all screens (2026-05-13)

**Audit scope**: 24 files with Supabase API calls in `app/` directory.

**Pattern used**: Every `supabase.from/auth/storage` call wrapped in try/catch with `Alert.alert()` showing Spanish user-friendly messages. Loading states already existed; pull-to-refresh serves as retry mechanism.

**Files already OK** (proper try/catch + Alert): login.tsx, forgot-password.tsx, onboarding-owner.tsx, pets.tsx, rating.tsx, walker-profile.tsx, booking-details.tsx, top-up.tsx, admin/verifications.tsx, admin/payouts.tsx

**Files fixed (14 total)**:
1. walker-home.tsx: fetchWalkerData + sendLocation → Alert on error
2. booking.tsx: fetchData → wrapped in try/catch
3. chat.tsx: fetchCurrentUser, fetchMessages, handleSend → Alert on error
4. (tabs)/index.tsx: checkRole, fetchData → try/catch + Alert
5. (tabs)/profile.tsx: fetchProfile, handleLogout → Alert + try/catch
6. walker-balance.tsx: fetchData → Alert on error
7. wallet.tsx: fetchWalletData → Alert on error
8. booking-history.tsx: fetchBookings → Alert on error
9. walker-settings.tsx: fetchWalker, handleLogout → Alert + try/catch
10. (tabs)/messages.tsx: fetchCurrentUser, fetchConversations → Alert on error
11. messages.tsx: same as (tabs)/messages.tsx
12. notifications.tsx: fetchNotifications → Alert on error
13. onboarding-walker.tsx: initData, fetchAvailability → Alert on error
14. edit-profile.tsx: fetchProfile → Alert on error

**pre-existing tsc errors** (not fixed, out of scope): _layout.tsx Linking.parse, GoogleMapsWebView.tsx height type
