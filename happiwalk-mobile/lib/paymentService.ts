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
  total_price: number;
  booking_type: 'schedule' | 'now';
}

export async function savePendingBooking(bookingData: BookingData): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(bookingData));
    console.log('Booking pendiente guardado:', bookingData);
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
    console.log('Booking pendiente limpiado');
  } catch (error) {
    console.error('Error limpiando booking pendiente:', error);
  }
}

export async function createPaymentPreference(
  amount: number,
  title: string,
  bookingData?: BookingData
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('No hay usuario conectado');
  }

  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: { 
      amount, 
      title, 
      email: user.email,
      bookingData: bookingData ? {
        user_id: user.id,
        pet_ids: bookingData.pet_ids,
        duration: bookingData.duration,
        address: bookingData.address,
        lat: bookingData.lat,
        lng: bookingData.lng,
        scheduled_date: bookingData.scheduled_date,
        scheduled_time: bookingData.scheduled_time,
        total_price: bookingData.total_price,
        booking_type: bookingData.booking_type
      } : undefined
    }
  });
  
  if (error) {
    console.error('Error creating payment preference:', error);
    throw new Error('No se pudo iniciar el pago');
  }
  
  return data.preferenceId;
}

export async function openMercadoPagoCheckout(preferenceId: string): Promise<void> {
  const url = `https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=${preferenceId}`;
  
  try {
    // Usar expo-web-browser para una experiencia más fluida dentro de la app
    const result = await WebBrowser.openAuthSessionAsync(url, 'happiwalk://payment');
    
    if (result.type === 'success') {
      console.log('Pago completado exitosamente');
    } else if (result.type === 'cancel') {
      console.log('Usuario canceló el pago');
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
  amount: number,
  title: string,
  bookingData: BookingData
): Promise<void> {
  // Limpiar cualquier booking pendiente anterior antes de guardar uno nuevo
  await clearPendingBooking();
  console.log('Booking pendiente anterior limpiado');
  
  // Guardar datos del booking antes de abrir Mercado Pago
  await savePendingBooking(bookingData);
  console.log('Datos del nuevo booking guardados, iniciando pago...');
  
  // 1. Obtener preferenceId con los datos del booking
  const preferenceId = await createPaymentPreference(amount, title, bookingData);
  
  // 2. Abrir Mercado Pago checkout
  await openMercadoPagoCheckout(preferenceId);
}