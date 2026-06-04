export const normalize = (s) =>
  s.toLowerCase()
   .normalize('NFD')
   .replace(/[\u0300-\u036f]/g, '')
   .replace(/[¿¡?!.,;]/g, '')
   .trim();

export function matchBotPattern(msg, patterns) {
  const normalized = normalize(msg);
  if (!normalized) return null;
  const sorted = [...patterns].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const pattern of sorted) {
    if (pattern.keywords.some(k => normalized.includes(normalize(k)))) {
      return pattern.response;
    }
  }
  return null;
}

const FALLBACK_FIRST = '🤔 No estoy seguro de cómo ayudarte con eso. Probá reformulando o usá los botones rápidos de abajo para ver preguntas comunes.';

const FALLBACK_SECOND = '🤔 Parece que no estoy encontrando la respuesta. ¿Querés que te derive a WhatsApp? Le voy a mandar el contexto de lo que preguntaste para que te respondan más rápido.';

export function getFallbackResponse(noMatchCount) {
  return noMatchCount >= 1 ? FALLBACK_SECOND : FALLBACK_FIRST;
}

export const OWNER_PATTERNS = [
  {
    keywords: ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'hello', 'que tal'],
    response: '¡Hola! 👋 Soy el asistente para dueños de HappiWalk. Puedo ayudarte con:\n\n• Reservar paseos\n• Ver la ubicación de tu mascota\n• Pagos, reembolsos y billetera\n• Gestión de mascotas\n• Propinas, calificaciones, reportar\n• Problemas técnicos\n\nTocá un botón rápido abajo o escribí tu pregunta.',
    priority: 5,
  },
  {
    keywords: ['hablar con una persona', 'hablar con alguien', 'agente humano', 'persona real', 'operador', 'asesor', 'humano', 'atencion al cliente'],
    response: '👨‍💼 Perfecto, te derivo a una persona real. Tocá el botón de WhatsApp abajo y te respondemos en minutos.',
    priority: 10,
  },
  {
    keywords: ['paseador', 'walker', 'walkers', 'disponible', 'hay alguien', 'no hay', 'no encuentro', 'donde estan'],
    response: '🐕 Para ver paseadores disponibles: "Reservar un Paseo" → mascotas, fecha y hora → lista de paseadores. Si no hay, probá con otra fecha.',
  },
  {
    keywords: ['reservar', 'agendar', 'pedir', 'quiero un paseo', 'como pido', 'solicitar', 'contratar', 'nueva reserva'],
    response: '📅 Para reservar: "Reservar un Paseo" → mascotas → fecha/hora → paseador → confirmar pago. Recibirás confirmación push al instante.',
  },
  {
    keywords: ['cancelar', 'devolver', 'reembolso', 'no puedo ir', 'anular', 'me arrepenti'],
    response: '❌ Política: >2h antes reembolso 100%, <2h antes cargo 50%, paseo iniciado sin reembolso. Para cancelar: Mis Reservas → seleccionar → Cancelar.',
  },
  {
    keywords: ['precio', 'cuanto cuesta', 'cuesta', 'costo', 'tarifa', 'cuanto sale', 'valor'],
    response: '💰 El costo varía según duración y número de mascotas. Verás el precio exacto antes de confirmar. Sin costos ocultos.',
  },
  {
    keywords: ['metodo de pago', 'metodos de pago', 'como pago', 'nequi', 'bancolombia', 'daviplata', 'mercadopago', 'tarjeta', 'pse', 'efectivo'],
    response: '💳 Métodos aceptados: Mercado Pago (tarjeta crédito/débito), Nequi, Bancolombia (transferencia). No aceptamos efectivo. Para agregar fondos: Perfil → Mi Billetera → Agregar Fondos.',
  },
  {
    keywords: ['billetera', 'saldo', 'recargar', 'agregar fondos', 'agregar dinero', 'cargar saldo', 'fondos'],
    response: '💰 Mi Billetera: Perfil → Mi Billetera → Agregar Fondos → elegí monto y método → confirmar. Saldo disponible inmediato.',
  },
  {
    keywords: ['ubicacion', 'donde esta', 'donde quedo', 'gps', 'rastrear', 'seguimiento', 'en vivo', 'mapa', 'rastreo'],
    response: '🗺️ Una vez el dueño confirma la recogida, abrís el mapa en vivo. Verás ruta, distancia y tiempo. El paseador también sube fotos.',
  },
  {
    keywords: ['compartir', 'compartir tracking', 'compartir recorrido', 'familia', 'mi mama', 'mi papa', 'esposo', 'esposa', 'link'],
    response: '👥 Compartir tracking: Abrí "Ver Walk en Vivo" → botón Compartir arriba → elegí WhatsApp, SMS o cualquier app. Tu familiar ve la ruta sin tener cuenta.',
  },
  {
    keywords: ['mascota', 'perro', 'gato', 'agregar', 'nueva mascota', 'perros', 'gatos'],
    response: '🐾 Mis Mascotas → Agregar Mascota. Datos: raza, edad, peso, comportamiento (tímido, sociable, agresivo), foto reciente.',
  },
  {
    keywords: ['mascota agresiva', 'mordio', 'muerde', 'agresivo', 'peligroso', 'cuidado especial'],
    response: '⚠️ Marcalo SIEMPRE en el perfil. El paseador puede rechazar el paseo sin penalización. Para razas grandes o con historial, pedí paseadores con experiencia.',
  },
  {
    keywords: ['emergencia', 'urgencia', 'se lastimo', 'se escapo', 'accidente', 'perro herido', 'gato herido', '911', '123', 'veterinario', 'veterinaria'],
    response: '🚨 EMERGENCIA:\n\n1. Si hay peligro inmediato: llamá al 123 o a tu veterinaria\n2. Avisanos YA por WhatsApp: +57 321 907 8042\n3. Si el paseo está en curso, abrí la pantalla del paseo → "Reportar emergencia"\n\nGuardá este número en tus contactos.',
    priority: 20,
  },
  {
    keywords: ['reportar', 'reporte', 'denunciar', 'queja', 'mal comportamiento', 'paseador malo', 'problema con paseador'],
    response: '🚨 Para reportar: Historial de Paseos → seleccionar paseo → "Reportar problema". Investigamos en 24-48h. Si es grave, suspendemos al paseador.',
  },
  {
    keywords: ['calificar', 'calificacion', 'estrellas', 'reseña', 'review', 'opinion', 'puntuacion', 'rating'],
    response: '⭐ Después de cada paseo aparece la pantalla de calificación automática: 1-5 estrellas + comentario opcional. Tu calificación ayuda a la comunidad.',
  },
  {
    keywords: ['propina', 'propinas', 'tip', 'tips', 'dejar propina', 'agradezco', 'recompensar'],
    response: '💝 Sí, podés dejar propina: pantalla de calificación → campo "Propina" → elegí monto ($2000, $5000, $10000 o personalizado). Se descuenta de tu billetera. 100% va al paseador.',
  },
  {
    keywords: ['foto', 'fotos', 'imagen', 'selfie', 'imagenes del paseo'],
    response: '📸 El paseador puede subir fotos durante el recorrido. Las ves en tiempo real en Paseos Activos y quedan en el historial.',
  },
  {
    keywords: ['verificado', 'seguro', 'antecedentes', 'confiable', 'de confianza'],
    response: '✅ Los paseadores verificados tienen: documento validado, antecedentes revisados, identidad confirmada, entrevista personal. Aparecen con badge azul.',
  },
  {
    keywords: ['no llega', 'tarde', 'demora', 'no aparece', 'todavia no', 'no ha llegado', 'se demora'],
    response: '⏰ Si el paseador se demora: 1) Mensaje por chat, 2) Esperá 15 min desde la hora, 3) Cancelá sin cargo si no aparece, 4) Te ayudamos a buscar otro.',
  },
  {
    keywords: ['horario', 'horarios', 'hora', 'a que hora', 'cuando pueden', 'disponible horario'],
    response: '🕐 Paseos todos los días 6am-9pm. Disponibilidad exacta depende de tu zona. Reservá con hasta 7 días de anticipación o pedí "para ahora".',
  },
  {
    keywords: ['error', 'bug', 'falla', 'no funciona', 'crashea', 'se cierra', 'problema tecnico', 'no carga'],
    response: '🔧 Probá: 1) refrescar la página, 2) cerrar sesión y volver a entrar, 3) otro navegador, 4) reiniciar el equipo. Si persiste, escribinos por WhatsApp con modelo + navegador + captura.',
  },
  {
    keywords: ['cuenta', 'perfil', 'nombre', 'email', 'contrasena', 'datos', 'cambiar', 'editar', 'actualizar'],
    response: '👤 Editar perfil: Perfil → Editar Información Personal. Para cambiar email o contraseña, escribinos por WhatsApp con tu documento.',
  },
  {
    keywords: ['cerrar sesion', 'salir', 'logout', 'eliminar cuenta', 'borrar cuenta'],
    response: '👋 Cerrar sesión: Perfil (abajo) → Cerrar Sesión. Para eliminar tu cuenta: escribinos por WhatsApp. Procesamos en 5 días hábiles.',
  },
  {
    keywords: ['gracias', 'muchas gracias', 'genial', 'perfecto', 'excelente', 'listo', 'ok gracias'],
    response: '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?',
  },
];

