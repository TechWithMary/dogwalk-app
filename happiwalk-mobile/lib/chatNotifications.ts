import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';

export interface LatestMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  created_at: string;
}

const SEEN_STORAGE_KEY = 'seen_message_ids';

export function useChatNotifications(currentUserId: string | null) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState<LatestMessage | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const appStateRef = useRef(AppState.currentState);

  const loadSeenIds = useCallback(async () => {
    try {
      const stored = await (await import('@react-native-async-storage/async-storage')).default.getItem(SEEN_STORAGE_KEY);
      if (stored) {
        seenIdsRef.current = new Set(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const persistSeenIds = useCallback(async () => {
    try {
      const arr = Array.from(seenIdsRef.current).slice(-200);
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(arr));
    } catch {}
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, participant_one_id, participant_two_id, participant_one_unread_count, participant_two_unread_count')
        .or(`participant_one_id.eq.${currentUserId},participant_two_id.eq.${currentUserId}`);

      if (!convs) return;
      const total = convs.reduce((acc, c) => {
        if (c.participant_one_id === currentUserId) return acc + (c.participant_one_unread_count || 0);
        return acc + (c.participant_two_unread_count || 0);
      }, 0);
      setUnreadCount(total);
    } catch (err) {
      console.error('[ChatNotif] Error counting unread:', err);
    }
  }, [currentUserId]);

  const fetchLatestMessage = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_one_id.eq.${currentUserId},participant_two_id.eq.${currentUserId}`);

      if (!convs || convs.length === 0) {
        setLatestMessage(null);
        return;
      }

      const convIds = convs.map(c => c.id);
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', convIds)
        .neq('sender_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(1);

      setLatestMessage((msgs && msgs[0]) || null);
    } catch (err) {
      console.error('[ChatNotif] Error fetching latest message:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    loadSeenIds();
    fetchUnreadCount();
    fetchLatestMessage();
  }, [currentUserId, loadSeenIds, fetchUnreadCount, fetchLatestMessage]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('chat-global-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUserId}` },
        async (payload) => {
          const msg = payload.new as LatestMessage;
          if (seenIdsRef.current.has(msg.id)) return;
          seenIdsRef.current.add(msg.id);
          await persistSeenIds();

          setLatestMessage(msg);
          fetchUnreadCount();

          if (appStateRef.current === 'active') {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('first_name, last_name')
              .eq('user_id', msg.sender_id)
              .maybeSingle();

            const senderName = profile
              ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Alguien'
              : 'Alguien';

            Alert.alert(
              `💬 Mensaje de ${senderName}`,
              msg.message_text,
              [
                { text: 'Ahora no', style: 'cancel' },
                {
                  text: 'Responder',
                  onPress: () => router.push({ pathname: '/chat', params: { conversationId: msg.conversation_id } }),
                },
              ],
              { cancelable: true },
            );
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const c = payload.new as any;
          if (c.participant_one_id === currentUserId || c.participant_two_id === currentUserId) {
            fetchUnreadCount();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchUnreadCount, router, persistSeenIds]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
      if (next === 'active') {
        fetchUnreadCount();
      }
    });
    return () => sub.remove();
  }, [fetchUnreadCount]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!currentUserId) return;
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('participant_one_id, participant_two_id, participant_one_unread_count, participant_two_unread_count')
        .eq('id', conversationId)
        .maybeSingle();

      if (!conv) return;

      const isP1 = conv.participant_one_id === currentUserId;
      const updateField = isP1
        ? { participant_one_unread_count: 0 }
        : { participant_two_unread_count: 0 };

      await supabase.from('conversations').update(updateField).eq('id', conversationId);

      fetchUnreadCount();
    } catch (err) {
      console.error('[ChatNotif] Error marking read:', err);
    }
  }, [currentUserId, fetchUnreadCount]);

  return {
    unreadCount,
    latestMessage,
    refresh: () => {
      fetchUnreadCount();
      fetchLatestMessage();
    },
    markConversationRead,
  };
}
