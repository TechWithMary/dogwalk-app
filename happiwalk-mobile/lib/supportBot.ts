export interface BotPattern {
  keywords: string[];
  response: string;
  priority?: number;
}

export interface QuickReply {
  label: string;
  message: string;
}

const normalize = (s: string): string =>
  s.toLowerCase()
   .normalize('NFD')
   .replace(/[\u0300-\u036f]/g, '')
   .replace(/[¿¡]/g, '')
   .replace(/[?!.,;]/g, '')
   .trim();

export function matchBotPattern(msg: string, patterns: BotPattern[]): string | null {
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

export function getFallbackResponse(noMatchCount: number): string {
  return noMatchCount >= 1 ? FALLBACK_SECOND : FALLBACK_FIRST;
}

export const OWNER_PATTERNS: BotPattern[] = [
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
    response: '🐕 Para ver paseadores disponibles:\n\n1. Ve a "Reservar un Paseo"\n2. Selecciona mascotas, fecha y hora\n3. Verás la lista de paseadores disponibles para esa fecha/hora\n\n💡 Tip: Si no hay, prueba otra fecha u horario. Los paseadores mejor calificados aparecen primero.',
  },
  {
    keywords: ['reservar', 'agendar', 'pedir', 'quiero un paseo', 'como pido', 'solicitar', 'contratar', 'nueva reserva'],
    response: '📅 Para reservar un paseo:\n\n1. Toca "Reservar un Paseo" en la pantalla principal\n2. Selecciona tu(s) mascota(s)\n3. Elige fecha y hora\n4. Selecciona un paseador de la lista\n5. Confirma el pago\n\n✅ Recibirás confirmación push al instante.',
  },
  {
    keywords: ['cancelar', 'devolver', 'reembolso', 'no puedo ir', 'anular', 'me arrepenti'],
    response: '❌ Política de cancelación:\n\n• Más de 2h antes: reembolso 100%\n• Menos de 2h antes: cargo del 50%\n• Paseo en curso: no aplica reembolso\n\nPara cancelar: "Mis Reservas" → selecciona el paseo → "Cancelar Reserva".\n\nSi es una emergencia, escribinos por WhatsApp y evaluamos el caso.',
  },
  {
    keywords: ['precio', 'cuanto cuesta', 'cuesta', 'costo', 'tarifa', 'cuanto sale', 'valor'],
    response: '💰 El costo del paseo:\n\n• Varía según la duración y el número de mascotas\n• Verás el precio exacto antes de confirmar tu reserva\n• No hay costos ocultos ni cargos extra\n\nUn paseo de 1 hora con 1 mascota suele estar entre $15.000 y $25.000 COP según tu zona.',
  },
  {
    keywords: ['metodo de pago', 'metodos de pago', 'como pago', 'nequi', 'bancolombia', 'daviplata', 'mercadopago', 'tarjeta', 'pse', 'efectivo'],
    response: '💳 Métodos de pago aceptados:\n\n• Mercado Pago (tarjeta crédito/débito)\n• Nequi\n• Bancolombia (transferencia)\n\nPara agregar fondos: Perfil → "Mi Billetera" → "Agregar Fondos".\n\nNo aceptamos efectivo. El pago siempre se hace dentro de la app.',
  },
  {
    keywords: ['billetera', 'saldo', 'recargar', 'agregar fondos', 'agregar dinero', 'cargar saldo', 'fondos'],
    response: '💰 Mi Billetera:\n\n1. Perfil → "Mi Billetera"\n2. Toca "Agregar Fondos"\n3. Elige el monto y el método de pago\n4. Confirma\n\nTu saldo queda disponible inmediatamente. Se descuenta automáticamente al confirmar un paseo.',
  },
  {
    keywords: ['ubicacion', 'donde esta', 'donde quedo', 'gps', 'rastrear', 'seguimiento', 'en vivo', 'mapa', 'rastreo'],
    response: '🗺️ Seguimiento en vivo:\n\n1. Espera a que el paseador llegue al punto de recogida\n2. Toca "Confirmar Recogida" en los detalles del paseo\n3. La app abre automáticamente el mapa en vivo\n4. Verás ruta, distancia y tiempo en tiempo real\n\n📸 El paseador también puede subir fotos durante el recorrido.',
  },
  {
    keywords: ['compartir', 'compartir tracking', 'compartir recorrido', 'familia', 'mi mama', 'mi papa', 'esposo', 'esposa', 'link'],
    response: '👥 Compartir tracking con familia:\n\n1. Abre la pantalla "Ver Walk en Vivo"\n2. Toca el botón "Compartir" (icono arriba)\n3. Elige por WhatsApp, SMS o cualquier app\n4. Tu familiar podrá ver la ruta en tiempo real sin tener cuenta',
  },
  {
    keywords: ['mascota', 'perro', 'gato', 'agregar', 'nueva mascota', 'perros', 'gatos'],
    response: '🐾 Para gestionar tus mascotas:\n\nInicio → "Mis Mascotas" → "Agregar Mascota"\n\nDatos importantes:\n• Nombre, raza, edad, peso\n• Comportamiento (tímido, sociable, tira de la correa)\n• Si le tiene miedo a otros perros o personas\n• Si es agresivo (marcarlo siempre por seguridad)\n• Foto reciente',
  },
  {
    keywords: ['mascota agresiva', 'mordio', 'muerde', 'agresivo', 'peligroso', 'cuidado especial'],
    response: '⚠️ Mascotas agresivas:\n\n• Marcalo SIEMPRE en el perfil de la mascota (campo "Comportamiento")\n• El paseador puede rechazar el paseo sin penalización si la mascota es agresiva\n• Para razas grandes o con historial, solicitá paseadores con experiencia específica\n\nEsto protege a tu mascota, al paseador y a otros perros.',
  },
  {
    keywords: ['emergencia', 'urgencia', 'se lastimo', 'se escapo', 'accidente', 'perro herido', 'gato herido', '911', '123', 'veterinario', 'veterinaria'],
    response: '🚨 EMERGENCIA:\n\n1. Si tu mascota o alguien está en peligro inmediato: llamá al 123 (emergencias) o a tu veterinaria de confianza\n2. Avisanos INMEDIATAMENTE por WhatsApp: +57 321 907 8042\n3. Si el paseo está en curso, abrí la pantalla del paseo y tocá "Reportar emergencia"\n\nGuardá este número en tus contactos.',
    priority: 20,
  },
  {
    keywords: ['reportar', 'reporte', 'denunciar', 'queja', 'mal comportamiento', 'paseador malo', 'problema con paseador'],
    response: '🚨 Para reportar un paseador:\n\n1. Andá a "Historial de Paseos"\n2. Selecciona el paseo en cuestión\n3. Toca "Reportar problema"\n4. Contanos qué pasó (incluí fotos si podés)\n\nInvestigamos en 24-48h hábiles. Si la falta es grave, suspendemos al paseador de inmediato.',
  },
  {
    keywords: ['calificar', 'calificacion', 'estrellas', 'reseña', 'review', 'opinion', 'puntuacion', 'rating'],
    response: '⭐ Después de cada paseo:\n\n1. Te aparece la pantalla de calificación automáticamente\n2. Elegí entre 1 y 5 estrellas\n3. Comentario opcional\n4. Toca "Enviar"\n\nTu calificación ayuda a otros dueños a elegir buenos paseadores y a mantener la calidad de la plataforma.',
  },
  {
    keywords: ['propina', 'propinas', 'tip', 'tips', 'dejar propina', 'agradezco', 'recompensar'],
    response: '💝 Propinas:\n\nSí, podés dejar propina al paseador después del paseo:\n1. En la pantalla de calificación hay un campo "Propina"\n2. Elegí el monto ($2000, $5000, $10000 o personalizado)\n3. Se descuenta de tu billetera\n4. El 100% va al paseador (sin comisión)',
  },
  {
    keywords: ['foto', 'fotos', 'imagen', 'selfie', 'imagenes del paseo'],
    response: '📸 Fotos durante el paseo:\n\n• El paseador puede subir fotos durante el recorrido\n• Las ves en tiempo real en "Paseos Activos"\n• Quedan guardadas en el historial después\n• Recibís notificación push cuando sube una nueva',
  },
  {
    keywords: ['verificado', 'seguro', 'antecedentes', 'confiable', 'de confianza'],
    response: '✅ Los paseadores verificados tienen:\n\n• Documento de identidad validado\n• Antecedentes revisados\n• Identidad confirmada por selfie\n• Entrevista con nuestro equipo\n\nAparecen con badge azul ✓. Recomendamos siempre elegir paseadores verificados para mayor seguridad.',
  },
  {
    keywords: ['no llega', 'tarde', 'demora', 'no aparece', 'todavia no', 'no ha llegado', 'se demora'],
    response: '⏰ Si el paseador se demora o no llega:\n\n1. Enviále un mensaje por el chat de la reserva\n2. Esperá 15 minutos desde la hora acordada\n3. Si no aparece, podés cancelar sin cargo\n4. Te ayudamos a buscar otro paseador disponible\n\nSi fue un paseo de último momento, podés ver paseadores online ahora en la app.',
  },
  {
    keywords: ['horario', 'horarios', 'hora', 'a que hora', 'cuando pueden', 'disponible horario'],
    response: '🕐 Horarios:\n\n• Los paseos están disponibles todos los días, 6am a 9pm\n• La disponibilidad exacta depende de los paseadores en tu zona\n• Podés reservar con hasta 7 días de anticipación\n• También hay paseos "para ahora" si hay paseadores online',
  },
  {
    keywords: ['error', 'bug', 'falla', 'no funciona', 'crashea', 'se cierra', 'problema tecnico', 'no carga'],
    response: '🔧 Solución de problemas:\n\n1. Cierra completamente la app y vuelve a abrir\n2. Verificá tu conexión a internet\n3. Actualizá desde App Store / Play Store\n4. Reiniciá el teléfono\n\nSi persiste, escribinos por WhatsApp con:\n• Modelo del celular\n• Captura del error\n• Qué estabas haciendo cuando pasó',
  },
  {
    keywords: ['cuenta', 'perfil', 'nombre', 'email', 'contrasena', 'datos', 'cambiar', 'editar', 'actualizar'],
    response: '👤 Editar perfil:\n\nPerfil → "Editar Información Personal"\n\nPodés actualizar: nombre, teléfono, dirección, foto de perfil.\n\nPara cambiar email o contraseña: escribinos por WhatsApp con tu documento de identidad.',
  },
  {
    keywords: ['cerrar sesion', 'salir', 'logout', 'eliminar cuenta', 'borrar cuenta'],
    response: '👋 Cerrar sesión:\n\nPerfil (abajo) → "Cerrar Sesión"\n\nPara eliminar tu cuenta: escribinos por WhatsApp. Procesamos la solicitud en 5 días hábiles.',
  },
  {
    keywords: ['gracias', 'muchas gracias', 'genial', 'perfecto', 'excelente', 'listo', 'ok gracias'],
    response: '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?',
  },
];

