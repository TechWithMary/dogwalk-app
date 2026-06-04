-- Migration: Add trigger for chat messages to send push notifications
-- When a new message is inserted into messages table, send a push notification
-- to the receiver with a preview of the message.

-- Reuses the Edge Function send-push-notification

CREATE OR REPLACE FUNCTION public.send_message_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
  sender_name text;
  message_preview text;
  link_url text;
BEGIN
  -- Get config from environment (set in Supabase dashboard)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Fall back to project URL if not set
  IF supabase_url IS NULL THEN
    supabase_url := 'https://trmleuxyneucveymqmod.supabase.co';
  END IF;

  -- Don't notify if the receiver is the sender (shouldn't happen but safety check)
  IF NEW.receiver_id IS NULL OR NEW.receiver_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- Get sender's name for the notification title
  SELECT COALESCE(
    NULLIF(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))), ''),
    'Alguien'
  ) INTO sender_name
  FROM public.user_profiles
  WHERE user_id = NEW.sender_id;

  IF sender_name IS NULL THEN
    sender_name := 'Alguien';
  END IF;

  -- Truncate message preview to 100 chars
  message_preview := LEFT(COALESCE(NEW.message_text, '📎 Mensaje'), 100);

  -- Build deep link to the conversation
  link_url := '/chat?conversationId=' || NEW.conversation_id;

  -- Use pg_net to make async HTTP call to the Edge Function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'user_id', NEW.receiver_id,
      'title', '💬 ' || sender_name,
      'body', message_preview,
      'link_to', link_url,
      'data', jsonb_build_object(
        'type', 'chat_message',
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id
      )
    )
  ) INTO request_id;

  RAISE LOG 'Chat push notification request sent to user %, request_id: %', NEW.receiver_id, request_id;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_message_send_push ON public.messages;

-- Create trigger that fires AFTER INSERT
CREATE TRIGGER on_message_send_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.send_message_push_notification();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.send_message_push_notification() TO service_role;
