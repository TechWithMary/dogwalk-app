import React, { useState } from 'react';
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
import { ChevronRight, ChevronDown, MessageCircle, Mail, Phone, HelpCircle, Search, X, Send } from '../components/Icons';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: 'Pagos',
    question: '¿Cómo agrego fondos a mi billetera?',
    answer: 'Ve a "Mi Billetera" en tu perfil, selecciona "Agregar Fondos" y elige tu método de pago preferido. Aceptamos Mercado Pago y tarjetas de crédito/débito.',
  },
  {
    category: 'Pagos',
    question: '¿Cuánto cuesta un paseo?',
    answer: 'El costo varía según la duración y el número de mascotas. Puedes ver el precio exacto antes de confirmar tu reserva en la pantalla de pago.',
  },
  {
    category: 'Pagos',
    question: '¿Puedo obtener un reembolso?',
    answer: 'Sí, puedes cancelar hasta 2 horas antes del paseo programado para obtener un reembolso completo. Cancelaciones con menos tiempo pueden tener un cargo del 50%.',
  },
  {
    category: 'Paseos',
    question: '¿Cómo reservo un paseo?',
    answer: 'Ve a "Reservar un Paseo", selecciona tus mascotas, la fecha y hora, y elige un paseador disponible. Confirma el pago y ¡listo!',
  },
  {
    category: 'Paseos',
    question: '¿Puedo ver la ubicación de mi mascota durante el paseo?',
    answer: 'Sí, una vez que el paseo inicia, puedes ver la ubicación en tiempo real en la sección de "Paseos Activos".',
  },
  {
    category: 'Paseos',
    question: '¿Qué pasa si el paseador no llega?',
    answer: 'Si el paseador no llega en los primeros 15 minutos, puedes cancelar sin cargo y buscar otro paseador disponible.',
  },
  {
    category: 'Cuenta',
    question: '¿Cómo edito mi información personal?',
    answer: 'Ve a tu perfil y selecciona "Editar Información Personal". Allí puedes actualizar tu nombre, teléfono y dirección.',
  },
  {
    category: 'Cuenta',
    question: '¿Cómo agrego una mascota?',
    answer: 'En la pantalla de inicio, selecciona "Mis Mascotas" y luego "Agregar Mascota". Completa la información y sube una foto.',
  },
  {
    category: 'Técnico',
    question: 'La app se cierra sola, ¿qué hago?',
    answer: 'Intenta cerrar la app completamente y volverla a abrir. Si el problema persiste, asegúrate de tener la última versión desde la App Store.',
  },
  {
    category: 'Técnico',
    question: 'No recibo notificaciones',
    answer: 'Ve a Configuración de tu teléfono > Notificaciones > HappiWalk y asegúrate de que estén habilitadas. También verifica en la app en Configuración > Notificaciones.',
  },
];

const categories = ['Todos', 'Pagos', 'Paseos', 'Cuenta', 'Técnico'];

