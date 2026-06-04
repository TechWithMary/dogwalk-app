import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, MessageCircle, HelpCircle, Search, X, Send } from 'lucide-react';
import { supabase } from '../supabaseClient';

const OWNER_FAQS = [
  {
    category: 'Reservas',
    question: '¿Cómo reservo un paseo?',
    answer: 'Ve a "Reservar un Paseo", selecciona tus mascotas, fecha y hora, y elige un paseador disponible. Confirma el pago y listo.',
  },
  {
    category: 'Reservas',
    question: '¿Puedo ver la ubicación de mi mascota durante el paseo?',
    answer: 'Sí, una vez que el paseador inicia el paseo (después de la recogida), puedes ver la ubicación en tiempo real desde "Paseos Activos" o tocando "Ver Walk en Vivo".',
  },
  {
    category: 'Reservas',
    question: '¿Qué pasa si el paseador no llega?',
    answer: 'Si el paseador no llega en los primeros 15 minutos, puedes cancelar sin cargo desde los detalles de la reserva.',
  },
  {
    category: 'Pagos',
    question: '¿Cuánto cuesta un paseo?',
    answer: 'El costo varía según la duración y el número de mascotas. Verás el precio exacto antes de confirmar tu reserva.',
  },
  {
    category: 'Pagos',
    question: '¿Cómo agrego fondos a mi billetera?',
    answer: 'Ve a "Mi Billetera" en tu perfil, toca "Agregar Fondos" y elige Mercado Pago, Nequi o tarjeta.',
  },
  {
    category: 'Pagos',
    question: '¿Puedo obtener un reembolso?',
    answer: 'Sí. Puedes cancelar hasta 2 horas antes del paseo para reembolso completo. Con menos tiempo, se cobra el 50%.',
  },
  {
    category: 'Paseos',
    question: '¿Cómo confirmo que el paseador recogió a mi mascota?',
    answer: 'Cuando el paseador llega al punto de recogida, te pide confirmar. Toca "Confirmar Recogida" para liberar el tracking GPS.',
  },
  {
    category: 'Mascotas',
    question: '¿Cómo agrego una mascota?',
    answer: 'En el inicio, ve a "Mis Mascotas" → "Agregar Mascota". Completa raza, edad, comportamiento y sube una foto.',
  },
  {
    category: 'Cuenta',
    question: '¿Cómo edito mi información personal?',
    answer: 'Ve a tu perfil → "Editar Información Personal" para actualizar nombre, teléfono, dirección y foto.',
  },
  {
    category: 'Técnico',
    question: 'No recibo notificaciones',
    answer: 'Revisa los ajustes de notificaciones de tu navegador (icono de campana 🔔 junto a la URL) y asegúrate de tener HappiWalk permitido.',
  },
];

