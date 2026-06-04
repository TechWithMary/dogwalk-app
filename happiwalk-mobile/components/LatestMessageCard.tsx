import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import AvatarImage from './AvatarImage';
import { MessageSquare } from './Icons';

interface LatestMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  created_at: string;
}

interface Props {
  currentUserId: string;
  bookingId?: string;
  partnerUserId?: string;
}

export default function LatestMessageCard({ currentUserId, bookingId, partnerUserId }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<LatestMessage | null>(null);
  const [partnerName, setPartnerName] = useState<string>('');
  const [partnerPhoto, setPartnerPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
        return;
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
        .subscribe();
    };
    setupSub();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator size="small" color="#052e05" />
      </View>
    );
  }

  if (!message) {
    return (
      <TouchableOpacity
        style={[styles.card, styles.emptyCard]}
        onPress={() => router.push('/(tabs)/messages')}
        activeOpacity={0.7}
      >
        <View style={styles.emptyIcon}>
          <MessageSquare size={20} color="#6B7280" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.emptyTitle}>Mensajes</Text>
          <Text style={styles.emptySubtitle}>Toca para ver tus conversaciones</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const isMine = message.sender_id === currentUserId;
  const time = new Date(message.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/chat', params: { conversationId: message.conversation_id } })}
      activeOpacity={0.7}
    >
      <AvatarImage photoUrl={partnerPhoto} fallbackInitial={partnerName} size={44} style={styles.avatar} />
      <View style={styles.cardInfo}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>
            {isMine ? `Vos → ${partnerName}` : partnerName}
          </Text>
          <Text style={styles.cardTime}>{time}</Text>
        </View>
        <Text style={styles.cardPreview} numberOfLines={1}>
          {isMine ? `${message.message_text}` : message.message_text}
        </Text>
      </View>
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
  loadingCard: {
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    opacity: 0.8,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatar: {
    marginRight: 12,
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
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
