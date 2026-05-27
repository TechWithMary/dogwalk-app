import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Linking, Alert, AppState, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getPendingBooking, clearPendingBooking } from '../lib/paymentService';
import {
  registerForPushNotifications,
  setupAndroidChannel,
  resolveNotificationRoute,
  sendLocalNotification,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { useNetworkStatus } from '../lib/network';
import { ToastProvider } from '../components/Toast';
import ErrorBoundary from '../components/ErrorBoundary';
import { COLORS } from '../lib/theme';

export default function RootLayout() {
  const router = useRouter();
  const { isOffline } = useNetworkStatus();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    setupAndroidChannel();
    registerForPushNotifications();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setCurrentUserId(user.id);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const route = resolveNotificationRoute(response);
        if (route) {
          router.push(route);
        }
      },
    );

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const route = resolveNotificationRoute(response);
        if (route) {
          setTimeout(() => router.push(route), 600);
        }
      }
    });

    return () => {
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('notifications-push')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          const notif = payload.new as any;
          sendLocalNotification(notif.title || 'Nueva notificación', notif.body || '', { link_to: notif.link_to });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      
      
      // Parsear la URL
      const parsed = Linking.parse(url);
      const path = parsed.path || '';
      
      // Verificar si es una respuesta de pago
      if (path.startsWith('payment/')) {
        const status = path.replace('payment/', '');
        
        // Obtener booking pendiente
        const pendingBooking = await getPendingBooking();
        
        if (pendingBooking) {
          if (status === 'success') {
            Alert.alert(
              'Reserva en Proceso',
              'Tu pago fue exitoso. Te notificaremos cuando un paseador acepte tu paseo.',
              [
                { 
                  text: 'Ver Mis Reservas', 
                  onPress: () => {
                    clearPendingBooking();
                  }
                }
              ]
            );
          } else if (status === 'failure') {
            Alert.alert(
              'Pago Fallido',
              'El pago no se completó. Puedes intentar nuevamente.',
              [{ text: 'OK', onPress: () => clearPendingBooking() }]
            );
          } else if (status === 'pending') {
            Alert.alert(
              'Pago Pendiente',
              'Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
              [{ text: 'OK', onPress: () => clearPendingBooking() }]
            );
          }
        } else {
          // Wallet recharge - redirigir a wallet
          if (status === 'success') {
            Alert.alert(
              'Recarga Exitosa',
              'Tu saldo se ha actualizado.',
              [{ text: 'OK', onPress: () => {} }]
            );
          } else if (status === 'failure') {
            Alert.alert(
              'Pago Fallido',
              'El pago no se completó. Intenta de nuevo.',
              [{ text: 'OK' }]
            );
          } else if (status === 'pending') {
            Alert.alert(
              'Pago Pendiente',
              'Tu pago está siendo procesado.',
              [{ text: 'OK' }]
            );
          }
        }
      }
    };
    
    // Agregar listener para deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Verificar si la app se abrió con un deep link
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleDeepLink({ url: initialUrl });
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          {isOffline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>Sin conexión a internet</Text>
            </View>
          )}
          <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F9FAFB' }
          }}
        >
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* Owner Screens */}
          <Stack.Screen name="booking" options={{ presentation: 'modal' }} />
          <Stack.Screen name="booking-details" options={{ presentation: 'card' }} />
          <Stack.Screen name="booking-history" options={{ presentation: 'card' }} />
          <Stack.Screen name="live-walk" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="pets" options={{ presentation: 'modal' }} />
          <Stack.Screen name="tutorial" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding-owner" options={{ presentation: 'modal' }} />
          <Stack.Screen name="onboarding-walker" options={{ presentation: 'modal' }} />
          <Stack.Screen name="walker-profile" options={{ presentation: 'card' }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="wallet" options={{ presentation: 'card' }} />
          <Stack.Screen name="terms" options={{ presentation: 'modal' }} />
          <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
          
          {/* New Screens */}
          <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
          <Stack.Screen name="rating" options={{ presentation: 'modal' }} />
          <Stack.Screen name="walker-home" options={{ headerShown: false }} />
          <Stack.Screen name="walker-settings" options={{ presentation: 'card' }} />
          <Stack.Screen name="walker-balance" options={{ presentation: 'card' }} />
          <Stack.Screen name="top-up" options={{ presentation: 'modal' }} />
          <Stack.Screen name="manage-cards" options={{ presentation: 'card' }} />
          <Stack.Screen name="messages" options={{ presentation: 'card' }} />
          <Stack.Screen name="chat" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin/payouts" options={{ presentation: 'card' }} />
          <Stack.Screen name="admin/verifications" options={{ presentation: 'card' }} />
        </Stack>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: COLORS.status.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineText: {
    color: COLORS.text.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
