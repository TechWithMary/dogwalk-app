import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { Dog, MapPin, Clock, ChevronRight, Loader2, Star, TrendingUp, Award, Bell } from '../components/Icons';

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
    'picked_up': 'Recogida',
    'in_progress': 'En Curso',
  };
  return labels[status] || status;
};

const getStatusStyles = (status: string) => {
  const styles: any = {
    'pending': { bg: '#FEF3C7', border: '#FCD34D', color: '#92400E' },
    'accepted': { bg: '#DBEAFE', border: '#93C5FD', color: '#1D4ED8' },
    'picked_up': { bg: '#EDE9FE', border: '#C4B5FD', color: '#6D28D9' },
    'in_progress': { bg: '#D1FAE5', border: '#6EE7B7', color: '#059669' },
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
  const [displayName, setDisplayName] = useState('Paseador');

  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walkerIdRef = useRef<string | null>(null);

  const fetchWalkerData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: walkerData } = await supabase
        .from('walkers')
        .select('id, name, user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!walkerData) {
        setLoading(false);
        return;
      }

      walkerIdRef.current = walkerData.id;

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
        .in('status', ['accepted', 'picked_up', 'in_progress']);

      const { data: availableBookings } = await supabase
        .from('bookings')
        .select('*')
        .is('walker_id', null)
        .in('status', ['pending', 'confirmed']);

      const allBookings = [...(myBookings || []), ...(availableBookings || [])];

      setNewRequests(allBookings.filter(b => b.status === 'pending' || b.status === 'confirmed') || []);
      setActiveWalks(allBookings.filter(b => b.status === 'accepted' || b.status === 'picked_up' || b.status === 'in_progress') || []);

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

    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWalkerData();
  }, [fetchWalkerData]);

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
    }
  };

  const startGPSTracking = (bookingId: string) => {
    if (locationIntervalRef.current) return;

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
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'picked_up' })
        .eq('id', bookingId)
        .eq('status', 'accepted');

      if (error) throw error;

      const { data: booking } = await supabase
        .from('bookings')
        .select('user_id')
        .eq('id', bookingId)
        .single();

      if (booking?.user_id) {
        await supabase.from('notifications').insert({
          user_id: booking.user_id,
          title: '🐕 Mascota Recogida',
          body: 'El paseador ha recogido a tu mascota. ¡El paseo está por comenzar!',
          link_to: '/home',
        });
      }

      Alert.alert('Éxito', 'Mascota recogida');
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
              const netEarning = price * 0.8;

              if (walkerUserId) {
                await supabase
                  .from('user_profiles')
                  .select('balance')
                  .eq('user_id', walkerUserId)
                  .maybeSingle()
                  .then(({ data: profile }) => {
                    supabase
                      .from('user_profiles')
                      .update({ balance: (profile?.balance || 0) + netEarning })
                      .eq('user_id', walkerUserId);
                  });

                await supabase.from('transactions').insert({
                  user_id: walkerUserId,
                  booking_id: bookingId,
                  transaction_type: 'payment',
                  amount: price,
                  net_earning: netEarning,
                  platform_fee: price * 0.2,
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Loader2 size={32} color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.walkerInfo}>
              <Text style={styles.panelLabel}>PANEL CONTROL</Text>
              <Text style={styles.greeting}>Hola, {displayName}! 🐕</Text>
            </View>
            <TouchableOpacity
              style={[styles.onlineBtn, isOnline && styles.onlineBtnActive]}
              onPress={() => setIsOnline(!isOnline)}
            >
              <Text style={[styles.onlineText, isOnline && styles.onlineTextActive]}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.balanceCard}
            onPress={() => router.push('/walker-balance')}
          >
            <View>
              <Text style={styles.balanceLabel}>Saldo para retiro</Text>
              <Text style={styles.balanceAmount}>{formatMoney(balance)}</Text>
            </View>
            <ChevronRight size={24} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <TrendingUp size={20} color="#3B82F6" />
              </View>
              <Text style={styles.statLabel}>Completed</Text>
              <Text style={styles.statValue}>{stats.completedWalks}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, styles.statIconYellow]}>
                <Star size={20} color="#F59E0B" />
              </View>
              <Text style={styles.statLabel}>Rating</Text>
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
                              {booking.address?.split(',')[0] || 'Dirección no disponible'}
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
                        onPress={() => acceptBooking(booking.id)}
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
              <View style={styles.emptyState}>
                <Loader2 size={32} color="#E5E7EB" />
                <Text style={styles.emptyTitle}>Buscando paseos cerca...</Text>
                <Text style={styles.emptySubtitle}>Activa tu ubicación para recibir solicitudes</Text>
              </View>
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
                              {booking.address?.split(',')[0] || 'Dirección no disponible'}
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
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.pickupBtn, processingId === booking.id && styles.actionBtnDisabled]}
                          onPress={() => confirmPickup(booking.id)}
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
                      )}

                      {booking.status === 'picked_up' && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.startBtn, processingId === booking.id && styles.actionBtnDisabled]}
                          onPress={() => startWalk(booking.id)}
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
                            onPress={() => finishWalk(booking.id)}
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
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No tienes paseos activos</Text>
                <Text style={styles.emptySubtitle}>Acepta una solicitud para comenzar</Text>
              </View>
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#1F2937',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walkerInfo: {},
  panelLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 2,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  onlineBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1,
  },
  onlineTextActive: {
    color: '#10B981',
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  balanceCard: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconYellow: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#374151',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  bookingsList: {
    gap: 16,
  },
  bookingCard: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
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
    backgroundColor: '#374151',
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
    color: '#FFFFFF',
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
  },
  priceText: {
    fontSize: 14,
    fontWeight: '900',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  acceptBtnDisabled: {
    opacity: 0.5,
  },
  acceptBtnText: {
    color: '#000000',
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
    backgroundColor: '#10B981',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  gpsActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  gpsActiveText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  checkIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  emptyState: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
});