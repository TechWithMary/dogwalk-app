import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { isWithinRadius } from '../../lib/distance';
import { Bell, Star, Clock, CreditCard, MapPin, ChevronRight, Dog, Loader2 } from '../../components/Icons';

interface Walker {
  id: string;
  name: string;
  location: string;
  rating: number;
  price: number;
  service_latitude?: number;
  service_longitude?: number;
  service_radius_km?: number;
  user_profiles?: {
    profile_photo_url: string;
    first_name?: string;
    last_name?: string;
  };
}

interface Booking {
  id: string;
  duration: string;
  scheduled_date: string;
  scheduled_time: string;
  total_price: number;
  status: string;
  walkers?: {
    id: string;
    name: string;
    user_profiles?: {
      first_name?: string;
    };
  };
}

const formatMoney = (val: number) => '$' + (val || 0).toLocaleString('es-CO');

const getStatusInfo = (status: string) => {
  const statuses: any = {
    'pending': { label: 'Por Pagar', color: '#F59E0B', bg: '#FEF3C7', border: '#FCD34D' },
    'confirmed': { label: 'Pagado', color: '#3B82F6', bg: '#DBEAFE', border: '#93C5FD' },
    'accepted': { label: 'En camino', color: '#3B82F6', bg: '#DBEAFE', border: '#93C5FD' },
    'picked_up': { label: 'Recogida', color: '#8B5CF6', bg: '#EDE9FE', border: '#C4B5FD' },
    'in_progress': { label: 'En curso', color: '#10B981', bg: '#D1FAE5', border: '#6EE7B7' },
    'completed': { label: 'Completado', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
  };
  return statuses[status] || { label: status, color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' };
};

export default function HomeScreen() {
  const router = useRouter();
  const [walkers, setWalkers] = useState<Walker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [upcomingWalk, setUpcomingWalk] = useState<Booking | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [bookingToRate, setBookingToRate] = useState<Booking | null>(null);
  const [petCount, setPetCount] = useState(0);
  const [displayName, setDisplayName] = useState('Amigo');

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, lat, lng')
        .eq('user_id', user.id)
        .maybeSingle();

      let finalName = 'Amigo';
      const fName = profile?.first_name || '';
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.first_name || '';

      const isInvalid = (n: string) => !n || n.toLowerCase() === 'usuario' || n.toLowerCase().includes('nuevo');

      if (!isInvalid(fName)) {
        finalName = fName.trim().split(' ')[0];
      } else if (!isInvalid(metaName)) {
        finalName = metaName.trim().split(' ')[0];
      }
      setDisplayName(finalName);

      const userLat = profile?.lat;
      const userLng = profile?.lng;

      let walkersRes: Walker[] = [];

      if (userLat && userLng) {
        const { data: allWalkers } = await supabase
          .from('walkers')
          .select('*, user_profiles(*)')
          .eq('overall_verification_status', 'approved');

        if (allWalkers) {
          walkersRes = allWalkers.filter((walker: Walker) => {
            if (!walker.service_latitude || !walker.service_longitude || !walker.service_radius_km) return false;
            return isWithinRadius(
              userLat, userLng,
              walker.service_latitude, walker.service_longitude,
              walker.service_radius_km
            );
          }).slice(0, 3);
        }
      } else {
        const { data: defaultWalkers } = await supabase
          .from('walkers')
          .select('*, user_profiles(*)')
          .eq('overall_verification_status', 'approved')
          .limit(3);
        walkersRes = defaultWalkers || [];
      }
      setWalkers(walkersRes);

      const { count: notificationsCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .eq('user_id', user.id);
      setUnreadNotifications(notificationsCount || 0);

      const { data: upcomingWalkRes } = await supabase
        .from('bookings')
        .select('*, walkers(*)')
        .eq('user_id', user.id)
        .in('status', ['pending', 'confirmed', 'accepted', 'picked_up', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setUpcomingWalk(upcomingWalkRes);

      const { count: petsCount } = await supabase
        .from('pets')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id);
      setPetCount(petsCount || 0);

      const { data: pendingReview } = await supabase
        .from('bookings')
        .select('*, walkers(*)')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .is('rating', null)
        .limit(1)
        .maybeSingle();

      if (pendingReview) {
        setBookingToRate(pendingReview);
        setShowRatingModal(true);
      } else {
        setShowRatingModal(false);
      }

    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleRate = () => {
    if (bookingToRate) {
      router.push({ pathname: '/rating', params: { bookingId: bookingToRate.id } });
    }
  };

  const getStatusBadge = (status: string) => {
    const info = getStatusInfo(status);
    return (
      <View style={[styles.statusBadge, { backgroundColor: info.bg }]}>
        <Text style={[styles.statusText, { color: info.color }]}>{info.label}</Text>
      </View>
    );
  };

  const parseDate = (dateStr: string) => {
    if (!dateStr) return { month: '', day: '' };
    const parts = dateStr.split('-');
    if (parts.length !== 3) return { month: '', day: '' };
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return {
      month: date.toLocaleDateString('es-CO', { month: 'short' }).toUpperCase(),
      day: parts[2]
    };
  };

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
            <View>
              <Text style={styles.greeting}>Hola, {displayName} 👋</Text>
              <Text style={styles.subtitle}>¿Listo para un nuevo paseo?</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={() => router.push('/notifications')}
            >
              <Bell size={22} color="#374151" />
              {unreadNotifications > 0 && <View style={styles.notificationDot} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.actionCards}>
            <TouchableOpacity
              style={styles.bookWalkCard}
              onPress={() => router.push('/booking')}
            >
              <Dog size={24} color="#FFFFFF" />
              <Text style={styles.bookWalkText}>Reservar un Paseo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.petsCard}
              onPress={() => router.push('/pets')}
            >
              <View style={styles.petsCardTop}>
                <Dog size={24} color="#3B82F6" />
                <Text style={styles.petsCount}>{petCount}</Text>
              </View>
              <Text style={styles.petsCardText}>Mis Mascotas</Text>
            </TouchableOpacity>
          </View>

          {showRatingModal && bookingToRate && (
            <TouchableOpacity style={styles.ratingBanner} onPress={handleRate}>
              <View style={styles.ratingBannerContent}>
                <Text style={styles.ratingBannerTitle}>Califica tu último paseo</Text>
                <Text style={styles.ratingBannerSubtitle}>Tus comentarios nos ayudan a mejorar</Text>
              </View>
              <Text style={styles.ratingBannerArrow}>⭐</Text>
            </TouchableOpacity>
          )}

          {upcomingWalk && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tu Paseo</Text>
              <View style={[styles.upcomingCard, { borderColor: getStatusInfo(upcomingWalk.status).border }]}>
                <View style={styles.upcomingMain}>
                  <View style={[styles.dateBox, { backgroundColor: getStatusInfo(upcomingWalk.status).bg }]}>
                    {(() => {
                      const { month, day } = parseDate(upcomingWalk.scheduled_date);
                      return (
                        <>
                          <Text style={[styles.dateMonth, { color: getStatusInfo(upcomingWalk.status).color }]}>{month}</Text>
                          <Text style={[styles.dateDay, { color: getStatusInfo(upcomingWalk.status).color }]}>{day}</Text>
                        </>
                      );
                    })()}
                  </View>
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingDuration}>Paseo de {upcomingWalk.duration}</Text>
                    <View style={styles.upcomingTimeRow}>
                      <Clock size={12} color="#9CA3AF" />
                      <Text style={styles.upcomingTime}>{upcomingWalk.scheduled_time}</Text>
                    </View>
                    {upcomingWalk.walkers && (
                      <Text style={styles.upcomingWalker}>🐕 {upcomingWalk.walkers.name || 'Paseador asignado'}</Text>
                    )}
                  </View>
                  <View style={styles.upcomingRight}>
                    <Text style={styles.upcomingPrice}>{formatMoney(upcomingWalk.total_price)}</Text>
                    {getStatusBadge(upcomingWalk.status)}
                  </View>
                </View>

                {upcomingWalk.status === 'in_progress' && (
                  <TouchableOpacity
                    style={styles.liveBtn}
                    onPress={() => router.push({ pathname: '/live-walk', params: { bookingId: upcomingWalk.id } })}
                  >
                    <Dog size={16} color="#FFFFFF" />
                    <Text style={styles.liveBtnText}>¡Mira a tu mascota en tiempo real!</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.detailsBtn, upcomingWalk.status === 'pending' && styles.payBtn]}
                  onPress={() => router.push({ pathname: '/booking-details', params: { id: upcomingWalk.id } })}
                >
                  <Text style={[styles.detailsBtnText, upcomingWalk.status === 'pending' && styles.payBtnText]}>
                    {upcomingWalk.status === 'pending' ? 'Completar Pago' : 'Ver detalles'}
                  </Text>
                  <ChevronRight size={16} color={upcomingWalk.status === 'pending' ? '#FFFFFF' : '#6B7280'} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Paseadores Verificados</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Loader2 size={24} color="#9CA3AF" />
            </View>
          ) : (
            <View style={styles.walkersList}>
              {walkers.map((walker) => {
                const profile = walker.user_profiles;
                const fullName = profile
                  ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                  : (walker.name || 'Paseador');

                return (
                  <TouchableOpacity
                    key={walker.id}
                    style={styles.walkerCard}
                    onPress={() => router.push({ pathname: '/walker-profile', params: { walkerId: walker.id } })}
                  >
                    <View style={styles.walkerImage}>
                      {profile?.profile_photo_url ? (
                        <Image
                          source={{ uri: profile.profile_photo_url }}
                          style={styles.walkerImg}
                        />
                      ) : (
                        <View style={[styles.walkerImg, styles.walkerImgPlaceholder]}>
                          <Text style={styles.walkerInitial}>
                            {(fullName || 'P')[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.ratingBadge}>
                        <Star size={8} color="#FBBF24" fill="#FBBF24" />
                        <Text style={styles.ratingText}>
                          {walker.rating ? walker.rating.toFixed(1) : 'Nuevo'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.walkerInfo}>
                      <View style={styles.walkerNameRow}>
                        <Text style={styles.walkerName}>{fullName}</Text>
                        <Text style={styles.walkerPrice}>{formatMoney(walker.price || 30000)}</Text>
                      </View>
                      <View style={styles.walkerLocationRow}>
                        <MapPin size={12} color="#9CA3AF" />
                        <Text style={styles.walkerLocation}>{walker.location || 'Medellín'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {showRatingModal && (
        <View style={styles.ratingModalOverlay}>
          <View style={styles.ratingModal}>
            <Text style={styles.ratingModalTitle}>¿Cómo fue tu paseo?</Text>
            <Text style={styles.ratingModalSubtitle}>Ayúdanos a mejorar con tu calificación</Text>
            <TouchableOpacity style={styles.ratingModalBtn} onPress={handleRate}>
              <Text style={styles.ratingModalBtnText}>Calificar Ahora</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowRatingModal(false)}>
              <Text style={styles.ratingModalSkip}>Más tarde</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 4,
  },
  notificationBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  content: {
    padding: 24,
  },
  actionCards: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  bookWalkCard: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 20,
    padding: 20,
    justifyContent: 'space-between',
    minHeight: 130,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookWalkText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  petsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    justifyContent: 'space-between',
    minHeight: 130,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  petsCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  petsCount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#3B82F6',
  },
  petsCardText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  ratingBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  ratingBannerContent: {
    flex: 1,
  },
  ratingBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  ratingBannerSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  ratingBannerArrow: {
    fontSize: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 16,
  },
  upcomingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  upcomingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: '800',
  },
  dateDay: {
    fontSize: 24,
    fontWeight: '900',
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingDuration: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  upcomingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  upcomingTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  upcomingWalker: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
    marginTop: 4,
  },
  upcomingRight: {
    alignItems: 'flex-end',
  },
  upcomingPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  liveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  liveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  detailsBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtn: {
    backgroundColor: '#F59E0B',
  },
  detailsBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '800',
  },
  payBtnText: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  walkersList: {
    gap: 16,
  },
  walkerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  walkerImage: {
    position: 'relative',
    marginRight: 12,
  },
  walkerImg: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  walkerImgPlaceholder: {
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkerInitial: {
    fontSize: 24,
    fontWeight: '900',
    color: '#10B981',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  ratingText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '800',
    marginLeft: 3,
  },
  walkerInfo: {
    flex: 1,
  },
  walkerNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walkerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  walkerPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#10B981',
  },
  walkerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  walkerLocation: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  ratingModalOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  ratingModal: {
    alignItems: 'center',
  },
  ratingModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  ratingModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 20,
  },
  ratingModalBtn: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingModalBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  ratingModalSkip: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
});