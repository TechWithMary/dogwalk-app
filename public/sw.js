// Service Worker para PaseoMundo - Notificaciones Push
const CACHE_NAME = 'paseomundo-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Evento de instalación
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('❌ Service Worker: Error en cache:', error);
      })
  );
});

// Evento de activación
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Evento de fetch (para caché)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si está en cache, retornarlo
        if (response) {
          return response;
        }

        // Si no, hacer la petición
        return fetch(event.request)
          .then((response) => {
            // Si la respuesta no es válida, retornar error
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clonar la respuesta para poder cachearla
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Si hay error de red, intentar con cache
            return caches.match(event.request);
          });
      })
  );
});

// Evento de push (notificaciones)
self.addEventListener('push', (event) => {
  console.log('🔔 Service Worker: Push event recibido');

  let notificationData = {
    title: 'PaseoMundo',
    body: 'Tienes una nueva notificación',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'paseomundo-general',
    data: {}
  };

  if (event.data) {
    try {
      notificationData = { ...notificationData, ...event.data.json() };
    } catch (error) {
      console.error('❌ Error parseando notificación:', error);
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    requireInteraction: notificationData.requireInteraction || false,
    actions: notificationData.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Evento de click en notificación
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Service Worker: Notificación clickeada');

  event.notification.close();

  // Manejar navegación según el tipo de notificación
  let urlToOpen = '/';

  if (event.notification.data) {
    const { type, data } = event.notification.data;

    switch (type) {
      case 'walk':
        if (data.bookingId) {
          urlToOpen = `/live-walk?booking=${data.bookingId}`;
        }
        break;
      case 'message':
        if (data.conversationId) {
          urlToOpen = `/messages?conversation=${data.conversationId}`;
        }
        break;
      case 'payment':
        urlToOpen = '/wallet';
        break;
      default:
        if (event.notification.data.url) {
          urlToOpen = event.notification.data.url;
        }
    }
  }

  event.waitUntil(
    clients.openWindow(urlToOpen)
  );

  // Enviar evento al cliente activo
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: 'notification-clicked',
            notification: {
              ...event.notification.data,
              clickedAt: new Date().toISOString()
            }
          });
        }
      })
  );
});

// Evento de cierre de notificación
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Service Worker: Notificación cerrada');

  // Enviar evento al cliente activo
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: 'notification-closed',
            notification: {
              ...event.notification.data,
              closedAt: new Date().toISOString()
            }
          });
        }
      })
  );
});

// Sincronización en background (para datos offline)
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Background sync');

  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-locations') {
    event.waitUntil(syncLocations());
  }
});

// Función para sincronizar mensajes
async function syncMessages() {
  try {
    // Obtener mensajes pendientes de IndexedDB
    const pendingMessages = await getPendingMessages();
    
    // Enviar mensajes al servidor
    for (const message of pendingMessages) {
      try {
        await sendMessageToServer(message);
        await removePendingMessage(message.id);
      } catch (error) {
        console.error('❌ Error enviando mensaje:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error en sync de mensajes:', error);
  }
}

// Función para sincronizar ubicaciones
async function syncLocations() {
  try {
    // Obtener ubicaciones pendientes de IndexedDB
    const pendingLocations = await getPendingLocations();
    
    // Enviar ubicaciones al servidor
    for (const location of pendingLocations) {
      try {
        await sendLocationToServer(location);
        await removePendingLocation(location.id);
      } catch (error) {
        console.error('❌ Error enviando ubicación:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error en sync de ubicaciones:', error);
  }
}

// Funciones simuladas para IndexedDB (deberías implementarlas)
async function getPendingMessages() {
  // Implementar IndexedDB para mensajes pendientes
  return [];
}

async function getPendingLocations() {
  // Implementar IndexedDB para ubicaciones pendientes
  return [];
}

async function sendMessageToServer(/* message */) {
  // Implementar envío al servidor
}

async function sendLocationToServer(/* location */) {
  // Implementar envío al servidor
}

async function removePendingMessage(/* id */) {
  // Implementar eliminación de IndexedDB
}

async function removePendingLocation(/* id */) {
  // Implementar eliminación de IndexedDB
}

console.log('🐕 PaseoMundo Service Worker cargado');