import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import {
  matchBotPattern,
  getFallbackResponse,
  buildContextMessage,
  OWNER_PATTERNS,
  WALKER_PATTERNS,
  OWNER_QUICK_REPLIES,
  WALKER_QUICK_REPLIES,
  type QuickReply,
} from '../lib/supportBot';
import { ChevronRight, ChevronDown, MessageCircle, Phone, HelpCircle, Search, X, Send, Whatsapp } from '../components/Icons';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const OWNER_FAQS: FAQItem[] = [
  {
    category: 'Reservas',
    question: '¿Cómo reservo un paseo?',
    answer: 'Ve a "Reservar un Paseo" desde la pantalla principal, selecciona tus mascotas, fecha y hora, y elige un paseador disponible. Confirma el pago y listo.',
  },
  {
    category: 'Reservas',
    question: '¿Puedo ver la ubicación de mi mascota durante el paseo?',
    answer: 'Sí, una vez que el paseador inicia el paseo (después de la recogida), puedes ver la ubicación en tiempo real desde "Paseos Activos" o tocando "Ver Walk en Vivo".',
  },
  {
    category: 'Reservas',
    question: '¿Qué pasa si el paseador no llega?',
    answer: 'Si el paseador no llega en los primeros 15 minutos, puedes cancelar sin cargo desde los detalles de la reserva y buscar otro paseador disponible.',
  },
  {
    category: 'Pagos',
    question: '¿Cuánto cuesta un paseo?',
    answer: 'El costo varía según la duración y el número de mascotas. Verás el precio exacto antes de confirmar tu reserva en la pantalla de pago.',
  },
  {
    category: 'Pagos',
    question: '¿Cómo agrego fondos a mi billetera?',
    answer: 'Ve a "Mi Billetera" en tu perfil, toca "Agregar Fondos" y elige tu método de pago (Mercado Pago, Nequi o tarjeta).',
  },
  {
    category: 'Pagos',
    question: '¿Puedo obtener un reembolso?',
    answer: 'Sí. Puedes cancelar hasta 2 horas antes del paseo para reembolso completo. Con menos tiempo, se cobra el 50%. Paseos ya iniciados no tienen reembolso.',
  },
  {
    category: 'Paseos',
    question: '¿Cómo confirmo que el paseador recogió a mi mascota?',
    answer: 'Cuando el paseador llega al punto de recogida, te avisa y te pide confirmar. Toca "Confirmar Recogida" en los detalles del paseo para liberar el inicio del tracking GPS.',
  },
  {
    category: 'Mascotas',
    question: '¿Cómo agrego una mascota?',
    answer: 'En el inicio toca "Mis Mascotas" → "Agregar Mascota". Completa nombre, raza, edad, comportamiento y sube una foto. Esto ayuda al paseador a conocer a tu peludito.',
  },
  {
    category: 'Cuenta',
    question: '¿Cómo edito mi información personal?',
    answer: 'Ve a tu perfil → "Editar Información Personal". Allí puedes actualizar nombre, teléfono, dirección y foto.',
  },
  {
    category: 'Técnico',
    question: 'No recibo notificaciones',
    answer: 'Revisa: 1) Ajustes del teléfono → Notificaciones → HappiWalk (activadas), 2) Dentro de la app, que el usuario no esté silenciado, 3) Que tengas conexión a internet.',
  },
];