const WALKER_FAQS = [
  {
    category: 'Paseos',
    question: '¿Cómo acepto un paseo?',
    answer: 'Cuando un dueño reserve contigo, te llega una notificación. Ve a "Por Aceptar" y toca "Aceptar Paseo". Tienes 5 minutos para aceptar.',
  },
  {
    category: 'Paseos',
    question: '¿Cómo inicio el GPS del paseo?',
    answer: 'Cuando el dueño confirma la recogida, la app móvil activa el GPS automáticamente después de 4 segundos. En la app también puedes tocar "Iniciar Paseo GPS".',
  },
  {
    category: 'Paseos',
    question: '¿Qué pasa si el dueño no contesta al llegar?',
    answer: 'Espera 10 minutos. Envíale un mensaje por el chat de la app. Si después de 15 min no responde, escríbenos por WhatsApp.',
  },
  {
    category: 'Paseos',
    question: '¿Cómo finalizo un paseo?',
    answer: 'Abre la reserva activa, toca "Finalizar Paseo" y confirma. La app guarda duración, distancia y notifica al dueño para que te califique.',
  },
  {
    category: 'Paseos',
    question: '¿Puedo cancelar un paseo ya aceptado?',
    answer: 'Sí, pero penaliza tu ranking. Cancela solo en emergencias. 2+ cancelaciones al mes reducen tu prioridad en reservas.',
  },
  {
    category: 'Pagos',
    question: '¿Cuándo me pagan?',
    answer: 'Tu pago se acumula en "Mis Ganancias" después de cada paseo completado. Retiro mínimo: $20.000 COP a Nequi, Bancolombia o Davivienda.',
  },
  {
    category: 'Pagos',
    question: '¿Cuánto me queda de cada paseo?',
    answer: 'El 80% del valor del paseo es para ti. HappiWalk retiene el 20% como comisión. Verás el desglose en cada reserva.',
  },
  {
    category: 'Verificación',
    question: '¿Cómo me verifico?',
    answer: 'En tu perfil → "Verificación" sube tu documento de identidad (frontal y trasera) + selfie. Revisamos en 24-48h hábiles.',
  },
  {
    category: 'Verificación',
    question: '¿Qué pasa si rechazan mi verificación?',
    answer: 'Te avisamos el motivo por WhatsApp. Puedes corregir y volver a subir los documentos.',
  },
  {
    category: 'Cuenta',
    question: '¿Cómo cambio mi zona de trabajo?',
    answer: 'En "Editar Información Personal" actualiza tu dirección. La app usará la nueva ubicación para mostrarte paseos cercanos.',
  },
  {
    category: 'Técnico',
    question: 'La app se cierra sola, ¿qué hago?',
    answer: 'Cierra completamente y vuelve a abrir. Si persiste, escríbenos por WhatsApp con el modelo de tu celular.',
  },
];

const OWNER_CATEGORIES = ['Todos', 'Reservas', 'Paseos', 'Pagos', 'Mascotas', 'Cuenta', 'Técnico'];
const WALKER_CATEGORIES = ['Todos', 'Paseos', 'Pagos', 'Verificación', 'Cuenta', 'Técnico'];

const WHATSAPP_NUMBER = '573219078042';
const WHATSAPP_DISPLAY = '+57 321 907 8042';

