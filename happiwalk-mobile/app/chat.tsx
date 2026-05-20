import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, SafeAreaView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Send } from '../components/Icons';
import AvatarImage from '../components/AvatarImage';
import EmptyState from '../components/EmptyState';
import { SkeletonList } from '../components/Skeleton';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
}

interface ChatPartner {
  id: string;
  name: string;
  profile_photo_url: string | null;
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const conversationId = params.conversationId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [partner, setPartner] = useState<ChatPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUser || !conversationId) return;
    fetchMessages();
    fetchPartner();
    const unsubscribe = subscribeToMessages();
    return unsubscribe;
  }, [currentUser, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      Alert.alert('Error', 'No se pudo cargar la sesión. Intenta de nuevo.');
    }
  };

  const fetchPartner = async () => {
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (!conv) return;

      const otherUserId = conv.participant_one_id === currentUser?.id
        ? conv.participant_two_id
        : conv.participant_one_id;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, profile_photo_url')
        .eq('user_id', otherUserId)
        .maybeSingle();

      setPartner({
        id: otherUserId,
        name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Usuario',
        profile_photo_url: profile?.profile_photo_url || null,
      });
    } catch (err) {
      console.error('Error fetching partner:', err);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
      Alert.alert('Error', 'No se pudieron cargar los mensajes. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser || !partner) return;

    const text = inputText.trim();
    setInputText('');

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        receiver_id: partner.id,
        message_text: text,
        message_type: 'text',
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error sending message:', err);
      Alert.alert('Error', 'No se pudo enviar el mensaje. Intenta de nuevo.');
      setInputText(text);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <AvatarImage
          photoUrl={partner?.profile_photo_url}
          fallbackInitial={partner?.name || 'U'}
          size={40}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{partner?.name || 'Cargando...'}</Text>
          <Text style={styles.headerStatus}>En línea</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <SkeletonList count={6} />
          ) : messages.length === 0 ? (
            <EmptyState
              icon={<Send size={36} color="#0EA5E9" />}
              title="No hay mensajes aún"
              description="¡Inicia la conversación! Envía el primer mensaje."
            />
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUser?.id;
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    isMe ? styles.messageRowRight : styles.messageRowLeft,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                    ]}
                  >
                    <Text style={isMe ? styles.messageTextMe : styles.messageTextOther}>
                      {msg.message_text}
                    </Text>
                    <Text style={styles.messageTime}>{formatTime(msg.created_at)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Send size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerInfo: { marginLeft: 12, flex: 1 },
  headerName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  headerStatus: { fontSize: 12, color: '#0EA5E9', fontWeight: '600', marginTop: 2 },
  keyboardView: { flex: 1 },
  messagesContainer: { flex: 1, backgroundColor: '#F0F2F5' },
  messagesContent: { padding: 16, paddingBottom: 24 },
  messageRow: { marginBottom: 12, maxWidth: '80%' },
  messageRowRight: { alignSelf: 'flex-end' },
  messageRowLeft: { alignSelf: 'flex-start' },
  messageBubble: { padding: 12, borderRadius: 16 },
  messageBubbleMe: { backgroundColor: '#0EA5E9', borderBottomRightRadius: 4 },
  messageBubbleOther: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4 },
  messageTextMe: { fontSize: 14, color: '#052e05', fontWeight: '600' },
  messageTextOther: { fontSize: 14, color: '#111827', fontWeight: '600' },
  messageTime: { fontSize: 10, color: 'rgba(0,0,0,0.4)', marginTop: 4, textAlign: 'right' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
    fontWeight: '600',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