const WALKER_FAQS: FAQItem[] = [
  {
    category: 'Paseos',
    question: '¿Cómo acepto un paseo?',
    answer: 'Cuando un dueño reserve contigo, te llega una notificación. Toca la reserva en "Por Aceptar" y luego "Aceptar Paseo". El estado cambia a "Aceptado" y puedes ir al punto de recogida.',
  },
  {
    category: 'Paseos',
    question: '¿Cómo inicio el GPS del paseo?',
    answer: 'Cuando el dueño confirme la recogida, la app activa el GPS automáticamente después de 4 segundos. También puedes tocar "Iniciar Paseo GPS" en la reserva activa.',
  },
  {
    category: 'Paseos',
    question: '¿Qué pasa si el dueño no contesta al llegar?',
    answer: 'Espera 10 minutos en el punto de recogida. Si no hay respuesta, toca "Reportar problema" en los detalles del paseo o escríbenos por WhatsApp para que contactemos al dueño.',
  },
  {
    category: 'Paseos',
    question: '¿Cómo finalizo un paseo?',
    answer: 'Al terminar el recorrido, abre los detalles del paseo activo y toca "Finalizar Paseo". Confirma y la app guarda la duración, distancia y notifica al dueño para que te califique.',
  },
  {
    category: 'Paseos',
    question: '¿Puedo cancelar un paseo ya aceptado?',
    answer: 'Sí, pero te penaliza. Cancela solo en emergencias. Si cancelas más de 2 veces al mes, tu ranking baja y reduces tus oportunidades de reservas.',
  },
  {
    category: 'Pagos',
    question: '¿Cuándo me pagan?',
    answer: 'Tu pago se acumula en "Mis Ganancias" después de cada paseo completado. Puedes solicitar un retiro a tu cuenta bancaria o Nequi cuando tengas mínimo $20.000 COP.',
  },
  {
    category: 'Pagos',
    question: '¿Cuánto me queda de cada paseo?',
    answer: 'El 80% del valor del paseo es para ti. HappiWalk retiene el 20% como comisión de plataforma. Verás el desglose exacto en cada reserva.',
  },
  {
    category: 'Verificación',
    question: '¿Cómo me verifico como paseador?',
    answer: 'En tu perfil → "Verificación" sube tu documento de identidad (frontal y trasera) y tu selfie. Nuestro equipo revisa en 24-48h hábiles.',
  },
  {
    category: 'Verificación',
    question: '¿Qué pasa si rechazan mi verificación?',
    answer: 'Te avisamos el motivo por WhatsApp. Puedes corregir y volver a subir los documentos. Si fue un error, responde al mensaje y revisamos manualmente.',
  },
  {
    category: 'Cuenta',
    question: '¿Cómo cambio mi zona de trabajo?',
    answer: 'En "Editar Información Personal" puedes actualizar tu dirección. La app usará tu nueva ubicación para mostrar paseos cercanos.',
  },
  {
    category: 'Técnico',
    question: 'El GPS no se activa, ¿qué hago?',
    answer: '1) Verifica que diste permiso de ubicación a HappiWalk (Ajustes → Apps → HappiWalk → Ubicación → "Siempre"). 2) Activa GPS de alta precisión. 3) Si estás en interior, acércate a una ventana.',
  },
  {
    category: 'Técnico',
    question: 'La app se cierra sola',
    answer: 'Cierra completamente y vuelve a abrir. Si persiste, desinstala y reinstala. Tus datos están seguros en la nube. Si el problema continúa, escríbenos por WhatsApp.',
  },
];

const OWNER_CATEGORIES = ['Todos', 'Reservas', 'Paseos', 'Pagos', 'Mascotas', 'Cuenta', 'Técnico'];
const WALKER_CATEGORIES = ['Todos', 'Paseos', 'Pagos', 'Verificación', 'Cuenta', 'Técnico'];

const WHATSAPP_NUMBER = '573219078042';
const WHATSAPP_DISPLAY = '+57 321 907 8042';

