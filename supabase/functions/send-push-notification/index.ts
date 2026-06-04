// supabase/functions/send-push-notification/index.ts
// Sends push notifications via Expo's push service and persists them in the notifications table.
//
// Usage:
//   POST /functions/v1/send-push-notification
//   Body: { user_id: string, title: string, body: string, link_to?: string, data?: object }
//
// Or call via database trigger (see trigger_send_push function).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  link_to?: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: PushPayload = await req.json();

    if (!payload.user_id || !payload.title || !payload.body) {
      throw new Error('user_id, title, and body are required');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Persist notification in-app (so it shows in the notifications list)
    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: payload.user_id,
        title: payload.title,
        body: payload.body,
        link_to: payload.link_to || null,
        is_read: false,
      });

    if (notifError) {
      console.error('Error persisting notification:', notifError);
    }

    // 2. Get push token for the user
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('push_token, notification_preferences')
      .eq('user_id', payload.user_id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching push token:', profileError);
    }

    if (!profile?.push_token) {
      console.log('No push token for user:', payload.user_id);
      return new Response(
        JSON.stringify({ ok: true, delivered: false, reason: 'no_push_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check notification preferences
    const prefs = profile.notification_preferences || { push: true };
    if (prefs.push === false) {
      console.log('Push notifications disabled by user preference');
      return new Response(
        JSON.stringify({ ok: true, delivered: false, reason: 'disabled_by_user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 3. Send via Expo's push service
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: profile.push_token,
        title: payload.title,
        body: payload.body,
        data: {
          link_to: payload.link_to,
          ...(payload.data || {}),
        },
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }),
    });

    const expoResult = await expoResponse.json();
    console.log('Expo push result:', JSON.stringify(expoResult));

    // 4. If token is invalid, remove it
    if (expoResult?.data?.[0]?.status === 'error') {
      const errorMsg = expoResult.data[0].details?.error || '';
      if (errorMsg.includes('DeviceNotRegistered') || errorMsg.includes('InvalidCredentials')) {
        await supabaseAdmin
          .from('user_profiles')
          .update({ push_token: null })
          .eq('user_id', payload.user_id);
        console.log('Removed invalid push token for user:', payload.user_id);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, delivered: true, expo: expoResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
