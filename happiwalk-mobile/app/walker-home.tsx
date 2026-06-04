import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, RefreshControl, Linking, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import { Dog, MapPin, ChevronRight, Loader2, Star, TrendingUp, Power, Wallet, House, MessageSquare, User, Calendar, MapPin as MapPinIcon, Settings } from '../components/Icons';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import LatestMessageCard from '../components/LatestMessageCard';

interface Booking {
  id: string;
  address: string;
  duration: string;
  scheduled_date: string;
  scheduled_time: string;
  total_price: number;
  status: string;
  lat?: number;
  lng?: number;
}

const formatMoney = (val: number) => '$' + (val || 0).toLocaleString('es-CO');

const getStatusLabel = (status: string) => {
  const labels: any = {
    'pending': 'Por Aceptar',
    'accepted': 'Aceptado',
    'pickup_requested': 'Esperando Confirmación',
    'picked_up': 'Recogida',
    'in_progress': 'En Curso',
  };
  return labels[status] || status;
};

const getStatusStyles = (status: string) => {
  const styles: any = {
    'pending': { bg: '#FEF3C7', border: '#FCD34D', color: '#92400E' },
    'accepted': { bg: '#DBEAFE', border: '#93C5FD', color: '#1D4ED8' },
    'pickup_requested': { bg: '#FEF3C7', border: '#FCD34D', color: '#92400E' },
    'picked_up': { bg: '#EDE9FE', border: '#C4B5FD', color: '#6D28D9' },
    'in_progress': { bg: '#D1FAE5', border: '#6EE7B7', color: '#052e05' },
  };
  return styles[status] || { bg: '#F3F4F6', border: '#D1D5DB', color: '#374151' };
};

