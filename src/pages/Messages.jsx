import React, { useState, useRef, useEffect } from 'react';
import { Search, ArrowLeft, Send, MoreVertical, Phone, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

const Messages = () => {
  const [activeChat, setActiveChat] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch initial conversations list
  const fetchConversations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      // Fetch conversations where user is participant 1 or 2
      const { data, error } = await supabase
        .from('conversations')
        .select(`
            *,
            p1:participant_one_id(first_name, last_name, profile_photo_url),
            p2:participant_two_id(first_name, last_name, profile_photo_url)
        `)
        .or(`participant_one_id.eq.${user.id},participant_two_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Format data for display
      const formatted = data.map(c => {
        const isP1 = c.participant_one_id === user.id;
        // If join failed or specific structure needs adjustment:
        // Note: Supabase usually returns arrays for foreign keys or objects if 1:1. 
        // With auth.users it might be tricky as valid FK. 
        // Let's assume user_profiles is linked via 'user_id' in profile table, 
        // but typically schemas link to auth.users directly. 
        // If the 'conversations' table has FK to auth.users, we can't select * fields from auth.users easily via client 
        // without a public profile view/table.
        // We will try to fetch profiles manually if the join doesn't work as expected or simply use a "Profile fetch helper".

        return {
          id: c.id,
          otherUserId: isP1 ? c.participant_two_id : c.participant_one_id,
          // Placeholder logic until profile fetch confirmed
          name: 'Usuario',
          img: 'https://via.placeholder.com/150',
          lastMsg: '...',
          time: new Date(c.updated_at).toLocaleDateString(),
          unread: 0
        };
      });

      // Enhancing with real profiles (Parallel fetch for simplicity in this step)
      const refined = await Promise.all(formatted.map(async (chat) => {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('first_name, last_name, profile_photo_url')
          .eq('user_id', chat.otherUserId)
          .single();

        // Fetch last message
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('message_text, created_at')
          .eq('conversation_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...chat,
          name: profile ? `${profile.first_name} ${profile.last_name}` : 'Usuario',
          img: profile?.profile_photo_url || 'https://via.placeholder.com/150',
          lastMsg: lastMsg?.message_text || 'Inicia la conversación',
          time: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        };
      }));

      setConversations(refined);

    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages when a chat is opened
  useEffect(() => {
    if (!activeChat) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeChat.id)
        .order('created_at', { ascending: true });

      if (error) toast.error("Error cargando mensajes");
      else setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to new messages in this conversation
    const subscription = supabase
      .channel(`chat:${activeChat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeChat.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [activeChat]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChat]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !currentUser || !activeChat) return;

    const text = inputText;
    setInputText(""); // Optimistic clear

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: activeChat.id,
        sender_id: currentUser.id,
        receiver_id: activeChat.otherUserId, // Redundant but good for quick lookup
        message_text: text,
        message_type: 'text'
      });

      if (error) throw error;
      // Don't need to manually add to state, subscription handles it

      // Update conversation 'updated_at' to bump it to top (Trigger usually handles this, but client side check)
    } catch {
      toast.error("No se pudo enviar");
      setInputText(text); // Restore text
    }
  };

  // --- VISTA 1: LISTA DE CHATS ---
  if (!activeChat) {
    return (
      <div className="bg-white min-h-full pb-20">
        {/* Header Lista */}
        <div className="px-5 pt-6 pb-2">
          <h1 className="text-2xl font-black text-gray-900 mb-4">Mensajes</h1>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
            <input className="w-full bg-gray-100 py-3 pl-10 pr-4 rounded-xl font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" placeholder="Buscar..." />
          </div>
        </div>

        {/* Lista */}
        <div className="mt-2">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-10 opacity-50 px-6">
              <p>No tienes conversaciones aún.</p>
            </div>
          ) : (
            conversations.map(chat => (
              <div key={chat.id} onClick={() => setActiveChat(chat)} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100">
                <div className="relative shrink-0">
                  <img src={chat.img} className="w-14 h-14 rounded-full object-cover shadow-sm border border-gray-100" alt={chat.name} />
                  {chat.unread > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">{chat.unread}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-gray-900 truncate">{chat.name}</h3>
                    <span className="text-xs text-gray-400 font-medium">{chat.time}</span>
                  </div>
                  <p className={`text-sm truncate ${chat.unread > 0 ? 'text-gray-800 font-bold' : 'text-gray-500'}`}>{chat.lastMsg}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // --- VISTA 2: CONVERSACIÓN ABIERTA ---
  return (
    <div className="bg-gray-50 h-screen flex flex-col pb-24 fixed inset-0 z-50">

      {/* Header Chat */}
      <div className="bg-white px-4 py-3 shadow-sm border-b border-gray-100 flex items-center justify-between shrink-0 pt-safe">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <img src={activeChat.img} className="w-10 h-10 rounded-full object-cover border border-gray-100" alt="Avatar" />
          <div>
            <h3 className="font-bold text-sm text-gray-900 leading-tight">{activeChat.name}</h3>
            <p className="text-emerald-600 text-[10px] font-bold">En línea</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition"><Phone className="w-5 h-5" /></button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Área de Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f0f2f5]">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm relative group ${msg.sender_id === currentUser?.id
                ? 'bg-[#13ec13] text-[#052e05] rounded-br-none'
                : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
              }`}>
              <p className="font-medium leading-relaxed">{msg.message_text}</p>
              <span className={`text-[9px] block text-right mt-1 opacity-60 font-bold uppercase`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Flotante */}
      <div className="bg-white p-3 border-t border-gray-200 shrink-0 pb-safe">
        <form onSubmit={handleSend} className="flex gap-2 items-end">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 max-h-32 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
          />
          <button
            disabled={!inputText.trim()}
            className="w-11 h-11 bg-gray-900 rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Messages;