export default function HelpCenterScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{text: string, isUser: boolean}>>([
    { text: '¡Hola! Soy el asistente virtual de HappiWalk. ¿En qué puedo ayudarte hoy?', isUser: false },
  ]);
  const [chatInput, setChatInput] = useState('');

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

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setChatInput('');
    
    setTimeout(() => {
      const lowerMsg = userMessage.toLowerCase();
      let botResponse = '';
      
      if (lowerMsg.match(/hola|buenas|hey|hi|hello/)) {
        botResponse = '¡Hola! 👋 Soy el asistente de HappiWalk. Puedo ayudarte con:\n\n• Encontrar paseadores\n• Reservar paseos\n• Pagos y billetera\n• Tu cuenta y perfil\n• Problemas técnicos\n\n¿Qué necesitas?';
      }
      else if (lowerMsg.match(/paseador|walker|disponible|hay alguien|nadie|no hay/)) {
        botResponse = '🐕 Para ver paseadores disponibles:\n\n1. Ve a "Reservar un Paseo" en la pantalla principal\n2. Selecciona tus mascotas y fecha\n3. Verás la lista de paseadores disponibles para esa fecha/hora\n\n💡 Tip: Los paseadores mejor calificados aparecen primero. Si no hay disponibles, prueba con otra fecha u horario.';
      }
      else if (lowerMsg.match(/reservar|agendar|pedir paseo|quiero un paseo|cómo pido/)) {
        botResponse = '📅 Para reservar un paseo:\n\n1. Toca "Reservar un Paseo"\n2. Selecciona tu(s) mascota(s)\n3. Elige fecha y hora\n4. Selecciona un paseador de la lista\n5. Confirma el pago\n\n✅ Recibirás confirmación y podrás ver el estado en "Mis Reservas"';
      }
      else if (lowerMsg.match(/cancelar|devolver|reembolso|no puedo ir/)) {
        botResponse = '❌ Para cancelar un paseo:\n\n1. Ve a "Mis Reservas"\n2. Selecciona el paseo que quieres cancelar\n3. Toca "Cancelar Reserva"\n\n💰 Política de reembolso:\n• Cancelación > 2h antes: Reembolso completo\n• Cancelación < 2h antes: Cargo del 50%\n• Paseo en curso: No aplica reembolso';
      }
      else if (lowerMsg.match(/precio|cuánto cuesta|costo|pago|pagar|dinero|billetera|saldo/)) {
        botResponse = '💳 Sobre pagos:\n\n• El precio varía por duración y número de mascotas\n• Verás el precio exacto antes de confirmar\n• Aceptamos Mercado Pago y tarjetas\n\nPara agregar fondos:\n1. Ve a tu perfil → "Mi Billetera"\n2. Toca "Agregar Fondos"\n3. Elige tu método de pago';
      }
      else if (lowerMsg.match(/ubicación|dónde está|gps|rastrear|seguimiento|en vivo|tiempo real/)) {
        botResponse = '🗺️ Seguimiento en tiempo real:\n\nUna vez que el paseador inicie el paseo:\n1. Ve a "Paseos Activos"\n2. Verás la ubicación de tu mascota en el mapa\n3. También verás la ruta recorrida\n\n📸 El paseador también subirá fotos durante el paseo.';
      }
      else if (lowerMsg.match(/mascota|perro|gato|agregar|pet|animal/)) {
        botResponse = '🐾 Para gestionar tus mascotas:\n\n1. Ve a la pantalla de Inicio → "Mis Mascotas"\n2. Toca "Agregar Mascota"\n3. Completa nombre, raza, edad y comportamiento\n4. Sube una foto\n\nEsto ayuda al paseador a conocer mejor a tu peludito. ❤️';
      }
      else if (lowerMsg.match(/error|bug|falla|no funciona|problema|crashea|se cierra/)) {
        botResponse = '🔧 Prueba estas soluciones:\n\n1. Cierra completamente la app y vuelve a abrirla\n2. Actualiza a la última versión desde App Store\n3. Verifica tu conexión a internet\n4. Reinicia tu teléfono\n\nSi el problema persiste, usa el botón de email al final de esta conversación.';
      }
      else if (lowerMsg.match(/cuenta|perfil|nombre|email|contraseña|datos|cambiar/)) {
        botResponse = '👤 Para editar tu perfil:\n\n1. Ve a "Editar Información Personal"\n2. Actualiza tu nombre, teléfono o dirección\n3. También puedes cambiar tu foto de perfil tocando tu avatar\n\nPara cambiar email o contraseña, contáctanos por email.';
      }
      else if (lowerMsg.match(/verificación|verificado|documentos|ser paseador/)) {
        botResponse = '✅ Sobre verificación de paseadores:\n\nLos paseadores verificados tienen:\n• Documento de identidad validado\n• Antecedentes revisados\n• Entrevista personal\n\n⭐ Aparecen con badge azul en la app. Recomendamos siempre elegir paseadores verificados para mayor seguridad.';
      }
      else if (lowerMsg.match(/foto|imagen|picture|photo|mándenme/)) {
        botResponse = '📸 Fotos durante el paseo:\n\nEl paseador sube fotos automáticamente durante el recorrido. Puedes verlas:\n\n1. En "Paseos Activos" mientras dura\n2. En "Historial de Paseos" después de terminar\n\nTambién recibirás notificaciones cuando suban nuevas fotos.';
      }
      else if (lowerMsg.match(/humano|persona|agente|llamar|telefono|teléfono/)) {
        botResponse = '👨‍💼 Para hablar con un agente de soporte:\n\nToca el botón de email al final de esta conversación. Nuestro equipo responde en menos de 24 horas en días hábiles.\n\nPara emergencias durante un paseo activo, usa la opción de chat dentro del paseo.';
      }
      else {
        botResponse = '🤔 Entiendo tu consulta. Puedo ayudarte mejor si me cuentas más detalles. Por ejemplo:\n\n• "No hay paseadores disponibles"\n• "Cómo reservo un paseo"\n• "Quiero ver la ubicación de mi mascota"\n• "Cuánto cuesta un paseo"\n\nO revisa las preguntas frecuentes arriba. Si prefieres, también puedes contactar a soporte por email.';
      }
      
      setChatMessages(prev => [...prev, { text: botResponse, isUser: false }]);
    }, 800);
  };

  const handleEmailSupport = async () => {
    const email = 'soporte@happiwalk.com';
    const url = `mailto:${email}?subject=Soporte%20HappiWalk`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'No se pudo abrir el cliente de correo.');
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
              <Text style={styles.chatAvatarText}>HW</Text>
            </View>
            <View>
              <Text style={styles.chatTitle}>Soporte HappiWalk</Text>
              <Text style={styles.chatStatus}>En línea</Text>
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
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.chatInputContainer}
        >
          <TextInput
            style={styles.chatInput}
            value={chatInput}
            onChangeText={setChatInput}
            placeholder="Escribe tu mensaje..."
            placeholderTextColor="#9CA3AF"
            multiline
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity
            style={[styles.sendButton, !chatInput.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
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
        <View style={styles.searchContainer}>
          <View style={styles.searchIcon}><Search size={20} color="#9CA3AF" /></View>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar ayuda..."
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
              <Text style={styles.emptyStateSubtext}>Intenta con otras palabras o contacta a soporte</Text>
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

        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>¿Necesitas más ayuda?</Text>
          
          <TouchableOpacity style={styles.contactButton} onPress={() => setShowChat(true)}>
            <View style={[styles.contactIconBg, { backgroundColor: '#D1FAE5' }]}>
              <MessageCircle size={24} color="#0EA5E9" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Chat con Soporte</Text>
              <Text style={styles.contactSubtitle}>Respuesta en minutos</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactButton} onPress={handleEmailSupport}>
            <View style={[styles.contactIconBg, { backgroundColor: '#DBEAFE' }]}>
              <Mail size={24} color="#3B82F6" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Email</Text>
              <Text style={styles.contactSubtitle}>soporte@happiwalk.com</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginRight: 12,
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
  chatAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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