const ownerBotResponses = (msg: string): string => {
  if (msg.match(/hola|buenas|hey|hi|hello/)) {
    return '¡Hola! 👋 Soy el asistente para dueños de HappiWalk. Puedo ayudarte con:\n\n• Reservar paseos\n• Ver la ubicación de tu mascota\n• Pagos, reembolsos y billetera\n• Gestión de mascotas\n• Problemas técnicos\n\n¿Qué necesitas?';
  }
  if (msg.match(/paseador|walker|disponible|hay alguien|no hay/)) {
    return '🐕 Para ver paseadores disponibles:\n\n1. Ve a "Reservar un Paseo"\n2. Selecciona mascotas, fecha y hora\n3. Verás la lista de paseadores disponibles\n\n💡 Tip: Si no hay, prueba otra fecha u horario. Los paseadores aparecen según su zona.';
  }
  if (msg.match(/reservar|agendar|pedir|quiero un paseo|cómo pido/)) {
    return '📅 Para reservar:\n\n1. Toca "Reservar un Paseo"\n2. Selecciona tu(s) mascota(s)\n3. Elige fecha y hora\n4. Elige un paseador\n5. Confirma el pago\n\n✅ Recibirás confirmación push al instante.';
  }
  if (msg.match(/cancelar|devolver|reembolso|no puedo/)) {
    return '❌ Política de cancelación:\n\n• Más de 2h antes: reembolso 100%\n• Menos de 2h antes: cargo del 50%\n• Paseo ya iniciado: sin reembolso\n\nPara cancelar: ve a "Mis Reservas" → selecciona el paseo → "Cancelar".';
  }
  if (msg.match(/precio|cuánto|costo|pago|pagar|billetera|saldo/)) {
    return '💳 Sobre pagos:\n\n• El precio varía por duración y número de mascotas\n• Verás el precio exacto antes de confirmar\n• Métodos: Mercado Pago, Nequi, tarjeta\n\nPara agregar fondos: Perfil → "Mi Billetera" → "Agregar Fondos".';
  }
  if (msg.match(/ubicación|dónde|gps|rastrear|seguimiento|en vivo/)) {
    return '🗺️ Seguimiento en vivo:\n\n1. Espera a que el paseador llegue y tú confirmes la recogida\n2. La app abre automáticamente el mapa en vivo\n3. Verás ruta, distancia y tiempo\n\n📸 El paseador sube fotos durante el paseo.';
  }
  if (msg.match(/mascota|perro|gato|agregar pet/)) {
    return '🐾 Para gestionar mascotas:\n\nInicio → "Mis Mascotas" → "Agregar Mascota"\n\nDatos útiles: raza, edad, comportamiento (tímido, sociable, tira de la correa, le tiene miedo a otros perros, etc.) y foto.';
  }
  if (msg.match(/error|bug|falla|no funciona|crashea|se cierra/)) {
    return '🔧 Prueba:\n\n1. Cierra la app y vuelve a abrir\n2. Actualiza desde App Store\n3. Verifica tu internet\n4. Reinicia el teléfono\n\nSi persiste, escríbenos por WhatsApp con una captura del error.';
  }
  if (msg.match(/cuenta|perfil|nombre|email|contraseña/)) {
    return '👤 Para editar tu perfil: Perfil → "Editar Información Personal".\n\nPara cambiar email o contraseña, contáctanos por WhatsApp.';
  }
  if (msg.match(/verificado|seguro|antecedentes/)) {
    return '✅ Los paseadores verificados tienen:\n\n• Documento de identidad validado\n• Antecedentes revisados\n• Identidad confirmada por selfie\n\nAparecen con badge azul. Recomendamos siempre elegirlos.';
  }
  if (msg.match(/foto|fotos|imagen/)) {
    return '📸 Fotos durante el paseo:\n\nEl paseador puede subir fotos durante el recorrido. Las encuentras en "Paseos Activos" (durante) y en el historial (después).';
  }
  if (msg.match(/humano|persona|agente|llamar|teléfono|whatsapp/)) {
    return '👨‍💼 Para hablar con una persona real:\n\nToca el botón de WhatsApp al final de esta conversación. Respondemos rápido en horario comercial.';
  }
  return '🤔 No entendí bien. Cuéntame más. Por ejemplo:\n\n• "No encuentro paseadores"\n• "Cómo reservo"\n• "Quiero ver a mi mascota"\n• "Necesito un reembolso"\n\nTambién puedes escribirnos por WhatsApp.';
};

