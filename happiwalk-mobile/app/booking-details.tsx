import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Platform, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface Booking {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration: string;
  status: string;
  total_price: number;
  notes: string;
  address: string;
  created_at: string;
  walkers?: {
    name: string;
    img?: string;
    rating: number;
    user_id?: string;
  };
  pets?: any[];
}

export default function BookingDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;
  const insets = useSafeAreaInsets();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [walkerProfile, setWalkerProfile] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    }
  }, [bookingId]);

  const fetchBooking = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const { data: bookingData, error } = await supabase
        .from('bookings')
        .select('*, walkers(*)')
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      setBooking(bookingData);

      if (bookingData?.walkers?.user_id) {
        const { data: walkerProfileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', bookingData.walkers.user_id)
          .single();
        setWalkerProfile(walkerProfileData);
      }

      const petIds = bookingData?.pet_ids;
      if (petIds && Array.isArray(petIds) && petIds.length > 0) {
        const { data: petsData } = await supabase
          .from('pets')
          .select('*')
          .in('id', petIds);
        setPets(petsData || []);
      } else {
        const { data: allPets } = await supabase
          .from('pets')
          .select('*')
          .eq('owner_id', bookingData?.user_id);
        setPets(allPets || []);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudo cargar la reserva');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (price: number) => {
    return '$' + (price || 0).toLocaleString('es-CO');
  };

  const formatLocalDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const getStatusInfo = (status: string) => {
    const statuses: any = {
      'pending': { label: 'Por Pagar', emoji: '⏳', color: '#F59E0B', bg: '#FEF3C7', border: '#FCD34D' },
      'confirmed': { label: 'Pagado', emoji: '✓', color: '#3B82F6', bg: '#DBEAFE', border: '#93C5FD' },
      'accepted': { label: 'En Camino', emoji: '🐕', color: '#3B82F6', bg: '#DBEAFE', border: '#93C5FD' },
      'picked_up': { label: 'Recogida', emoji: '🐕', color: '#8B5CF6', bg: '#EDE9FE', border: '#C4B5FD' },
      'in_progress': { label: 'En Curso', emoji: '🚶', color: '#10B981', bg: '#D1FAE5', border: '#6EE7B7' },
      'completed': { label: 'Completado', emoji: '✅', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
      'cancelled': { label: 'Cancelado', emoji: '✕', color: '#EF4444', bg: '#FEE2E2', border: '#FCA5A5' }
    };
    return statuses[status] || statuses.pending;
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Reserva',
      '¿Estás seguro de que quieres cancelar esta reserva?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'No se pudo cancelar la reserva');
            }
          },
        },
      ]
    );
  };

  const handleCall = () => {
    if (walkerProfile?.phone) {
      Linking.openURL(`tel:${walkerProfile.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (walkerProfile?.phone) {
      const phone = walkerProfile.phone.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/57${phone}`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Reserva no encontrada</Text>
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusInfo(booking.status);
  const petNames = pets.map(p => p.name).join(', ') || 'tu(s) mascota(s)';

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalles de Reserva</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.statusCard, { borderLeftColor: statusInfo.color }]}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusIcon}>{statusInfo.emoji}</Text>
            <View>
              <Text style={styles.statusLabel}>{statusInfo.label}</Text>
              <Text style={styles.bookingId}>#{booking.id.slice(0, 8).toUpperCase()}</Text>
            </View>
          </View>

          <View style={[styles.detailsGrid]}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>📅 Fecha</Text>
              <Text style={styles.detailValue}>{formatLocalDate(booking.scheduled_date)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>🕐 Hora</Text>
              <Text style={styles.detailValue}>{booking.scheduled_time}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>⏱️ Duración</Text>
              <Text style={styles.detailValue}>{booking.duration}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>💰 Total</Text>
              <Text style={[styles.detailValue, styles.priceValue]}>{formatMoney(booking.total_price)}</Text>
            </View>
          </View>
        </View>

        {booking.address && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📍 Dirección</Text>
            <Text style={styles.addressText}>{booking.address}</Text>
          </View>
        )}

        {pets.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🐕 Mascotas</Text>
            <View style={styles.petsRow}>
              {pets.map((pet) => (
                <View key={pet.id} style={styles.petBadge}>
                  <Text style={styles.petBadgeText}>{pet.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {booking.walkers && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🐕 Paseador</Text>
            <View style={styles.walkerRow}>
              <View style={styles.walkerImage}>
                {booking.walkers.img ? (
                  <Image source={{ uri: booking.walkers.img }} style={styles.walkerImg} />
                ) : (
                  <View style={[styles.walkerImg, styles.walkerImgPlaceholder]}>
                    <Text style={styles.walkerInitial}>
                      {(booking.walkers.name || 'P')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.walkerInfo}>
                <Text style={styles.walkerName}>{booking.walkers.name || walkerProfile?.first_name || 'Paseador'}</Text>
                <Text style={styles.walkerRating}>⭐ {booking.walkers.rating || 'Nuevo'}</Text>
                {walkerProfile?.phone && <Text style={styles.walkerPhone}>{walkerProfile.phone}</Text>}
              </View>
              {walkerProfile?.phone && (
                <View style={styles.walkerActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                    <Text style={styles.actionIcon}>📞</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.whatsappBtn]} onPress={handleWhatsApp}>
                    <Text style={styles.actionIcon}>💬</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {booking.status === 'accepted' && (
          <View style={[styles.infoBanner, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
            <Text style={styles.infoIcon}>🐕</Text>
            <Text style={styles.infoText}>El paseador está en camino</Text>
          </View>
        )}

        {booking.status === 'picked_up' && (
          <View style={[styles.infoBanner, { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD' }]}>
            <Text style={styles.infoIcon}>🐕</Text>
            <Text style={styles.infoText}>El paseo está por comenzar</Text>
          </View>
        )}

        {booking.status === 'in_progress' && (
          <TouchableOpacity 
            style={styles.liveBtn}
            onPress={() => router.push({ pathname: '/live-walk', params: { bookingId: booking.id } })}
          >
            <Text style={styles.liveBtnText}>📍 Ver Walk en Vivo</Text>
          </TouchableOpacity>
        )}

        {booking.status === 'pending' && (
          <TouchableOpacity style={styles.payBtn}>
            <Text style={styles.payBtnText}>💳 Completar Pago</Text>
          </TouchableOpacity>
        )}

        {booking.status === 'pending' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Cancelar Reserva</Text>
          </TouchableOpacity>
        )}
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 18,
    color: '#374151',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 40,
  },
  errorText: {
    textAlign: 'center',
    color: '#EF4444',
    marginTop: 40,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  bookingId: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    width: '45%',
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  priceValue: {
    color: '#10B981',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#6B7280',
  },
  petsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  petBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  petBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  walkerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walkerImage: {
    marginRight: 12,
  },
  walkerImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  walkerImgPlaceholder: {
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkerInitial: {
    fontSize: 20,
    fontWeight: '900',
    color: '#10B981',
  },
  walkerInfo: {
    flex: 1,
  },
  walkerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  walkerRating: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  walkerPhone: {
    fontSize: 10,
    color: '#6B7280',
  },
  walkerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappBtn: {
    backgroundColor: '#DCFCE7',
  },
  actionIcon: {
    fontSize: 18,
  },
  infoBanner: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    flex: 1,
  },
  liveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  liveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  payBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
