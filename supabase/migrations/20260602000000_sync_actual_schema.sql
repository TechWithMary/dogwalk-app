-- Migration: Sync schema to actual production state
-- All IDs are UUID (not bigint as the old remote_schema.sql suggested)
-- This file is documentation of the actual state, no changes needed

-- Key differences from old schema:
-- 1. bookings.id is UUID (was bigint)
-- 2. walkers.id is UUID (was bigint)
-- 3. pets.id is UUID (was bigint)
-- 4. user_profiles.id is UUID
-- 5. transactions.amount is integer (was numeric in some flows)
-- 6. user_profiles.balance is numeric

-- This migration ADDS missing payment tracking columns that the webhook needs:

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS mercadopago_preference_id text,
  ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_completed_at timestamp with time zone;

-- Add helpful indexes for common queries
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

-- Add RLS policy for booking_reviews (was missing)
ALTER TABLE public.booking_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reviews" ON public.booking_reviews;
CREATE POLICY "Users can view their own reviews"
  ON public.booking_reviews
  FOR SELECT
  USING (
    auth.uid() = reviewer_id
    OR auth.uid() = reviewee_id
    OR is_public = true
  );

DROP POLICY IF EXISTS "Users can create reviews for their bookings" ON public.booking_reviews;
CREATE POLICY "Users can create reviews for their bookings"
  ON public.booking_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.booking_reviews;
CREATE POLICY "Users can update their own reviews"
  ON public.booking_reviews
  FOR UPDATE
  USING (auth.uid() = reviewer_id);

-- Make sure realtime is configured for the right tables
-- (These should already be set, but documenting for clarity)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