export default function HelpCenter() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItem, setExpandedItem] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, role')
        .eq('user_id', user.id)
        .maybeSingle();

      const role = profile?.role === 'walker' ? 'walker' : 'owner';
      setUserRole(role);
      setUserName(profile?.first_name || '');

      const greetName = profile?.first_name || (role === 'walker' ? 'paseador' : 'usuario');
      const welcomeMsg = role === 'walker'
        ? `¡Hola ${greetName}! 👋 Soy el asistente de HappiWalk para paseadores. Pregúntame sobre aceptar paseos, GPS, ganancias o verificación. Si necesitás una persona, abajo está mi WhatsApp.`
        : `¡Hola ${greetName}! 👋 Soy el asistente de HappiWalk para dueños. Pregúntame sobre reservas, ubicación de tu mascota, pagos o problemas técnicos. Si necesitás una persona, abajo está mi WhatsApp.`;

      setChatMessages([{ text: welcomeMsg, isUser: false }]);
    } catch (err) {
      console.error('[HelpCenter] Error:', err);
      setChatMessages([{ text: '¡Hola! Soy el asistente de HappiWalk. ¿En qué puedo ayudarte?', isUser: false }]);
    }
  };

  const isWalker = userRole === 'walker';
  const faqs = isWalker ? WALKER_FAQS : OWNER_FAQS;
  const categories = isWalker ? WALKER_CATEGORIES : OWNER_CATEGORIES;

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = selectedCategory === 'Todos' || faq.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const ownerBotResponses = (msg) => {
    if (msg.match(/hola|buenas|hey|hi|hello/)) {
      return '¡Hola! 👋 Soy el asistente para dueños. Puedo ayudarte con reservas, ubicación de tu mascota, pagos y problemas técnicos. ¿Qué necesitás?';
    }
    if (msg.match(/paseador|walker|disponible/)) {
      return '🐕 Para ver paseadores disponibles: Reserva un Paseo → selecciona mascotas y horario → lista de paseadores. Si no hay, probá con otra fecha.';
    }
    if (msg.match(/reservar|agendar|pedir/)) {
      return '📅 Para reservar: "Reservar un Paseo" → mascotas → fecha/hora → paseador → confirmar pago. Recibirás confirmación al instante.';
    }
    if (msg.match(/cancelar|devolver|reembolso/)) {
      return '❌ Política: >2h antes reembolso 100%, <2h antes cargo 50%, paseo iniciado sin reembolso. Para cancelar: Mis Reservas → seleccionar → Cancelar.';
    }
    if (msg.match(/precio|cuánto|costo|pago|billetera/)) {
      return '💳 El precio varía por duración y mascotas. Métodos: Mercado Pago, Nequi, tarjeta. Para agregar fondos: Perfil → Mi Billetera → Agregar Fondos.';
    }
    if (msg.match(/ubicación|dónde|gps|rastrear|en vivo/)) {
      return '🗺️ Una vez el dueño confirma la recogida, abrís el mapa en vivo. Verás ruta, distancia y tiempo. El paseador también sube fotos.';
    }
    if (msg.match(/mascota|perro|gato|agregar/)) {
      return '🐾 Mis Mascotas → Agregar Mascota. Datos útiles: raza, edad, comportamiento (tímido, sociable, etc.) y foto.';
    }
    if (msg.match(/error|bug|falla|no funciona/)) {
      return '🔧 Probá: 1) refrescar la página, 2) cerrar sesión y volver a entrar, 3) otro navegador. Si persiste, escribinos por WhatsApp.';
    }
    if (msg.match(/humano|persona|agente|whatsapp/)) {
      return '👨‍💼 Tocá el botón de WhatsApp al final. Respondemos rápido entre 7am y 9pm.';
    }
    return '🤔 No entendí bien. Contame más, por ejemplo: "Cómo reservo", "No hay paseadores", "Necesito un reembolso". O escribinos por WhatsApp.';
  };

  const walkerBotResponses = (msg) => {
    if (msg.match(/hola|buenas|hey|hi|hello/)) {
      return '¡Hola! 👋 Soy el asistente para paseadores. Puedo ayudarte con aceptar paseos, GPS, ganancias y verificación. ¿Qué necesitás?';
    }
    if (msg.match(/aceptar|nuevo paseo/)) {
      return '✅ Para aceptar: "Por Aceptar" → revisar datos → "Aceptar Paseo". Tenés 5 minutos o se libera al siguiente.';
    }
    if (msg.match(/gps|ubicación|activar|tracking/)) {
      return '📡 GPS automático: cuando el dueño confirma la recogida, la app móvil activa GPS después de 4 segundos. También podés tocar "Iniciar Paseo GPS" manualmente.';
    }
    if (msg.match(/pago|cuándo pagan|ganancia|retiro|saldo/)) {
      return '💰 80% del paseo es para vos. Se acumula en "Mis Ganancias" al completar. Retiro mínimo $20.000 COP a Nequi, Bancolombia o Davivienda.';
    }
    if (msg.match(/verificacion|verificar|documento|cedula/)) {
      return '✅ Verificación: Perfil → Verificación → subir cédula (frontal y trasera) + selfie. Revisamos en 24-48h hábiles.';
    }
    if (msg.match(/cancelar|no puedo/)) {
      return '❌ Cancelá solo en emergencias reales. 2+ cancelaciones al mes reducen tu prioridad en reservas.';
    }
    if (msg.match(/finalizar|terminar/)) {
      return '🏁 Para finalizar: reserva activa → "Finalizar Paseo" → confirmar. La app guarda duración, distancia y notifica al dueño.';
    }
    if (msg.match(/dueño|cliente|no contesta/)) {
      return '📞 Esperá 10 minutos en el punto de recogida. Escribile por el chat. Si después de 15 min no responde, contactanos por WhatsApp.';
    }
    if (msg.match(/error|bug|falla|no funciona/)) {
      return '🔧 Probá: 1) refrescar, 2) cerrar sesión, 3) otro navegador. Si persiste, escribinos por WhatsApp con el modelo del equipo.';
    }
    if (msg.match(/humano|persona|agente|whatsapp/)) {
      return '👨‍💼 Tocá el botón de WhatsApp. Respondemos entre 7am y 9pm.';
    }
    return '🤔 No entendí bien. Por ejemplo: "Cómo acepto", "GPS no se activa", "Cuándo me pagan", "Cómo me verifico".';
  };

  const botResponses = isWalker ? walkerBotResponses : ownerBotResponses;

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setChatInput('');
    setTimeout(() => {
      const botResponse = botResponses(userMessage.toLowerCase());
      setChatMessages(prev => [...prev, { text: botResponse, isUser: false }]);
    }, 600);
  };

  const handleWhatsApp = (presetMessage) => {
    const defaultMsg = isWalker
      ? 'Hola, soy paseador de HappiWalk y necesito ayuda con:'
      : 'Hola, soy dueño en HappiWalk y necesito ayuda con:';
    const text = encodeURIComponent(presetMessage || defaultMsg);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ChevronRight className="w-6 h-6 text-gray-900 rotate-180" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Centro de Ayuda</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="bg-gray-900 rounded-2xl p-4 flex items-center mb-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-white" />
          </div>
          <div className="ml-4 flex-1">
            <h2 className="text-white font-bold text-base">¿En qué te ayudamos?</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {isWalker ? 'Todo para pasear en HappiWalk' : 'Todo para dueños en HappiWalk'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 flex items-center px-4 h-12 mb-3">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            type="text"
            placeholder="Buscar en preguntas frecuentes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 outline-none text-sm text-gray-900"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border ${
                selectedCategory === cat
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <h3 className="text-lg font-extrabold text-gray-900 mb-3 px-1">Preguntas Frecuentes</h3>

        <div className="space-y-3 mb-6">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-10">
              <HelpCircle className="w-12 h-12 text-gray-300 mx-auto" />
              <p className="text-gray-600 font-bold mt-4">No encontramos resultados</p>
              <p className="text-gray-400 text-sm mt-1">Escribinos por WhatsApp y te ayudamos</p>
            </div>
          ) : (
            filteredFaqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedItem(expandedItem === index ? null : index)}
                  className="w-full p-4 flex items-start justify-between text-left"
                >
                  <div className="flex-1 pr-3">
                    <span className="inline-block bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded mb-2 uppercase">
                      {faq.category}
                    </span>
                    <p className="font-bold text-sm text-gray-900">{faq.question}</p>
                  </div>
                  {expandedItem === index ? (
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0 mt-1" />
                  )}
                </button>
                {expandedItem === index && (
                  <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="h-24" />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => setShowChat(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-sky-500 bg-sky-50 hover:bg-sky-100 transition-colors"
        >
          <MessageCircle className="w-5 h-5 text-sky-500" />
          <span className="font-extrabold text-sm text-sky-500">Chat</span>
        </button>
        <button
          onClick={() => handleWhatsApp()}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
          <span className="font-extrabold text-sm text-white">WhatsApp</span>
        </button>
      </div>

      {showChat && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
            <button onClick={() => setShowChat(false)} className="p-2 -ml-2">
              <ChevronRight className="w-6 h-6 text-gray-900 rotate-180" />
            </button>
            <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center ml-2">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3">
              <p className="font-bold text-sm text-gray-900">Asistente HappiWalk</p>
              <p className="text-xs text-emerald-500">
                {isWalker ? 'Modo Paseador' : 'Modo Dueño'} · En línea
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            {chatMessages.map((msg, index) => (
              <div key={index} className={`mb-2 flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-line ${
                    msg.isUser
                      ? 'bg-gray-900 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            <button
              onClick={() => handleWhatsApp()}
              className="mx-auto mt-4 bg-emerald-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-emerald-600"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
              </svg>
              Hablar con una persona
            </button>
          </div>

          <div className="bg-white border-t border-gray-200 p-3 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Escribe tu pregunta..."
              className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none"
            />
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim()}
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                chatInput.trim() ? 'bg-gray-900' : 'bg-gray-200'
              }`}
            >
              <Send className={`w-5 h-5 ${chatInput.trim() ? 'text-white' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
