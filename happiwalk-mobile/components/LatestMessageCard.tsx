import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import AvatarImage from './AvatarImage';
import { MessageSquare, X } from './Icons';

interface LatestMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  created_at: string;
}

interface ConversationMeta {
  id: string;
  participant_one_id: string;
  participant_two_id: string;
  participant_one_unread_count: number;
  participant_two_unread_count: number;
}

interface Props {
  currentUserId: string;
  bookingId?: string;
  partnerUserId?: string;
}

const DISMISSED_KEY = (userId: string) => `dismissed_latest_msg_${userId}`;

export default function LatestMessageCard({ currentUserId, bookingId, partnerUserId }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<LatestMessage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [partnerName, setPartnerName] = useState<string>('');
  const [partnerPhoto, setPartnerPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedConvId, setDismissedConvId] = useState<string | null>(null);

  useEffect(() => {
    const loadDismissed = async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const value = await AsyncStorage.getItem(DISMISSED_KEY(currentUserId));
        if (value) setDismissedConvId(value);
      } catch (err) {
        console.warn('[LatestMessageCard] AsyncStorage error:', err);
      }
    };
    loadDismissed();
  }, [currentUserId]);

  const fetchLatest = async () => {
    try {
      let convIds: string[] = [];

      if (bookingId && partnerUserId) {
        const [p1, p2] = [currentUserId, partnerUserId].sort();
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('participant_one_id', p1)
          .eq('participant_two_id', p2)
          .eq('booking_id', bookingId)
          .maybeSingle();

        if (existing) {
          convIds = [existing.id];
        } else {
          const { data: anyConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('participant_one_id', p1)
            .eq('participant_two_id', p2)
            .maybeSingle();
          if (anyConv) convIds = [anyConv.id];
        }
      } else {
        const { data: convs } = await supabase
          .from('conversations')
          .select('id')
          .or(`participant_one_id.eq.${currentUserId},participant_two_id.eq.${currentUserId}`)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (convs) convIds = convs.map(c => c.id);
      }

      if (convIds.length === 0) {
        setMessage(null);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const { data: convData } = await supabase
        .from('conversations')
        .select('id, participant_one_id, participant_two_id, participant_one_unread_count, participant_two_unread_count')
        .in('id', convIds)
        .maybeSingle();

      if (convData) {
        const conv = convData as ConversationMeta;
        const myUnread = conv.participant_one_id === currentUserId
          ? (conv.participant_one_unread_count || 0)
          : (conv.participant_two_unread_count || 0);
        setUnreadCount(myUnread);
      }

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!msgs || msgs.length === 0) {
        setMessage(null);
        setLoading(false);
        return;
      }

      const msg = msgs[0] as LatestMessage;
      setMessage(msg);

      const partnerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, profile_photo_url')
        .eq('user_id', partnerId)
        .maybeSingle();

      if (profile) {
        const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        setPartnerName(fullName || 'Usuario');
        setPartnerPhoto(profile.profile_photo_url || null);
      }
    } catch (err) {
      console.error('[LatestMessageCard] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, [currentUserId, bookingId, partnerUserId]);

  useEffect(() => {
    let channel: any;
    const setupSub = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`latest-msg-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
          () => {
            fetchLatest();
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversations' },
          (payload) => {
            const updated = payload.new as any;
            if (
              updated.participant_one_id === user.id ||
              updated.participant_two_id === user.id
            ) {
              fetchLatest();
            }
          },
        )
        .subscribe();
    };
    setupSub();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleDismiss = async () => {
    if (!message) return;
    setDismissedConvId(message.conversation_id);
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(DISMISSED_KEY(currentUserId), message.conversation_id);
    } catch (err) {
      console.warn('[LatestMessageCard] Could not save dismissed state:', err);
    }
  };

  if (loading) return null;

  if (!message || unreadCount === 0 || dismissedConvId === message.conversation_id) {
    return null;
  }

  const isMine = message.sender_id === currentUserId;
  const time = new Date(message.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/chat', params: { conversationId: message.conversation_id } })}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrapper}>
        <AvatarImage photoUrl={partnerPhoto} fallbackInitial={partnerName} size={44} style={styles.avatar} />
        {unreadCount > 0 && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>
            {isMine ? `Vos → ${partnerName}` : partnerName}
          </Text>
          <Text style={styles.cardTime}>{time}</Text>
        </View>
        <Text style={[styles.cardPreview, unreadCount > 0 && !isMine && styles.cardPreviewUnread]} numberOfLines={1}>
          {message.message_text}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={handleDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {},
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cardInfo: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  cardPreview: {
    fontSize: 13,
    color: '#6B7280',
  },
  cardPreviewUnread: {
    color: '#111827',
    fontWeight: '600',
  },
  dismissBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