const walkerBotResponses = (msg: string): string => {
  if (msg.match(/hola|buenas|hey|hi|hello/)) {
    return '¡Hola! 👋 Soy el asistente para paseadores de HappiWalk. Puedo ayudarte con:\n\n• Aceptar y gestionar paseos\n• GPS y tracking\n• Ganancias y retiros\n• Verificación de documentos\n• Problemas técnicos\n\n¿Qué necesitas?';
  }
  if (msg.match(/aceptar|nuevo paseo|tengo una reserva/)) {
    return '✅ Para aceptar un paseo:\n\n1. Llega una notificación push al dueño reservar\n2. Abre la app → tab "Home" → "Por Aceptar"\n3. Revisa mascota, dirección y hora\n4. Toca "Aceptar Paseo"\n\n⏰ Tienes 5 minutos para aceptar o se libera al siguiente paseador.';
  }
  if (msg.match(/gps|ubicación|activar|tracking|rastreo/)) {
    return '📡 GPS automático:\n\nCuando el dueño confirma la recogida, la app activa el GPS automáticamente después de 4 segundos. No tienes que hacer nada.\n\nSi el dueño no confirma, ve a la reserva y toca "Iniciar Paseo GPS" manualmente.';
  }
  if (msg.match(/pago|cuándo pagan|ganancia|retiro|saldo|cuenta/)) {
    return '💰 Tus ganancias:\n\n• El 80% del valor del paseo es para ti\n• Se acumula en "Mis Ganancias" al completar\n• Retiro mínimo: $20.000 COP\n• Métodos: Nequi, Bancolombia, Davivienda\n\nVe a Perfil → "Mis Ganancias" para ver el saldo y retirar.';
  }
  if (msg.match(/verificacion|verificar|documento|cedula|c.c.|antecedentes|selfie/)) {
    return '✅ Verificación:\n\n1. Perfil → "Verificación"\n2. Sube cédula (frontal y trasera) + selfie sosteniendo el documento\n3. Equipo revisa en 24-48h hábiles\n4. Te avisamos por WhatsApp\n\nHasta estar verificado, no aparecerás en búsquedas de dueños.';
  }
  if (msg.match(/cancelar|no puedo|no voy/)) {
    return '❌ Cancelaciones:\n\n• Solo cancela en emergencias reales\n• Cancelar con <2h afecta tu ranking\n• 2+ cancelaciones al mes reduces prioridad en reservas\n\nSi es emergencia real: abre la reserva → "Cancelar" → cuéntale al dueño por chat.';
  }
  if (msg.match(/finalizar|terminar|acabar|concluir/)) {
    return '🏁 Para finalizar un paseo:\n\n1. Abre la reserva activa\n2. Toca "Finalizar Paseo"\n3. Confirma\n4. La app guarda duración, distancia y ruta\n5. El dueño te califica y recibes tu pago\n\nNo cierres la app hasta ver "Paseo finalizado".';
  }
  if (msg.match(/dueño|propietario|cliente|no contesta|no responde/)) {
    return '📞 Si el dueño no contesta al llegar:\n\n1. Espera 10 minutos en el punto de recogida\n2. Envíale un mensaje por el chat de la app\n3. Si después de 15 min no responde, escríbenos por WhatsApp para que te asignemos otro paseo o liberemos la reserva';
  }
  if (msg.match(/error|bug|falla|no funciona|crashea|se cierra/)) {
    return '🔧 Prueba:\n\n1. Cierra la app y vuelve a abrir\n2. Verifica permisos de ubicación (Ajustes → Apps → HappiWalk → Ubicación → "Siempre")\n3. Activa GPS de alta precisión\n4. Si persiste, escríbenos por WhatsApp con el modelo de tu celular';
  }
  if (msg.match(/zona|área|trabajo|cambiar ciudad/)) {
    return '📍 Para cambiar tu zona:\n\nPerfil → "Editar Información Personal" → actualiza la dirección.\n\nLa app usa esa dirección para mostrarte paseos cercanos. Si te mudas, los paseos disponibles cambiarán automáticamente.';
  }
  if (msg.match(/humano|persona|agente|llamar|teléfono|whatsapp|supervisor/)) {
    return '👨‍💼 Para hablar con una persona real:\n\nToca el botón de WhatsApp al final. Respondemos rápido entre 7am y 9pm. Fuera de ese horario, te contestamos al día siguiente.';
  }
  if (msg.match(/ranking|calificación|estrellas|puntuación/)) {
    return '⭐ Tu ranking sube con:\n\n• Paseos completados (sin cancelar)\n• Ratings de 5 estrellas\n• GPS activo durante todo el recorrido\n• Respuestas rápidas (aceptar en <2 min)\n\nRanking alto = más paseos y mejores dueños.';
  }
  return '🤔 No entendí bien. Cuéntame más. Por ejemplo:\n\n• "Cómo acepto un paseo"\n• "No me activan el GPS"\n• "Cuándo me pagan"\n• "Cómo me verifico"\n\nO escríbenos por WhatsApp.';
};