export const WALKER_PATTERNS: BotPattern[] = [
  {
    keywords: ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'hello', 'que tal'],
    response: '¡Hola! 👋 Soy el asistente para paseadores de HappiWalk. Puedo ayudarte con:\n\n• Aceptar paseos\n• GPS y tracking\n• Ganancias, retiros, comisiones\n• Verificación de documentos\n• Subir fotos, emergencias, reportar\n• Problemas técnicos\n\nTocá un botón rápido abajo o escribí tu pregunta.',
    priority: 5,
  },
  {
    keywords: ['hablar con una persona', 'hablar con alguien', 'agente humano', 'persona real', 'operador', 'asesor', 'humano', 'atencion al cliente', 'supervisor'],
    response: '👨‍💼 Perfecto, te derivo a una persona real. Tocá el botón de WhatsApp abajo y te respondemos entre 7am y 9pm. Fuera de horario, te contestamos al día siguiente.',
    priority: 10,
  },
  {
    keywords: ['aceptar', 'nuevo paseo', 'tengo una reserva', 'como acepto', 'llego notificacion', 'me llego'],
    response: '✅ Para aceptar un paseo:\n\n1. Llega una notificación push cuando un dueño reserva contigo\n2. Abrí la app → tab "Home" → "Por Aceptar"\n3. Revisá mascota, dirección y hora\n4. Toca "Aceptar Paseo"\n\n⏰ Tenés 5 minutos para aceptar o se libera al siguiente paseador.',
  },
  {
    keywords: ['gps', 'ubicacion', 'activar', 'tracking', 'rastreo', 'rastrear', 'se activo'],
    response: '📡 GPS automático:\n\nCuando el dueño confirma la recogida, la app activa el GPS automáticamente después de 4 segundos. No tenés que hacer nada.\n\nSi el dueño no confirma:\n1. Abrí la reserva activa\n2. Toca "Iniciar Paseo GPS" manualmente\n3. Esperá que se conecte\n\n💡 Si no se activa: Ajustes del teléfono → Apps → HappiWalk → Ubicación → "Siempre".',
  },
  {
    keywords: ['pago', 'cuando pagan', 'cuanto pagan', 'ganancia', 'ganancias', 'retiro', 'retirar', 'saldo', 'plata', 'comision', 'comisiones'],
    response: '💰 Tus ganancias:\n\n• El 80% del valor del paseo es para vos\n• HappiWalk retiene el 20% como comisión\n• Se acumula en "Mis Ganancias" al completar cada paseo\n• Retiro mínimo: $20.000 COP\n• Métodos: Nequi, Bancolombia, Davivienda\n\nPara retirar: Perfil → "Mis Ganancias" → "Solicitar Retiro".\n\nEl dinero llega en 1-3 días hábiles.',
  },
  {
    keywords: ['aumentar ganancias', 'ganar mas', 'mas paseos', 'mas clientes', 'mas reservas', 'consejos'],
    response: '💡 Tips para ganar más:\n\n1. Mantenete online más horas (sobre todo 7-9am y 5-7pm)\n2. Aceptá rápido (los que aceptan en <2 min tienen prioridad)\n3. Conseguí 5 estrellas: llegá puntual, fotos, comunicación\n4. Activá el GPS apenas confirmes la recogida (mejora tu rating)\n5. Hacé que tu perfil destaque: foto profesional, bio completa\n\nPaseadores top ganan $1.5M-2.5M COP/mes con 2-3 paseos diarios.',
  },
  {
    keywords: ['verificacion', 'verificar', 'verificarme', 'documento', 'documentos', 'cedula', 'c.c.', 'antecedentes', 'selfie'],
    response: '✅ Verificación:\n\n1. Perfil → "Verificación"\n2. Subí tu cédula (frontal y trasera, bien iluminada)\n3. Subí una selfie sosteniendo el documento\n4. Nuestro equipo revisa en 24-48h hábiles\n5. Te avisamos por WhatsApp\n\nHasta estar verificado, NO aparecés en búsquedas de dueños.',
  },
  {
    keywords: ['verificacion rechazada', 'no me verificaron', 'rechazado', 'no paso', 'por que rechazaron'],
    response: '❌ Verificación rechazada:\n\nTe avisamos el motivo por WhatsApp. Las causas más comunes:\n• Foto borrosa o cortada del documento\n• Selfie sin documento visible\n• Datos no coinciden\n\nPodés corregir y volver a subir los documentos desde Perfil → Verificación.',
  },
  {
    keywords: ['cancelar', 'no puedo', 'no voy', 'anular', 'me arrepenti', 'tengo que cancelar'],
    response: '❌ Cancelaciones:\n\n• Cancelá solo en emergencias reales\n• Cancelar con <2h antes afecta tu ranking\n• 2+ cancelaciones al mes = perdés prioridad en reservas\n• Si es emergencia real: abrí la reserva → "Cancelar" → avisale al dueño por chat\n\nRecordá que cada cancelación suma una estrella negra en tu perfil.',
  },
  {
    keywords: ['finalizar', 'terminar', 'acabar', 'concluir', 'como finalizo', 'ya termine'],
    response: '🏁 Para finalizar un paseo:\n\n1. Abrí la reserva activa\n2. Toca "Finalizar Paseo"\n3. Confirmá\n4. La app guarda duración, distancia y ruta\n5. El dueño te califica y recibís tu pago\n\n⚠️ No cierres la app hasta ver "Paseo finalizado". Si se cierra antes, contactanos por WhatsApp.',
  },
  {
    keywords: ['dueno', 'propietario', 'cliente', 'no contesta', 'no responde', 'no me abre', 'no esta'],
    response: '📞 Si el dueño no contesta al llegar:\n\n1. Esperá 10 minutos en el punto de recogida\n2. Envíale un mensaje por el chat de la app\n3. Si después de 15 min no responde, contactanos por WhatsApp para que liberemos la reserva o te asignemos otro paseo (se te paga el tiempo de espera)',
  },
  {
    keywords: ['subir foto', 'subir fotos', 'foto durante', 'mando foto', 'como subo', 'camara'],
    response: '📸 Sí podés subir fotos durante el paseo:\n\n1. En la pantalla del paseo activo hay un botón de cámara 📷\n2. Sacá la foto (la mascota, el parque, lo que quieras)\n3. Se sube automáticamente\n4. El dueño la ve en tiempo real y recibe notificación\n\nLas fotos suben tu rating (los dueños valoran mucho ver cómo va el paseo).',
  },
  {
    keywords: ['mascota agresiva', 'mordio', 'muerde', 'agresivo', 'peligrosa', 'me ataco', 'rechazar mascota'],
    response: '⚠️ Si la mascota es agresiva:\n\n1. NO la manipules si ves riesgo\n2. Finalizá el paseo ANTICIPADAMENTE (botón en la reserva)\n3. Se te paga el tiempo trabajado (no se te penaliza)\n4. Reportá el incidente por WhatsApp\n5. Sugerí al dueño que marque a la mascota como agresiva en su perfil',
  },
  {
    keywords: ['emergencia', 'urgencia', 'se lastimo', 'se escapo', 'accidente', 'perro herido', 'gato herido', '911', '123', 'veterinario'],
    response: '🚨 EMERGENCIA durante un paseo:\n\n1. Si la mascota o alguien está en peligro inmediato: llamá al 123\n2. Contactá al dueño por chat inmediatamente\n3. Avisanos por WhatsApp: +57 321 907 8042\n4. Si la mascota se lastimó, llevala a la veterinaria más cercana (el dueño reembolsa)\n\nGuardá este número en tus contactos.',
    priority: 20,
  },
  {
    keywords: ['reportar dueno', 'reportar cliente', 'denunciar dueno', 'bloquear dueno', 'mal dueno', 'problema con dueno'],
    response: '🚫 Para reportar o bloquear un dueño:\n\n1. Abrí el chat de la reserva\n2. Tocá el menú (3 puntos arriba)\n3. Elegí "Reportar usuario" o "Bloquear"\n\nInvestigamos cada reporte en 24-48h. Si hay comportamiento grave, suspendemos al dueño.',
  },
  {
    keywords: ['foto perfil', 'cambiar foto', 'mi foto', 'subir mi foto', 'foto de perfil', 'avatar'],
    response: '📷 Cambiar foto de perfil:\n\n1. Perfil → "Editar Información Personal"\n2. Tocá tu foto actual\n3. Elegí "Tomar foto" o "Elegir de galería"\n4. Ajustá y guardá\n\nUna foto profesional (con tu cara visible y bien iluminada) sube mucho tu tasa de aceptación.',
  },
  {
    keywords: ['notificacion', 'notificaciones', 'no me llegan', 'no suena', 'no vibra', 'push'],
    response: '🔔 Si no te llegan notificaciones de nuevos paseos:\n\n1. Ajustes del teléfono → Apps → HappiWalk → Notificaciones (todas activadas)\n2. Ajustes del teléfono → Apps → HappiWalk → Uso de datos → "Sin restricciones"\n3. Que tu modo "No molestar" no esté activo\n4. Que la app esté abierta en background (no la cierres de la multitasking)\n5. Si persiste, desinstalá y reinstalá',
  },
  {
    keywords: ['no me deja escribir', 'chat no funciona', 'no puedo chatear', 'problema chat', 'mensaje no envia'],
    response: '💬 Si el chat no funciona:\n\n1. Verificá tu conexión a internet\n2. Cerrá la app y volvé a abrir\n3. Si ves "Enviando..." mucho tiempo, el mensaje falló: tocá reintentar\n4. Si persiste, contactanos por WhatsApp y usamos otro canal mientras tanto',
  },
  {
    keywords: ['ranking', 'calificacion', 'estrellas', 'puntuacion', 'rating', 'posicion'],
    response: '⭐ Tu ranking sube con:\n\n• Paseos completados (sin cancelar)\n• Ratings de 5 estrellas\n• GPS activo durante todo el recorrido\n• Respuestas rápidas (aceptar en <2 min)\n• Fotos durante el paseo\n• Buena comunicación por chat\n\nRanking alto = más paseos y acceso a dueños con mejor calificación.',
  },
  {
    keywords: ['zona', 'area', 'trabajo', 'cambiar ciudad', 'mudanza', 'mudarme'],
    response: '📍 Cambiar tu zona de trabajo:\n\n1. Perfil → "Editar Información Personal"\n2. Actualizá tu dirección (calle, número, barrio, ciudad)\n3. Guardá\n\nLa app usa esa dirección para mostrarte paseos cercanos. Si te mudás, los paseos disponibles cambian automáticamente. Avisanos por WhatsApp si querés trabajar en varias zonas.',
  },
  {
    keywords: ['error', 'bug', 'falla', 'no funciona', 'crashea', 'se cierra', 'problema tecnico', 'no carga'],
    response: '🔧 Solución de problemas:\n\n1. Cerrá completamente la app y volvé a abrir\n2. Verificá que diste permiso de ubicación (Ajustes → Apps → HappiWalk → Ubicación → "Siempre")\n3. Activá GPS de alta precisión\n4. Actualizá desde App Store / Play Store\n5. Reiniciá el teléfono\n\nSi persiste, escribinos por WhatsApp con:\n• Modelo del celular\n• Versión de Android/iOS\n• Captura del error',
  },
  {
    keywords: ['gracias', 'muchas gracias', 'genial', 'perfecto', 'excelente', 'listo', 'ok gracias'],
    response: '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?',
  },
];

