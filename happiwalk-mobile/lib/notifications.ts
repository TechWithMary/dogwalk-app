import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return null;
    }

    let token: string | null = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      token = tokenData.data;
    } catch (tokenError: any) {
      if (tokenError?.message?.includes('aps-environment')) {
        console.log('[Notifications] Push notifications not available on free developer account');
      } else {
        console.error('[Notifications] Token error:', tokenError);
      }
      return null;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ push_token: token, device_platform: Platform.OS })
          .eq('user_id', user.id);

        if (error) {
          console.error('[Notifications] Failed to store push token:', error.message);
        }
      }
    } catch (err) {
      console.error('[Notifications] Auth check for token storage failed:', err);
    }

    return token;
  } catch (error: any) {
    if (error?.message?.includes('aps-environment')) {
      console.log('[Notifications] Push notifications disabled (free developer account)');
    } else {
      console.error('[Notifications] Registration failed:', error);
    }
    return null;
  }
}

export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificaciones Generales',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#13ec13',
    });
  } catch (error) {
    console.error('[Notifications] Failed to create Android channel:', error);
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: 'default',
      },
      trigger: null,
    });
    console.log('[Notifications] Local notification sent:', title);
  } catch (error) {
    console.error('[Notifications] Failed to send local notification:', error);
  }
}

export async function scheduleNotification(
  title: string,
  body: string,
  secondsFromNow: number,
  data?: Record<string, unknown>,
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: 'default',
      },
      trigger: {
        type: 'timeInterval',
        seconds: secondsFromNow,
        repeats: false,
      } as Notifications.TimeIntervalTriggerInput,
    });
    return id;
  } catch (error) {
    console.error('[Notifications] Failed to schedule notification:', error);
    return null;
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('[Notifications] Failed to cancel notifications:', error);
  }
}

export function resolveNotificationRoute(
  response: Notifications.NotificationResponse,
): string | null {
  const data = response.notification.request.content.data as
    | { link_to?: string }
    | undefined;

  if (data?.link_to) {
    return data.link_to === '/home' ? '/' : data.link_to;
  }

  return null;
}

/*
 * HOW TO SEND PUSH NOTIFICATIONS FROM THE BACKEND (Supabase Edge Functions)
 *
 * Expo hosts a push notification service. Your backend sends POST requests to
 * Expo's API which delivers the notification to the device.
 *
 * ── ENDPOINT ──
 *   POST https://exp.host/--/api/v2/push/send
 *
 * ── HEADERS ──
 *   Content-Type:  application/json
 *   Accept:         application/json
 *   Accept-Encoding: gzip, deflate
 *
 * ── REQUEST BODY (JSON) ──
 *   {
 *     "to": "<ExpoPushToken>",          // The token stored in user_profiles.push_token
 *     "title": "Paseo confirmado",
 *     "body":  "Un paseador aceptó tu paseo.",
 *     "data": {
 *       "link_to": "/booking-details",  // Optional: deep-link route for the mobile app
 *       "booking_id": "abc-123"         // Optional: any custom payload fields
 *     },
 *     "sound": "default",
 *     "priority": "high",
 *     "badge": 1,
 *     "channelId": "default"            // Android only — must match the channel created by the app
 *   }
 *
 * ── EXAMPLE SUPABASE EDGE FUNCTION (TypeScript / Deno) ──
 *
 *   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 *   import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 *
 *   serve(async (req) => {
 *     const { owner_id, booking_id, walker_name } = await req.json();
 *
 *     // 1. Look up the target user's push token from user_profiles
 *     const supabase = createClient(
 *       Deno.env.get("SUPABASE_URL")!,
 *       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
 *     );
 *
 *     const { data: profile, error } = await supabase
 *       .from("user_profiles")
 *       .select("push_token")
 *       .eq("user_id", owner_id)
 *       .single();
 *
 *     if (error || !profile?.push_token) {
 *       return new Response(
 *         JSON.stringify({ error: "No push token found for this user" }),
 *         { status: 400, headers: { "Content-Type": "application/json" } },
 *       );
 *     }
 *
 *     // 2. Deliver the notification through Expo's push service
 *     const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
 *       method: "POST",
 *       headers: {
 *         "Content-Type": "application/json",
 *         "Accept": "application/json",
 *       },
 *       body: JSON.stringify({
 *         to: profile.push_token,
 *         title: "Paseo confirmado",
 *         body: `${walker_name} aceptó tu paseo 🐾`,
 *         data: { link_to: "/booking-details", booking_id },
 *         sound: "default",
 *         priority: "high",
 *       }),
 *     });
 *
 *     const expoResult = await expoRes.json();
 *
 *     // 3. Also persist the notification in-app so it shows in the notifications list
 *     await supabase.from("notifications").insert({
 *       user_id: owner_id,
 *       title: "Paseo confirmado",
 *       body: `${walker_name} aceptó tu paseo`,
 *       link_to: "/booking-details",
 *       is_read: false,
 *     });
 *
 *     return new Response(
 *       JSON.stringify({ ok: true, expo: expoResult }),
 *       { headers: { "Content-Type": "application/json" } },
 *     );
 *   });
 *
 * ── IMPORTANT NOTES ──
 *
 * 1. Expo push tokens look like "ExponentPushToken[xxxxxxxxxxxxxxx]" on both
 *    iOS and Android. The token is stored by registerForPushNotifications() in
 *    user_profiles.push_token every time the app launches.
 *
 * 2. If a token becomes invalid (e.g. the user uninstalls the app), Expo
 *    returns an error with "device not registered" status. The edge function
 *    should check the response and delete stale tokens from the database.
 *
 * 3. To send to multiple users at once, pass an array to the "to" field
 *    (max 100 tokens per request).
 *
 * 4. The user must have granted notification permission AND successfully
 *    obtained a push token (stored in user_profiles.push_token) for backend
 *    delivery to work. If the table is missing the push_token column, the
 *    registerForPushNotifications() call will log the error but the app will
 *    continue normally.
 *
 * 5. For production use, consider the expo-server-sdk-node package which
 *    handles chunking, retries, and provides useful utilities for managing
 *    Expo push tokens at scale.
 */
