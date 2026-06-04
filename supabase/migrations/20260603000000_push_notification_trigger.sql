-- Migration: Add trigger to auto-send push notifications
-- When a new row is inserted into notifications, automatically send a push notification
-- via the send-push-notification Edge Function.

-- Enable the pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function that calls the Edge Function
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
  -- Get config from environment (set in Supabase dashboard)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Fall back to vault if not set in app settings
  IF supabase_url IS NULL THEN
    supabase_url := 'https://trmleuxyneucveymqmod.supabase.co';
  END IF;

  -- Use pg_net to make async HTTP call to the Edge Function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.body,
      'link_to', NEW.link_to,
      'data', COALESCE(NEW.data, '{}'::jsonb)
    )
  ) INTO request_id;

  RAISE LOG 'Push notification request sent, id: %', request_id;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_notification_send_push ON public.notifications;

-- Create trigger that fires AFTER INSERT
CREATE TRIGGER on_notification_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_notification_trigger();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_push_notification_trigger() TO service_role;