export const OWNER_QUICK_REPLIES: QuickReply[] = [
  { label: '¿Cómo reservo?', message: '¿Cómo reservo un paseo?' },
  { label: 'Ver a mi mascota', message: '¿Cómo veo a mi mascota en vivo?' },
  { label: 'Reembolso', message: '¿Cómo obtengo un reembolso?' },
  { label: 'Paseador no llega', message: '¿Qué hago si el paseador no llega?' },
  { label: 'Propinas', message: '¿Cómo dejo propina?' },
  { label: 'Hablar con humano', message: 'Quiero hablar con una persona' },
];

export const WALKER_QUICK_REPLIES: QuickReply[] = [
  { label: 'Aceptar paseo', message: '¿Cómo acepto un paseo?' },
  { label: 'Iniciar GPS', message: '¿Cómo inicio el GPS?' },
  { label: 'Cuándo pagan', message: '¿Cuándo me pagan?' },
  { label: 'Verificarme', message: '¿Cómo me verifico?' },
  { label: 'Mascota agresiva', message: '¿Qué hago si la mascota es agresiva?' },
  { label: 'Hablar con humano', message: 'Quiero hablar con una persona' },
];

export function buildContextMessage(messages: Array<{text: string, isUser: boolean}>, role: 'owner' | 'walker'): string {
  const recentUserMessages = messages
    .filter(m => m.isUser)
    .slice(-3)
    .map(m => m.text)
    .join(' / ');
  const prefix = role === 'walker' ? 'Hola, soy paseador de HappiWalk.' : 'Hola, soy dueño en HappiWalk.';
  return `${prefix} El asistente no pudo ayudarme con: "${recentUserMessages}"`;
}