export default function WalkerHomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'active'>('pending');
  const [balance, setBalance] = useState(0);
  const [stats, setStats] = useState({ completedWalks: 0, rating: 5.0, monthlyEarnings: 0 });
  const [newRequests, setNewRequests] = useState<Booking[]>([]);
  const [activeWalks, setActiveWalks] = useState<Booking[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('Paseador');
  const [userId, setUserId] = useState<string>('');

  const [activeNav, setActiveNav] = useState('home');

  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walkerIdRef = useRef<string | null>(null);
  const locationErrorShownRef = useRef(false);
  const initialTabSetRef = useRef(false);
  const processingIdRef = useRef<string | null>(null);
  const autoStartBookingIdRef = useRef<string | null>(null);

  const fetchWalkerData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: walkerData } = await supabase
        .from('walkers')
        .select('id, name, user_id, is_online')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!walkerData) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      walkerIdRef.current = walkerData.id;
      setIsOnline(walkerData.is_online ?? true);

      const cleanerName = (walkerData.name || 'Paseador')
        .replace(/\b(nuevo|usuario|walker)\b/gi, '')
        .trim() || 'Paseador';
      setDisplayName(cleanerName.split(' ')[0]);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      setBalance(profile?.balance || 0);

      const { data: myBookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('walker_id', walkerData.id)
        .in('status', ['accepted', 'pickup_requested', 'picked_up', 'in_progress']);

      const { data: availableBookings } = await supabase
        .from('bookings')
        .select('*')
        .is('walker_id', null)
        .in('status', ['pending', 'confirmed']);

      const allBookings = [...(myBookings || []), ...(availableBookings || [])];

      const activeList = allBookings.filter(b => b.status === 'accepted' || b.status === 'pickup_requested' || b.status === 'picked_up' || b.status === 'in_progress') || [];
      setNewRequests(allBookings.filter(b => b.status === 'pending' || b.status === 'confirmed') || []);
      setActiveWalks(activeList);

      if (!initialTabSetRef.current) {
        initialTabSetRef.current = true;
        setActiveTab(activeList.length > 0 ? 'active' : 'pending');
      }

      const { data: completedBookings } = await supabase
        .from('bookings')
        .select('total_price')
        .eq('walker_id', walkerData.id)
        .eq('status', 'completed');

      const totalEarned = completedBookings?.reduce((acc, curr) => acc + (curr.total_price || 0), 0) || 0;

      setStats({
        completedWalks: completedBookings?.length || 0,
        rating: 5.0,
        monthlyEarnings: totalEarned,
      });

    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos. Desliza hacia abajo para reintentar.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const autoStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoStartBookingId, setAutoStartBookingId] = useState<string | null>(null);
  const [autoStartCountdown, setAutoStartCountdown] = useState<number>(0);

  useEffect(() => {
    fetchWalkerData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('walker-bookings-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          const updated = payload.new as any;
          const previous = payload.old as any;
          if (updated.walker_id === walkerIdRef.current) {
            fetchWalkerData();
            if (
              previous?.status === 'pickup_requested' &&
              updated?.status === 'picked_up' &&
              !autoStartBookingIdRef.current &&
              !processingIdRef.current
            ) {
              triggerAutoStart(updated.id);
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const cancelAutoStart = useCallback(() => {
    if (autoStartTimeoutRef.current) {
      clearTimeout(autoStartTimeoutRef.current);
      autoStartTimeoutRef.current = null;
    }
    if (autoStartIntervalRef.current) {
      clearInterval(autoStartIntervalRef.current);
      autoStartIntervalRef.current = null;
    }
    setAutoStartBookingId(null);
    setAutoStartCountdown(0);
  }, []);

  const triggerAutoStart = useCallback((bookingId: string) => {
    setAutoStartBookingId(bookingId);
    setAutoStartCountdown(4);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (autoStartIntervalRef.current) clearInterval(autoStartIntervalRef.current);
    autoStartIntervalRef.current = setInterval(() => {
      setAutoStartCountdown((prev) => {
        if (prev <= 1) {
          if (autoStartIntervalRef.current) {
            clearInterval(autoStartIntervalRef.current);
            autoStartIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    autoStartTimeoutRef.current = setTimeout(() => {
      autoStartTimeoutRef.current = null;
      if (autoStartIntervalRef.current) {
        clearInterval(autoStartIntervalRef.current);
        autoStartIntervalRef.current = null;
      }
      setAutoStartBookingId(null);
      setAutoStartCountdown(0);
      startWalk(bookingId);
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (autoStartTimeoutRef.current) clearTimeout(autoStartTimeoutRef.current);
      if (autoStartIntervalRef.current) clearInterval(autoStartIntervalRef.current);
    };
  }, []);

  useEffect(() => { processingIdRef.current = processingId; }, [processingId]);
  useEffect(() => { autoStartBookingIdRef.current = autoStartBookingId; }, [autoStartBookingId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isOnline) {
        setWalkerOnline(true);
      } else if (state !== 'active') {
        setWalkerOnline(false);
      }
    });
    return () => { sub.remove(); };
  }, [isOnline]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWalkerData();
  };

  const sendLocation = async (bookingId: string) => {
    if (!walkerIdRef.current) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});

      await supabase.from('locations').insert({
        booking_id: bookingId,
        walker_id: walkerIdRef.current,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: new Date().toISOString(),
        activity_type: 'walking',
        location_source: 'gps',
      });
    } catch (err) {
      console.error('Location error:', err);
      if (!locationErrorShownRef.current) {
        locationErrorShownRef.current = true;
        Alert.alert('Error de ubicación', 'No se pudo enviar tu ubicación en tiempo real. Verifica que el GPS esté activo.');
      }
    }
  };

  const startGPSTracking = (bookingId: string) => {
    if (locationIntervalRef.current) return;

    locationErrorShownRef.current = false;
    sendLocation(bookingId);
    locationIntervalRef.current = setInterval(() => {
      sendLocation(bookingId);
    }, 10000);
  };

  const stopGPSTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  const setWalkerOnline = async (online: boolean) => {
    setIsOnline(online);
    if (!walkerIdRef.current) return;
    await supabase
      .from('walkers')
      .update({ is_online: online })
      .eq('id', walkerIdRef.current);
  };

  const acceptBooking = async (bookingId: string) => {
    setAcceptingId(bookingId);
    try {
      const { data: walkerData } = await supabase
        .from('walkers')
        .select('id, name')
        .eq('id', walkerIdRef.current)
        .single();

      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'accepted', walker_id: walkerIdRef.current })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      const { data: booking } = await supabase
        .from('bookings')
        .select('user_id')
        .eq('id', bookingId)
        .single();

      if (booking?.user_id) {
        await supabase.from('notifications').insert({
          user_id: booking.user_id,
          title: '🐕 Paseador Acceptado',
          body: `${walkerData?.name || 'El paseador'} ha aceptado tu reserva. Pronto irá a buscar tu mascota.`,
          link_to: '/home',
        });

        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('booking_id', bookingId)
          .maybeSingle();

        if (!existingConv) {
          await supabase.from('conversations').insert({
            participant_one_id: booking.user_id,
            participant_two_id: walkerIdRef.current,
            booking_id: bookingId,
          });
        }
      }

      Alert.alert('Éxito', 'Paseo aceptado');
      fetchWalkerData();
      setActiveTab('active');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo aceptar');
    } finally {
      setAcceptingId(null);
    }
  };

  const confirmPickup = async (bookingId: string) => {
    setProcessingId(bookingId);
    try {
      const { data: walkerData } = await supabase
        .from('walkers')
        .select('name')
        .eq('id', walkerIdRef.current)
        .single();

      const { data: booking } = await supabase
        .from('bookings')
        .select('user_id')
        .eq('id', bookingId)
        .single();

      const { error } = await supabase
        .from('bookings')
        .update({ status: 'pickup_requested' })
        .eq('id', bookingId)
        .eq('status', 'accepted');

      if (error) throw error;

      if (booking?.user_id) {
        await supabase.from('notifications').insert({
          user_id: booking.user_id,
          title: '🐕 Paseador en el Punto',
          body: `${walkerData?.name || 'El paseador'} ha llegado. Por favor confirma que entregaste tu mascota.`,
          link_to: `/booking-details?id=${bookingId}`,
        });
      }

      Alert.alert('Éxito', 'Notificación enviada al dueño. Espera confirmación para iniciar el paseo.');
      fetchWalkerData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const startWalk = async (bookingId: string) => {
    setProcessingId(bookingId);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'in_progress', walk_start_time: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('status', 'picked_up');

      if (error) throw error;

      const { data: booking } = await supabase
        .from('bookings')
        .select('user_id, walkers(name)')
        .eq('id', bookingId)
        .single();

      const bookingWithWalker = booking as any;

      if (bookingWithWalker?.user_id) {
        await supabase.from('notifications').insert({
          user_id: bookingWithWalker.user_id,
          title: '🐕 Paseo en Curso',
          body: `${bookingWithWalker.walkers?.name || 'El paseador'} ha iniciado el paseo. ¡Sigue la ubicación en tiempo real!`,
          link_to: '/home',
        });
      }

      startGPSTracking(bookingId);
      Alert.alert('GPS Activo', 'El dueño puede ver tu ubicación');
      fetchWalkerData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const finishWalk = async (bookingId: string) => {
    Alert.alert(
      'Finalizar Paseo',
      '¿Confirmas que has terminado el paseo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setProcessingId(bookingId);
            try {
              const { data: booking } = await supabase
                .from('bookings')
                .select('user_id, total_price, walkers(user_id)')
                .eq('id', bookingId)
                .single();

              const { error } = await supabase
                .from('bookings')
                .update({ status: 'completed', walk_end_time: new Date().toISOString() })
                .eq('id', bookingId)
                .eq('status', 'in_progress');

              if (error) throw error;

              const walkerUserId = (booking as any)?.walkers?.user_id;
              const price = booking?.total_price || 0;
              const platformFee = price * 0.2;
              const gatewayFee = price * 0.04;
              const netEarning = price - platformFee - gatewayFee; // 76% of total

              if (walkerUserId) {
                const { data: profile } = await supabase
                  .from('user_profiles')
                  .select('balance')
                  .eq('user_id', walkerUserId)
                  .maybeSingle();

                const newBalance = (profile?.balance || 0) + netEarning;
                await supabase
                  .from('user_profiles')
                  .update({ balance: newBalance })
                  .eq('user_id', walkerUserId);

                await supabase.from('transactions').insert({
                  user_id: walkerUserId,
                  booking_id: bookingId,
                  transaction_type: 'payment',
                  amount: price,
                  net_earning: netEarning,
                  platform_fee: platformFee,
                  gateway_fee: gatewayFee,
                  payment_method: 'wallet',
                  status: 'completed',
                  description: `Paseo completado`,
                });
              }

              if (booking?.user_id) {
                await supabase.from('notifications').insert({
                  user_id: booking.user_id,
                  title: '✅ Paseo Completado',
                  body: 'El paseo terminó. Tu mascota está de vuelta.',
                  link_to: '/home',
                });
              }

              stopGPSTracking();
              Alert.alert('¡Gracias!', 'Paseo completado +' + formatMoney(netEarning));
              fetchWalkerData();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const cancelBooking = async (bookingId: string) => {
    Alert.alert(
      'Cancelar Paseo',
      '¿Estás seguro de que quieres cancelar este paseo? Se notificará al dueño y se procesará el reembolso correspondiente.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(bookingId);
            try {
              const { data: booking } = await supabase
                .from('bookings')
                .select('user_id, total_price')
                .eq('id', bookingId)
                .single();

              if (!booking) {
                Alert.alert('Error', 'No se encontró la reserva');
                return;
              }

              const { data: transaction } = await supabase
                .from('transactions')
                .select('*')
                .eq('booking_id', bookingId)
                .maybeSingle();

              if (transaction) {
                if (transaction.payment_method === 'wallet' && transaction.status === 'completed') {
                  const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('balance')
                    .eq('user_id', booking.user_id)
                    .single();

                  await supabase
                    .from('user_profiles')
                    .update({ balance: (profile?.balance || 0) + transaction.amount })
                    .eq('user_id', booking.user_id);

                  await supabase.from('transactions').insert({
                    user_id: booking.user_id,
                    booking_id: bookingId,
                    transaction_type: 'refund',
                    amount: transaction.amount,
                    payment_method: 'wallet',
                    status: 'completed',
                    description: 'Reembolso automático por cancelación del paseador',
                  });
                } else if (transaction.payment_method === 'mercadopago') {
                  await supabase.from('transactions').insert({
                    user_id: booking.user_id,
                    booking_id: bookingId,
                    transaction_type: 'refund',
                    amount: transaction.amount,
                    payment_method: 'mercadopago',
                    status: 'pending',
                    description: 'Reembolso pendiente - requiere procesamiento manual en MercadoPago',
                  });
                }
              }

              if (booking.user_id) {
                await supabase.from('notifications').insert({
                  user_id: booking.user_id,
                  title: '❌ Paseo Cancelado',
                  body: 'El paseador ha cancelado el paseo. Se ha procesado el reembolso correspondiente.',
                  link_to: '/home',
                });
              }

              await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);

              Alert.alert('Cancelado', 'El paseo ha sido cancelado y se notificó al dueño.');
              fetchWalkerData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo cancelar el paseo');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Dog size={24} color="#000000" />
              </View>
              <View>
                <Text style={styles.panelLabel}>Panel de Control</Text>
                <Text style={styles.greeting}>Hola, Paseador!</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.content}>
          <SkeletonCard count={3} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {autoStartBookingId && (
        <View style={styles.autoStartBanner}>
          <View style={styles.autoStartBannerLeft}>
            <View style={styles.autoStartPulse}>
              <Dog size={20} color="#FFFFFF" />
            </View>
            <View style={styles.autoStartBannerText}>
              <Text style={styles.autoStartBannerTitle}>Recogida confirmada</Text>
              <Text style={styles.autoStartBannerSubtitle}>
                Activando GPS en {autoStartCountdown}s...
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.autoStartCancelBtn}
            onPress={cancelAutoStart}
            activeOpacity={0.7}
          >
            <Text style={styles.autoStartCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0EA5E9']} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Dog size={24} color="#000000" />
              </View>
              <View>
                <Text style={styles.panelLabel}>Panel de Control</Text>
                <Text style={styles.greeting}>Hola, {displayName}!</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={() => router.push('/walker-settings')}
              >
                <Settings size={20} color="#9CA3AF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.onlineBtn, isOnline && styles.onlineBtnActive]}
                onPress={() => setWalkerOnline(!isOnline)}
              >
                <Power size={14} color={isOnline ? '#0EA5E9' : '#6B7280'} />
                <Text style={[styles.onlineText, isOnline && styles.onlineTextActive]}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.balanceCard}
            onPress={() => router.push('/walker-balance')}
            activeOpacity={0.7}
          >
            <View>
              <View style={styles.balanceLabelRow}>
                <Wallet size={16} color="#0EA5E9" />
                <Text style={styles.balanceLabel}>Saldo para retirar</Text>
              </View>
              <Text style={styles.balanceAmount}>{formatMoney(balance)}</Text>
            </View>
            <ChevronRight size={24} color="#D1D5DB" />
          </TouchableOpacity>

          <LatestMessageCard currentUserId={userId} />

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
                <TrendingUp size={20} color="#3B82F6" />
              </View>
              <Text style={styles.statLabel}>Completados</Text>
              <Text style={styles.statValue}>{stats.completedWalks}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FFFBEB' }]}>
                <Star size={20} color="#F59E0B" />
              </View>
              <Text style={styles.statLabel}>Calificación</Text>
              <Text style={styles.statValue}>{stats.rating.toFixed(1)}</Text>
            </View>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
              onPress={() => setActiveTab('pending')}
            >
              <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
                SOLICITUDES ({newRequests.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'active' && styles.tabActive]}
              onPress={() => setActiveTab('active')}
            >
              <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
                EN CURSO ({activeWalks.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'pending' ? (
            newRequests.length > 0 ? (
              <View style={styles.bookingsList}>
                {newRequests.map(booking => {
                  const statusStyles = getStatusStyles(booking.status);
                  return (
                    <View key={booking.id} style={styles.bookingCard}>
                      <View style={styles.bookingHeader}>
                        <View style={styles.bookingAvatar}>
                          <Dog size={24} color="#9CA3AF" />
                        </View>
                        <View style={styles.bookingInfo}>
                          <Text style={styles.bookingDuration}>Paseo {booking.duration}</Text>
                          <View style={styles.bookingLocation}>
                            <MapPin size={12} color="#9CA3AF" />
                            <Text style={styles.bookingAddress}>
                              {booking.address || 'Dirección no disponible'}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.bookingPrice, { backgroundColor: statusStyles.bg, borderColor: statusStyles.border }]}>
                          <Text style={[styles.priceText, { color: statusStyles.color }]}>
                            {formatMoney(booking.total_price)}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.acceptBtn, acceptingId === booking.id && styles.acceptBtnDisabled]}
                        onPress={async () => {
                          try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                          acceptBooking(booking.id);
                        }}
                        disabled={acceptingId === booking.id}
                      >
                        {acceptingId === booking.id ? (
                          <Loader2 size={18} color="#FFFFFF" />
                        ) : (
                          <Text style={styles.acceptBtnText}>Aceptar Solicitud</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                icon={<Dog size={36} color="#0EA5E9" />}
                title="Buscando paseos cerca..."
                description="Aparecerán solicitudes de paseo cuando haya dueños cerca de tu zona."
              />
            )
          ) : (
            activeWalks.length > 0 ? (
              <View style={styles.bookingsList}>
                {activeWalks.map(booking => {
                  const statusStyles = getStatusStyles(booking.status);
                  return (
                    <View key={booking.id} style={styles.bookingCard}>
                      <View style={styles.bookingHeader}>
                        <View style={styles.bookingAvatar}>
                          <Dog size={24} color="#9CA3AF" />
                        </View>
                        <View style={styles.bookingInfo}>
                          <Text style={styles.bookingDuration}>Paseo {booking.duration}</Text>
                          <View style={styles.bookingLocation}>
                            <MapPin size={12} color="#9CA3AF" />
                            <Text style={styles.bookingAddress}>
                              {booking.address || 'Dirección no disponible'}
                            </Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: statusStyles.bg }]}>
                            <Text style={[styles.statusText, { color: statusStyles.color }]}>
                              {getStatusLabel(booking.status)}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.bookingPrice, { backgroundColor: statusStyles.bg, borderColor: statusStyles.border }]}>
                          <Text style={[styles.priceText, { color: statusStyles.color }]}>
                            {formatMoney(booking.total_price)}
                          </Text>
                        </View>
                      </View>

                      {booking.status === 'accepted' && (
                        <>
                          {booking.address && (
                            <TouchableOpacity
                              style={styles.mapsBtn}
                              onPress={() => {
                                const url = Platform.OS === 'ios'
                                  ? `https://maps.apple.com/?q=${encodeURIComponent(booking.address)}`
                                  : `https://www.google.com/maps/search/${encodeURIComponent(booking.address)}`;
                                Linking.openURL(url);
                              }}
                            >
                              <MapPin size={16} color="#3B82F6" />
                              <Text style={styles.mapsBtnText}>Ver ubicación en Maps</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.pickupBtn, processingId === booking.id && styles.actionBtnDisabled]}
                            onPress={async () => {
                              try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                              confirmPickup(booking.id);
                            }}
                            disabled={processingId === booking.id}
                          >
                            {processingId === booking.id ? (
                              <Loader2 size={18} color="#FFFFFF" />
                            ) : (
                              <>
                                <Dog size={18} color="#FFFFFF" />
                                <Text style={styles.actionBtnText}>Ya recogí la mascota</Text>
                              </>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.cancelBtn, cancellingId === booking.id && styles.actionBtnDisabled]}
                            onPress={() => cancelBooking(booking.id)}
                            disabled={cancellingId === booking.id}
                          >
                            {cancellingId === booking.id ? (
                              <Loader2 size={18} color="#EF4444" />
                            ) : (
                              <Text style={styles.cancelBtnText}>Cancelar Paseo</Text>
                            )}
                          </TouchableOpacity>
                        </>
                      )}

                      {booking.status === 'pickup_requested' && (
                        <View style={[styles.actionBtn, styles.waitingBtn]}>
                          <Text style={styles.actionBtnText}>Esperando confirmación del dueño</Text>
                        </View>
                      )}

                      {booking.status === 'picked_up' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.startBtn, processingId === booking.id && styles.actionBtnDisabled]}
                            onPress={async () => {
                              try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                              startWalk(booking.id);
                            }}
                            disabled={processingId === booking.id}
                          >
                          {processingId === booking.id ? (
                            <Loader2 size={18} color="#FFFFFF" />
                          ) : (
                            <>
                              <MapPin size={18} color="#FFFFFF" />
                              <Text style={styles.actionBtnText}>Iniciar Paseo GPS</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}

                      {booking.status === 'in_progress' && (
                        <>
                          <View style={styles.gpsActive}>
                            <Text style={styles.gpsActiveText}>GPS activo - El dueño puede ver tu ubicación</Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.finishBtn, processingId === booking.id && styles.actionBtnDisabled]}
                            onPress={async () => {
                              try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                              finishWalk(booking.id);
                            }}
                            disabled={processingId === booking.id}
                          >
                            {processingId === booking.id ? (
                              <Loader2 size={18} color="#FFFFFF" />
                            ) : (
                              <>
                                <Text style={styles.checkIcon}>✓</Text>
                                <Text style={styles.actionBtnText}>Finalizar Paseo</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                icon={<Dog size={36} color="#0EA5E9" />}
                title="No tienes paseos activos"
                description="Acepta una solicitud para comenzar a pasear."
              />
            )
          )}

        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveNav('home')}
        >
          <View style={[styles.navIconContainer, activeNav === 'home' && styles.navIconActive]}>
            <House size={24} color={activeNav === 'home' ? '#111827' : '#9CA3AF'} />
          </View>
          {activeNav === 'home' && <Text style={styles.navLabel}>Inicio</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => { setActiveNav('messages'); router.push('/messages'); }}
        >
          <View style={[styles.navIconContainer, activeNav === 'messages' && styles.navIconActive]}>
            <MessageSquare size={24} color={activeNav === 'messages' ? '#111827' : '#9CA3AF'} />
          </View>
          {activeNav === 'messages' && <Text style={styles.navLabel}>Mensajes</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => { setActiveNav('profile'); router.push('/profile'); }}
        >
          <View style={[styles.navIconContainer, activeNav === 'profile' && styles.navIconActive]}>
            <User size={24} color={activeNav === 'profile' ? '#111827' : '#9CA3AF'} />
          </View>
          {activeNav === 'profile' && <Text style={styles.navLabel}>Perfil</Text>}
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#111827',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 48,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  panelLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  onlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: 'transparent',
  },
  onlineBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1,
  },
  onlineTextActive: {
    color: '#0EA5E9',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  content: {
    paddingHorizontal: 24,
    marginTop: -24,
    paddingBottom: 100,
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    padding: 6,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#065F46',
  },
  bookingsList: {
    gap: 16,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bookingAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingDuration: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  bookingLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingAddress: {
    fontSize: 12,
    color: '#9CA3AF',
    flex: 1,
  },
  statusBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bookingPrice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '900',
  },
  acceptBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  acceptBtnDisabled: {
    opacity: 0.5,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actionBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  pickupBtn: {
    backgroundColor: '#8B5CF6',
  },
  startBtn: {
    backgroundColor: '#3B82F6',
  },
  finishBtn: {
    backgroundColor: '#0EA5E9',
  },
  cancelBtn: {
    backgroundColor: '#FEE2E2',
    marginTop: 8,
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  waitingBtn: {
    backgroundColor: '#F59E0B',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gpsActive: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  gpsActiveText: {
    color: '#052e05',
    fontSize: 12,
    fontWeight: '700',
  },
  checkIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainer: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  navIconActive: {
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    transform: [{ scale: 1.1 }],
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  mapsBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  mapsBtnText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '700',
  },
  autoStartBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  autoStartBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  autoStartPulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoStartBannerText: {
    flex: 1,
  },
  autoStartBannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  autoStartBannerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  autoStartCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  autoStartCancelText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
  },
});
