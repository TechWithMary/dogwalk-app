import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Bell, Star, Clock, CreditCard, MapPin, ChevronRight, Dog } from '../../components/Icons';

interface Walker {
  id: string;
  name: string;
  location: string;
  rating: number;
  price: number;
  img: string;
  user_profiles?: {
    profile_photo_url: string;
    first_name?: string;
    last_name?: string;
  };
}

const formatMoney = (val: number) => '$' + (val || 0).toLocaleString('es-CO');

export default function HomeScreen() {
  const router = useRouter();
  const [walkers, setWalkers] = useState<Walker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [upcomingWalk, setUpcomingWalk] = useState<any>(null);
  const [petCount, setPetCount] = useState(0);
  const [displayName, setDisplayName] = useState('Amigo');

  useEffect(() => {
    fetchData();
  }, []);

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

      const { data: defaultWalkers } = await supabase
        .from('walkers')
        .select('*, user_profiles(*)')
        .eq('overall_verification_status', 'approved')
        .limit(3);
      
      setWalkers(defaultWalkers || []);

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

    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getStatusInfo = (status: string) => {
    const statuses: any = {
      'pending': { label: 'Por Pagar', color: '#F59E0B', bg: '#FEF3C7', border: '#FCD34D' },
      'confirmed': { label: 'Pagado', color: '#3B82F6', bg: '#DBEAFE', border: '#93C5FD' },
      'accepted': { label: 'En camino', color: '#3B82F6', bg: '#DBEAFE', border: '#93C5FD' },
      'picked_up': { label: 'Recogida', color: '#8B5CF6', bg: '#EDE9FE', border: '#C4B5FD' },
      'in_progress': { label: 'En curso', color: '#10B981', bg: '#D1FAE5', border: '#6EE7B7' },
    };
    return statuses[status] || { label: status, color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' };
  };

  return (
    <View style={styles.container}>
      {/* Header - EXACTAMENTE IGUAL A LA WEB */}
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
            <Bell size={20} color="#6B7280" />
            {unreadNotifications > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} />
        }
      >
        <View style={styles.content}>
          {/* Action Cards - EXACTAMENTE IGUAL */}
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

          {/* Upcoming Walk - EXACTAMENTE IGUAL */}
          {upcomingWalk && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tu Paseo</Text>
              <View style={[styles.upcomingCard, { borderColor: getStatusInfo(upcomingWalk.status).border }]}>
                <View style={styles.upcomingMain}>
                  <View style={[styles.dateBox, { backgroundColor: getStatusInfo(upcomingWalk.status).bg }]}>
                    {(() => {
                      const dateParts = upcomingWalk.scheduled_date?.split('-');
                      const month = dateParts ? new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])).toLocaleDateString('es-CO', { month: 'short' }).toUpperCase() : '';
                      const dayNum = dateParts ? parseInt(dateParts[2]) : '';
                      return (
                        <>
                          <Text style={[styles.dateMonth, { color: getStatusInfo(upcomingWalk.status).color }]}>{month}</Text>
                          <Text style={[styles.dateDay, { color: getStatusInfo(upcomingWalk.status).color }]}>{dayNum}</Text>
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
                    <View style={[styles.statusBadge, { backgroundColor: getStatusInfo(upcomingWalk.status).bg }]}>
                      <Text style={[styles.statusText, { color: getStatusInfo(upcomingWalk.status).color }]}>
                        {getStatusInfo(upcomingWalk.status).label}
                      </Text>
                    </View>
                  </View>
                </View>

                {upcomingWalk.status === 'in_progress' && (
                  <TouchableOpacity 
                    style={styles.liveBtn}
                    onPress={() => router.push({ pathname: '/live-walk', params: { bookingId: upcomingWalk.id } })}
                  >
                    <Dog size={14} color="#FFFFFF" />
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
                  <ChevronRight size={14} color={upcomingWalk.status === 'pending' ? '#FFFFFF' : '#6B7280'} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Walkers List - EXACTAMENTE IGUAL */}
          <Text style={styles.sectionTitle}>Paseadores Verificados</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Cargando...</Text>
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
                        <View style={styles.walkerImgPlaceholder}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 30,
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
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 4,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellIcon: {
    fontSize: 20,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
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
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    height: 128,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookWalkText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  petsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    height: 128,
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
  petsCardIcon: {
    fontSize: 28,
  },
  petsCount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#3B82F6',
  },
  petsCardText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
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
    fontWeight: '700',
  },
  dateDay: {
    fontSize: 24,
    fontWeight: '900',
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingDuration: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  upcomingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  clockIcon: {
    fontSize: 12,
    marginRight: 4,
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
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  liveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    flexDirection: 'row',
    gap: 8,
  },
  liveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '700',
  },
  payBtnText: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
  },
  walkersList: {
    gap: 16,
  },
  walkerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
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
    marginRight: 12,
    position: 'relative',
  },
  walkerImg: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  walkerImgPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  ratingStar: {
    fontSize: 8,
  },
  ratingText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 2,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  walkerPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: '#10B981',
  },
  walkerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  walkerLocation: {
    fontSize: 10,
    color: '#9CA3AF',
  },
});
