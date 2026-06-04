-- Migration: Add missing RLS policies for conversations and messages
-- The previous schema only had SELECT policies, blocking inserts/updates

-- ==========================================
-- CONVERSATIONS: Add INSERT and UPDATE policies
-- ==========================================

DROP POLICY IF EXISTS "Users can create conversations they're part of" ON public.conversations;
CREATE POLICY "Users can create conversations they're part of"
  ON public.conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() = participant_one_id
    OR auth.uid() = participant_two_id
  );

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
CREATE POLICY "Users can update their own conversations"
  ON public.conversations
  FOR UPDATE
  USING (auth.uid() = participant_one_id OR auth.uid() = participant_two_id)
  WITH CHECK (auth.uid() = participant_one_id OR auth.uid() = participant_two_id);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;
CREATE POLICY "Users can delete their own conversations"
  ON public.conversations
  FOR DELETE
  USING (auth.uid() = participant_one_id OR auth.uid() = participant_two_id);

-- ==========================================
-- MESSAGES: Add INSERT and UPDATE policies
-- ==========================================

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Users can send messages in their conversations"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.participant_one_id = auth.uid() OR c.participant_two_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages"
  ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- ==========================================
-- NOTIFICATIONS: Add UPDATE policy (for marking as read)
-- ==========================================

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
