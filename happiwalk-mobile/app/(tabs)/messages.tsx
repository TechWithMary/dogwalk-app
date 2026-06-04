import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, getSignedAvatarUrl } from '../../lib/supabase';
import { prefetchSignedUrl } from '../../lib/avatarCache';
import AvatarImage from '../../components/AvatarImage';
import EmptyState from '../../components/EmptyState';
import { MessageSquare } from '../../components/Icons';
import { SkeletonList } from '../../components/Skeleton';

interface Conversation {
  id: string;
  otherUserId: string;
  name: string;
  profile_photo_url: string | null;
  lastMsg: string;
  time: string;
  unread: number;
}

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchConversations = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_one_id.eq.${currentUser.id},participant_two_id.eq.${currentUser.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formatted = await Promise.all((data || []).map(async (conv) => {
        const isP1 = conv.participant_one_id === currentUser.id;
        const otherUserId = isP1 ? conv.participant_two_id : conv.participant_one_id;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('first_name, last_name, profile_photo_url')
          .eq('user_id', otherUserId)
          .maybeSingle();

        const { data: lastMsg } = await supabase
          .from('messages')
          .select('message_text, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: conv.id,
          otherUserId,
          name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Usuario',
          profile_photo_url: profile?.profile_photo_url || null,
          lastMsg: lastMsg?.message_text || 'Inicia la conversación',
          time: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '',
          unread: isP1 ? (conv.participant_one_unread_count || 0) : (conv.participant_two_unread_count || 0),
        };
      }));

      setConversations(formatted);

      (data || []).forEach((conv) => {
        const isP1 = conv.participant_one_id === currentUser.id;
        const otherUserId = isP1 ? conv.participant_two_id : conv.participant_one_id;
        const photoUrl = formatted.find(f => f.otherUserId === otherUserId)?.profile_photo_url;
        if (photoUrl) {
          prefetchSignedUrl('avatars', photoUrl, () => getSignedAvatarUrl(photoUrl));
        }
      });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      Alert.alert('Error', 'No se pudieron cargar las conversaciones. Desliza para reintentar.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('conversations-list')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
      }, (payload) => {
        const conv = payload.new as any;
        if (
          conv.participant_one_id === currentUser.id ||
          conv.participant_two_id === currentUser.id
        ) {
          fetchConversations();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mensajes</Text>
        <Text style={styles.subtitle}>Tus conversaciones</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#111827']} />
        }
      >
        {loading ? (
          <SkeletonList count={5} />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={36} color="#6B7280" />}
            title="No tienes conversaciones"
            description="Las conversaciones aparecerán cuando tengas paseos activos."
          />
        ) : (
          conversations.map((chat) => (
            <TouchableOpacity
              key={chat.id}
              style={styles.chatItem}
              onPress={() => router.push({ pathname: '/chat', params: { conversationId: chat.id } })}
            >
              <AvatarImage
                photoUrl={chat.profile_photo_url}
                fallbackInitial={chat.name}
                size={56}
                style={styles.avatar}
              />
              <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName} numberOfLines={1}>{chat.name}</Text>
                  <Text style={styles.chatTime}>{chat.time}</Text>
                </View>
                <Text
                  style={[styles.chatLastMsg, chat.unread > 0 && styles.chatLastMsgUnread]}
                  numberOfLines={1}
                >
                  {chat.lastMsg}
                </Text>
              </View>
              {chat.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{chat.unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    backgroundColor: '#111827',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  content: { flex: 1, padding: 20 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  avatar: { marginRight: 12 },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 15, fontWeight: '800', color: '#111827', flex: 1, marginRight: 8 },
  chatTime: { fontSize: 12, color: '#9CA3AF' },
  chatLastMsg: { fontSize: 14, color: '#6B7280' },
  chatLastMsgUnread: { color: '#111827', fontWeight: '700' },
  unreadBadge: {
    backgroundColor: '#111827',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
