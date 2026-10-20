import { supabase } from './supabase';
import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_BOOKING_KEY = 'pending_booking';

export interface BookingData {
  user_id: string;
  pet_ids: string[];
  duration: string;
  address: string;
  lat: number;
  lng: number;
  scheduled_date?: string;
  scheduled_time?: string;
  walker_id?: string | null;
  total_price?: number;
  booking_type: 'schedule' | 'now';
}

export async function savePendingBooking(bookingData: BookingData): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(bookingData));
  } catch (error) {
    console.error('Error guardando booking pendiente:', error);
  }
}

export async function getPendingBooking(): Promise<BookingData | null> {
  try {
    const data = await AsyncStorage.getItem(PENDING_BOOKING_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error obteniendo booking pendiente:', error);
    return null;
  }
}

export async function clearPendingBooking(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_BOOKING_KEY);
  } catch (error) {
    console.error('Error limpiando booking pendiente:', error);
  }
}

export async function createPaymentPreference(
  amount: number,
  _title?: string
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No hay usuario conectado');
  }

  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: { kind: 'topup', amount: Math.round(Number(amount)) },
  });

  if (error || !data?.preferenceId) {
    throw new Error('No se pudo iniciar el pago');
  }

  return data.preferenceId;
}

export async function openMercadoPagoCheckout(preferenceId: string): Promise<void> {
  const url = `https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=${preferenceId}`;
  
  try {
    // Usar expo-web-browser para una experiencia más fluida dentro de la app
    const result = await WebBrowser.openAuthSessionAsync(url, 'happiwalk://payment');
    
    if (result.type !== 'success' && result.type !== 'cancel') {
      throw new Error('No se pudo abrir el pago');
    }
  } catch (error) {
    console.error('Error opening Mercado Pago:', error);
    // Fallback: intentar con Linking
    try {
      await Linking.openURL(url);
    } catch (linkError) {
      throw new Error('No se pudo abrir el pago');
    }
  }
}

export async function createPaymentWithBooking(
  bookingData: BookingData
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay usuario conectado');

  await clearPendingBooking();
  await savePendingBooking(bookingData);

  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: {
      kind: 'booking',
      booking: {
        pet_ids: bookingData.pet_ids,
        duration: bookingData.duration,
        address: bookingData.address,
        lat: bookingData.lat,
        lng: bookingData.lng,
        scheduled_date: bookingData.scheduled_date,
        scheduled_time: bookingData.scheduled_time,
        walker_id: bookingData.walker_id || null,
      },
    },
  });

  if (error || !data?.preferenceId) {
    throw new Error('No se pudo iniciar el pago');
  }

  await openMercadoPagoCheckout(data.preferenceId);
}