export const WALKER_PATTERNS = [
  {
    keywords: ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'hello', 'que tal'],
    response: '¡Hola! 👋 Soy el asistente para paseadores de HappiWalk. Puedo ayudarte con:\n\n• Aceptar paseos\n• GPS y tracking\n• Ganancias, retiros, comisiones\n• Verificación de documentos\n• Subir fotos, emergencias, reportar\n• Problemas técnicos\n\nTocá un botón rápido abajo o escribí tu pregunta.',
    priority: 5,
  },
  {
    keywords: ['hablar con una persona', 'hablar con alguien', 'agente humano', 'persona real', 'operador', 'asesor', 'humano', 'atencion al cliente', 'supervisor'],
    response: '👨‍💼 Perfecto, te derivo a una persona real. Tocá el botón de WhatsApp abajo y te respondemos entre 7am y 9pm.',
    priority: 10,
  },
  {
    keywords: ['aceptar', 'nuevo paseo', 'tengo una reserva', 'como acepto', 'llego notificacion', 'me llego'],
    response: '✅ Para aceptar: notificación push → Home → "Por Aceptar" → revisar datos → "Aceptar Paseo". Tenés 5 minutos.',
  },
  {
    keywords: ['gps', 'ubicacion', 'activar', 'tracking', 'rastreo', 'rastrear', 'se activo'],
    response: '📡 GPS automático: cuando el dueño confirma la recogida, la app móvil activa GPS después de 4 segundos. Si no: reserva → "Iniciar Paseo GPS" manualmente. Si no se activa: Ajustes → Apps → HappiWalk → Ubicación → "Siempre".',
  },
  {
    keywords: ['pago', 'cuando pagan', 'cuanto pagan', 'ganancia', 'ganancias', 'retiro', 'retirar', 'saldo', 'plata', 'comision', 'comisiones'],
    response: '💰 80% del paseo es para vos (HappiWalk retiene 20%). Se acumula en Mis Ganancias al completar. Retiro mínimo $20.000 COP a Nequi, Bancolombia, Davivienda. Llega en 1-3 días.',
  },
  {
    keywords: ['aumentar ganancias', 'ganar mas', 'mas paseos', 'mas clientes', 'mas reservas', 'consejos'],
    response: '💡 Tips: 1) Online más horas (7-9am, 5-7pm), 2) Aceptá rápido (<2min), 3) 5 estrellas (puntual, fotos, comunicación), 4) GPS siempre activo, 5) Perfil completo. Top walkers ganan $1.5M-2.5M COP/mes.',
  },
  {
    keywords: ['verificacion', 'verificar', 'verificarme', 'documento', 'documentos', 'cedula', 'c.c.', 'antecedentes', 'selfie'],
    response: '✅ Verificación: Perfil → Verificación → cédula (frontal y trasera) + selfie con documento → revisión 24-48h hábiles → aviso por WhatsApp. Sin verificación NO aparecés en búsquedas.',
  },
  {
    keywords: ['verificacion rechazada', 'no me verificaron', 'rechazado', 'no paso', 'por que rechazaron'],
    response: '❌ Te avisamos el motivo por WhatsApp. Causas comunes: foto borrosa, selfie sin documento, datos no coinciden. Corregí y volvé a subir.',
  },
  {
    keywords: ['cancelar', 'no puedo', 'no voy', 'anular', 'me arrepenti', 'tengo que cancelar'],
    response: '❌ Cancelá solo en emergencias. <2h antes afecta tu ranking. 2+ al mes = perdés prioridad. Si es emergencia: reserva → Cancelar → avisá al dueño por chat.',
  },
  {
    keywords: ['finalizar', 'terminar', 'acabar', 'concluir', 'como finalizo', 'ya termine'],
    response: '🏁 Finalizar: reserva activa → "Finalizar Paseo" → confirmar. Guarda duración, distancia y ruta. El dueño te califica. NO cierres la app antes de ver "Paseo finalizado".',
  },
  {
    keywords: ['dueno', 'propietario', 'cliente', 'no contesta', 'no responde', 'no me abre', 'no esta'],
    response: '📞 Si el dueño no contesta: 1) Esperá 10 min, 2) Mensaje por chat, 3) Después de 15 min contactanos por WhatsApp para liberar la reserva (se te paga el tiempo de espera).',
  },
  {
    keywords: ['subir foto', 'subir fotos', 'foto durante', 'mando foto', 'como subo', 'camara'],
    response: '📸 Sí podés: pantalla del paseo activo → botón cámara 📷 → sacá foto → se sube automáticamente. El dueño la ve en tiempo real y recibe notificación. Sube tu rating.',
  },
  {
    keywords: ['mascota agresiva', 'mordio', 'muerde', 'agresivo', 'peligrosa', 'me ataco', 'rechazar mascota'],
    response: '⚠️ Si la mascota es agresiva: 1) NO la manipules, 2) Finalizá el paseo anticipadamente, 3) Se te paga el tiempo trabajado, 4) Reportá por WhatsApp, 5) Sugerí marcar agresiva en su perfil.',
  },
  {
    keywords: ['emergencia', 'urgencia', 'se lastimo', 'se escapo', 'accidente', 'perro herido', 'gato herido', '911', '123', 'veterinario'],
    response: '🚨 EMERGENCIA: 1) Peligro inmediato: llamá al 123, 2) Contactá al dueño por chat, 3) Avisanos por WhatsApp: +57 321 907 8042, 4) Si se lastimó, veterinaria más cercana (dueño reembolsa).',
    priority: 20,
  },
  {
    keywords: ['reportar dueno', 'reportar cliente', 'denunciar dueno', 'bloquear dueno', 'mal dueno', 'problema con dueno'],
    response: '🚫 Chat de la reserva → menú (3 puntos) → "Reportar usuario" o "Bloquear". Investigamos en 24-48h. Gravedad = suspensión del dueño.',
  },
  {
    keywords: ['foto perfil', 'cambiar foto', 'mi foto', 'subir mi foto', 'foto de perfil', 'avatar'],
    response: '📷 Perfil → Editar → tocá tu foto → "Tomar foto" o "Elegir de galería" → ajustá → guardar. Foto profesional sube tu tasa de aceptación.',
  },
  {
    keywords: ['notificacion', 'notificaciones', 'no me llegan', 'no suena', 'no vibra', 'push'],
    response: '🔔 Si no te llegan: 1) Ajustes del teléfono → Apps → HappiWalk → Notificaciones (activadas), 2) "Sin restricciones" en datos, 3) No molestar desactivado, 4) App en background.',
  },
  {
    keywords: ['no me deja escribir', 'chat no funciona', 'no puedo chatear', 'problema chat', 'mensaje no envia'],
    response: '💬 Si el chat no funciona: 1) Verificá internet, 2) Cerrá y abrí la app, 3) Si dice "Enviando..." mucho, tocá reintentar, 4) Si persiste: WhatsApp y usamos otro canal.',
  },
  {
    keywords: ['ranking', 'calificacion', 'estrellas', 'puntuacion', 'rating', 'posicion'],
    response: '⭐ Tu ranking sube con: paseos completados, ratings 5 estrellas, GPS activo, respuestas rápidas, fotos, buena comunicación. Ranking alto = más paseos y mejores dueños.',
  },
  {
    keywords: ['zona', 'area', 'trabajo', 'cambiar ciudad', 'mudanza', 'mudarme'],
    response: '📍 Cambiar zona: Perfil → Editar → actualizá dirección → guardar. Si te mudás, los paseos disponibles cambian automáticamente.',
  },
  {
    keywords: ['error', 'bug', 'falla', 'no funciona', 'crashea', 'se cierra', 'problema tecnico', 'no carga'],
    response: '🔧 Probá: 1) refrescar, 2) cerrar sesión, 3) verificar permisos ubicación, 4) actualizar app, 5) reiniciar teléfono. Si persiste, WhatsApp con modelo + versión + captura.',
  },
  {
    keywords: ['gracias', 'muchas gracias', 'genial', 'perfecto', 'excelente', 'listo', 'ok gracias'],
    response: '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?',
  },
];