export default function HelpCenterScreen() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'owner' | 'walker' | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{text: string, isUser: boolean}>>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const cachedRole = await AsyncStorage.getItem('cached_profile_role');
      let role: 'owner' | 'walker' = cachedRole === 'walker' ? 'walker' : 'owner';
      setUserRole(role);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const name = `${profile?.first_name || ''}`.trim();
      setUserName(name);

      const greetName = name || (role === 'walker' ? 'paseador' : 'usuario');
      const welcomeMsg = role === 'walker'
        ? `¡Hola ${greetName}! 👋 Soy el asistente de HappiWalk para paseadores. Pregúntame sobre aceptar paseos, GPS, ganancias, verificación o problemas técnicos. Si necesitas una persona, abajo está mi WhatsApp.`
        : `¡Hola ${greetName}! 👋 Soy el asistente de HappiWalk para dueños. Pregúntame sobre reservas, ubicación de tu mascota, pagos o problemas técnicos. Si necesitas una persona, abajo está mi WhatsApp.`;

      setChatMessages([{ text: welcomeMsg, isUser: false }]);
    } catch (err) {
      console.error('[Support] Error loading user:', err);
      setChatMessages([{ text: '¡Hola! Soy el asistente de HappiWalk. ¿En qué puedo ayudarte?', isUser: false }]);
    }
  };

  const isWalker = userRole === 'walker';
  const faqs = isWalker ? WALKER_FAQS : OWNER_FAQS;
  const categories = isWalker ? WALKER_CATEGORIES : OWNER_CATEGORIES;
  const botResponses = isWalker ? walkerBotResponses : ownerBotResponses;

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = selectedCategory === 'Todos' || faq.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleExpand = (index: number) => {
    setExpandedItem(expandedItem === index ? null : index);
  };

  const [noMatchCount, setNoMatchCount] = useState(0);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  const handleSendMessage = (overrideMessage?: string) => {
    const userMessage = (overrideMessage ?? chatInput).trim();
    if (!userMessage) return;

    setChatMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setChatInput('');
    setShowQuickReplies(false);

    setTimeout(() => {
      const response = matchBotPattern(userMessage, isWalker ? WALKER_PATTERNS : OWNER_PATTERNS);
      if (response) {
        setNoMatchCount(0);
        setChatMessages(prev => [...prev, { text: response, isUser: false }]);
      } else {
        const next = noMatchCount + 1;
        setNoMatchCount(next);
        setChatMessages(prev => [...prev, { text: getFallbackResponse(next - 1), isUser: false }]);
      }
    }, 600);
  };

  const handleQuickReply = (reply: QuickReply) => {
    handleSendMessage(reply.message);
  };

  const handleWhatsAppWithContext = () => {
    const contextMsg = buildContextMessage(chatMessages, isWalker ? 'walker' : 'owner');
    handleWhatsApp(contextMsg);
  };

  const handleWhatsApp = async (presetMessage?: string) => {
    const defaultMsg = isWalker
      ? 'Hola, soy paseador de HappiWalk y necesito ayuda con:'
      : 'Hola, soy dueño en HappiWalk y necesito ayuda con:';
    const text = encodeURIComponent(presetMessage || defaultMsg);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp', `Escríbenos al ${WHATSAPP_DISPLAY}`);
    }
  };

  if (showChat) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setShowChat(false)} style={styles.backButton}>
            <View style={{ transform: [{ rotate: '180deg' }] }}><ChevronRight size={24} color="#111827" /></View>
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <View style={styles.chatAvatar}>
              <HelpCircle size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.chatTitle}>Asistente HappiWalk</Text>
              <Text style={styles.chatStatus}>
                {isWalker ? 'Modo Paseador' : 'Modo Dueño'} · En línea
              </Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.chatMessages} contentContainerStyle={{ padding: 16 }}>
          {chatMessages.map((msg, index) => (
            <View
              key={index}
              style={[
                styles.messageBubble,
                msg.isUser ? styles.userMessage : styles.botMessage,
              ]}
            >
              <Text style={[styles.messageText, msg.isUser && styles.userMessageText]}>
                {msg.text}
              </Text>
            </View>
          ))}

          {showQuickReplies && (
            <View style={styles.quickRepliesContainer}>
              <Text style={styles.quickRepliesLabel}>Preguntas frecuentes:</Text>
              <View style={styles.quickRepliesWrap}>
                {(isWalker ? WALKER_QUICK_REPLIES : OWNER_QUICK_REPLIES).map((qr, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.quickReplyChip}
                    onPress={() => handleQuickReply(qr)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickReplyChipText}>{qr.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {noMatchCount >= 1 && (
            <TouchableOpacity
              style={styles.chatWhatsappCta}
              onPress={handleWhatsAppWithContext}
              activeOpacity={0.8}
            >
              <Whatsapp size={20} color="#FFFFFF" />
              <Text style={styles.chatWhatsappCtaText}>
                {noMatchCount >= 2 ? 'Ir a WhatsApp con contexto' : 'Hablar con una persona'}
              </Text>
            </TouchableOpacity>
          )}

          {noMatchCount === 0 && (
            <TouchableOpacity
              style={styles.chatWhatsappCtaSecondary}
              onPress={() => handleWhatsApp()}
              activeOpacity={0.8}
            >
              <Whatsapp size={18} color="#25D366" />
              <Text style={styles.chatWhatsappCtaSecondaryText}>
                ¿Preferís WhatsApp? Tocá acá
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.chatInputContainer}
        >
          <TextInput
            style={styles.chatInput}
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Escribe tu pregunta..."
            placeholderTextColor="#9CA3AF"
            multiline
            onSubmitEditing={() => handleSendMessage()}
          />
          <TouchableOpacity
            style={[styles.sendButton, !chatInput.trim() && styles.sendButtonDisabled]}
            onPress={() => handleSendMessage()}
            disabled={!chatInput.trim()}
          >
            <Send size={20} color={chatInput.trim() ? '#FFFFFF' : '#9CA3AF'} />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <View style={{ transform: [{ rotate: '180deg' }] }}><ChevronRight size={24} color="#111827" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Centro de Ayuda</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroBanner}>
          <View style={styles.heroIcon}>
            <HelpCircle size={28} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.heroTitle}>¿En qué te ayudamos?</Text>
            <Text style={styles.heroSubtitle}>
              {isWalker
                ? 'Todo lo que necesitás para pasear en HappiWalk'
                : 'Todo lo que necesitás como dueño en HappiWalk'}
            </Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchIcon}><Search size={20} color="#9CA3AF" /></View>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar en preguntas frecuentes..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryButton,
                selectedCategory === cat && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === cat && styles.categoryButtonTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.faqsContainer}>
          <Text style={styles.sectionTitle}>Preguntas Frecuentes</Text>
          {filteredFaqs.length === 0 ? (
            <View style={styles.emptyState}>
              <HelpCircle size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>No encontramos resultados</Text>
              <Text style={styles.emptyStateSubtext}>
                Escribinos por WhatsApp y te ayudamos
              </Text>
            </View>
          ) : (
            filteredFaqs.map((faq, index) => (
              <TouchableOpacity
                key={index}
                style={styles.faqItem}
                onPress={() => toggleExpand(index)}
                activeOpacity={0.7}
              >
                <View style={styles.faqHeader}>
                  <View style={styles.faqCategoryPill}>
                    <Text style={styles.faqCategoryText}>{faq.category}</Text>
                  </View>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  {expandedItem === index ? (
                    <ChevronDown size={20} color="#6B7280" />
                  ) : (
                    <ChevronRight size={20} color="#6B7280" />
                  )}
                </View>
                {expandedItem === index && (
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={[styles.stickyBtn, styles.stickyChatBtn]}
          onPress={() => setShowChat(true)}
          activeOpacity={0.85}
        >
          <MessageCircle size={20} color="#0EA5E9" />
          <Text style={styles.stickyChatText}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.stickyBtn, styles.stickyWhatsappBtn]}
          onPress={() => handleWhatsApp()}
          activeOpacity={0.85}
        >
          <Whatsapp size={20} color="#FFFFFF" />
          <Text style={styles.stickyWhatsappText}>WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    height: 48,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  faqsContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    marginTop: 8,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  faqCategoryPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  faqCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginRight: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  contactSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
  },
  stickyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  stickyChatBtn: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
  },
  stickyChatText: {
    color: '#0EA5E9',
    fontSize: 15,
    fontWeight: '800',
  },
  stickyWhatsappBtn: {
    backgroundColor: '#25D366',
  },
  stickyWhatsappText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  whatsappContactButton: {
    borderColor: '#25D366',
    borderWidth: 1.5,
  },
  contactIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  contactSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  chatHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  chatStatus: {
    fontSize: 13,
    color: '#10B981',
  },
  chatMessages: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#111827',
    borderBottomRightRadius: 4,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  chatWhatsappCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
    alignSelf: 'center',
  },
  chatWhatsappCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  chatWhatsappCtaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#25D366',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
    alignSelf: 'center',
  },
  chatWhatsappCtaSecondaryText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },
  quickRepliesContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickRepliesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  quickRepliesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickReplyChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  quickReplyChipText: {
    color: '#0EA5E9',
    fontSize: 12,
    fontWeight: '700',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
});
