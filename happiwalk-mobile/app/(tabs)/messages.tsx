import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

interface Booking {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_hours: number;
  status: string;
  total_price: number;
  walker: {
    name: string;
    user_profiles: {
      profile_photo_url: string;
    };
  };
  pet: {
    name: string;
    photo_url: string;
  };
}

export default function BookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            *,
            walker:walkers(name, user_profiles(profile_photo_url)),
            pet:pets(name, photo_url)
          `)
          .or(`owner_id.eq.${currentUser.id},walker_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setBookings(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const formatPrice = (price: number) => {
    return '$' + (price || 0).toLocaleString('es-CO');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'confirmed': return '#10B981';
      case 'in_progress': return '#3B82F6';
      case 'completed': return '#6B7280';
      case 'cancelled': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmado';
      case 'in_progress': return 'En Progreso';
      case 'completed': return 'Completado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Reservas</Text>
        <Text style={styles.subtitle}>Gestiona tus paseos</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />
        }
      >
        {loading ? (
          <Text style={styles.loadingText}>Cargando...</Text>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>No tienes reservas aún</Text>
            <Text style={styles.emptySubtext}>¡Reserva tu primer paseo!</Text>
          </View>
        ) : (
          bookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.bookingCard}
              onPress={() => router.push({ pathname: '/booking-details', params: { id: booking.id } })}
            >
              <View style={styles.bookingHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                    {getStatusText(booking.status)}
                  </Text>
                </View>
                <Text style={styles.bookingId}>#{booking.id.slice(0, 8).toUpperCase()}</Text>
              </View>

              <View style={styles.bookingContent}>
                <View style={styles.walkerSection}>
                  {booking.walker?.user_profiles?.profile_photo_url ? (
                    <Image
                      source={{ uri: booking.walker.user_profiles.profile_photo_url }}
                      style={styles.walkerImg}
                    />
                  ) : (
                    <View style={[styles.walkerImg, styles.walkerImgPlaceholder]}>
                      <Text style={styles.walkerInitial}>
                        {(booking.walker?.name || 'P')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.walkerName}>{booking.walker?.name || 'Paseador'}</Text>
                    <Text style={styles.petName}>🐕 {booking.pet?.name}</Text>
                  </View>
                </View>

                <View style={styles.bookingDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📅</Text>
                    <Text style={styles.detailValue}>{booking.scheduled_date}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>🕐</Text>
                    <Text style={styles.detailValue}>{booking.scheduled_time}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>⏱️</Text>
                    <Text style={styles.detailValue}>{booking.duration_hours}h</Text>
                  </View>
                </View>
              </View>

              <View style={styles.bookingFooter}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalPrice}>{formatPrice(booking.total_price)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#10B981',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingText: {
    textAlign: 'center',
    color: '#9CA3AF',
    padding: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingId: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  bookingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  walkerSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walkerImg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
  },
  walkerImgPlaceholder: {
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkerInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },
  walkerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  petName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  bookingDetails: {
    alignItems: 'flex-end',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    marginRight: 4,
  },
  detailValue: {
    fontSize: 12,
    color: '#6B7280',
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
  },
});