export const OWNER_QUICK_REPLIES = [
  { label: '¿Cómo reservo?', message: '¿Cómo reservo un paseo?' },
  { label: 'Ver a mi mascota', message: '¿Cómo veo a mi mascota en vivo?' },
  { label: 'Reembolso', message: '¿Cómo obtengo un reembolso?' },
  { label: 'Paseador no llega', message: '¿Qué hago si el paseador no llega?' },
  { label: 'Propinas', message: '¿Cómo dejo propina?' },
  { label: 'Hablar con humano', message: 'Quiero hablar con una persona' },
];

export const WALKER_QUICK_REPLIES = [
  { label: 'Aceptar paseo', message: '¿Cómo acepto un paseo?' },
  { label: 'Iniciar GPS', message: '¿Cómo inicio el GPS?' },
  { label: 'Cuándo pagan', message: '¿Cuándo me pagan?' },
  { label: 'Verificarme', message: '¿Cómo me verifico?' },
  { label: 'Mascota agresiva', message: '¿Qué hago si la mascota es agresiva?' },
  { label: 'Hablar con humano', message: 'Quiero hablar con una persona' },
];

export function buildContextMessage(messages, role) {
  const recentUserMessages = messages
    .filter(m => m.isUser)
    .slice(-3)
    .map(m => m.text)
    .join(' / ');
  const prefix = role === 'walker' ? 'Hola, soy paseador de HappiWalk.' : 'Hola, soy dueño en HappiWalk.';
  return `${prefix} El asistente no pudo ayudarme con: "${recentUserMessages}"`;
}
