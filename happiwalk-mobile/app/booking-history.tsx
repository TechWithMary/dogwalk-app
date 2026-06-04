import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, getSignedAvatarUrl } from '../lib/supabase';
import { ChevronLeft, Clock, Calendar, Dog, Heart } from '../components/Icons';
import EmptyState from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';

type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'accepted'
  | 'pickup_requested'
  | 'picked_up'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

type TabKey = 'upcoming' | 'completed' | 'cancelled';

interface WalkerProfile {
  first_name?: string;
  last_name?: string;
  profile_photo_url?: string;
}

interface Walker {
  id: string;
  name: string;
  user_id?: string;
  img?: string;
  rating?: number;
  user_profiles?: WalkerProfile;
}

interface Pet {
  id: string;
  name: string;
}

interface Booking {
  id: string;
  status: BookingStatus;
  scheduled_date: string;
  scheduled_time: string;
  duration: string;
  total_price: number;
  walker_id: string | null;
  pet_ids: string[];
  created_at: string;
  tip_amount?: number;
  walkers: Walker | null;
}

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: 'Por Pagar', color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' },
  confirmed: { label: 'Pagado', color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' },
  accepted: { label: 'En Camino', color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' },
  pickup_requested: { label: 'Esperando', color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' },
  picked_up: { label: 'Recogida', color: '#7C3AED', bg: '#EDE9FE', border: '#C4B5FD' },
  in_progress: { label: 'En Curso', color: '#052e05', bg: '#D1FAE5', border: '#6EE7B7' },
  completed: { label: 'Completado', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
  cancelled: { label: 'Cancelado', color: '#EF4444', bg: '#FEE2E2', border: '#FCA5A5' },
};

const UPCOMING_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'accepted', 'pickup_requested', 'picked_up', 'in_progress'];

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'Próximas' },
  { key: 'completed', label: 'Completadas' },
  { key: 'cancelled', label: 'Canceladas' },
];

function groupByTab(status: BookingStatus): TabKey {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'upcoming';
}

function formatLocalDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatMoney(price: number): string {
  return '$' + (price || 0).toLocaleString('es-CO');
}

const PAGE_SIZE = 20;

export default function BookingHistoryScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pets, setPets] = useState<Record<string, Pet>>({});
  const [walkerPhotos, setWalkerPhotos] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');

  const fetchBookings = useCallback(async (pageNum: number, append: boolean = false) => {
    if (append) setLoadingMore(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('bookings')
        .select('*, walkers(id, name, user_id, img, rating, user_profiles(first_name, last_name, profile_photo_url))')
        .eq('user_id', user.id)
        .order('scheduled_date', { ascending: false })
        .order('scheduled_time', { ascending: false })
        .range(from, to);

      if (error) throw error;
      const newBookings = (data || []) as unknown as Booking[];
      setHasMore(newBookings.length === PAGE_SIZE);

      if (append) {
        setBookings(prev => [...prev, ...newBookings]);
      } else {
        setBookings(newBookings);
      }

      const allPetIds = new Set<string>();
      const walkerUserIds = new Set<string>();
      newBookings.forEach((b: any) => {
        if (b.pet_ids && Array.isArray(b.pet_ids)) {
          b.pet_ids.forEach((id: string) => allPetIds.add(id));
        }
        if (b.walkers?.user_id) {
          walkerUserIds.add(b.walkers.user_id);
        }
      });

      if (allPetIds.size > 0) {
        const { data: petsData } = await supabase
          .from('pets')
          .select('id, name')
          .in('id', Array.from(allPetIds));
        const petMap: Record<string, Pet> = {};
        (petsData || []).forEach((p: Pet) => { petMap[p.id] = p; });
        setPets(prev => ({ ...prev, ...petMap }));
      }

      const newWalkerIds = Array.from(walkerUserIds).filter(id => !walkerPhotos[id]);
      if (newWalkerIds.length > 0) {
        const photoPromises = newWalkerIds.map(async (userId) => {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('profile_photo_url')
            .eq('user_id', userId)
            .single();
          const photoUrl = profile?.profile_photo_url || null;
          const signedUrl = await getSignedAvatarUrl(photoUrl);
          return { userId, signedUrl };
        });
        const photoResults = await Promise.all(photoPromises);
        const photoMap: Record<string, string | null> = {};
        photoResults.forEach(({ userId, signedUrl }) => {
          photoMap[userId] = signedUrl;
        });
        setWalkerPhotos(prev => ({ ...prev, ...photoMap }));
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'No se pudieron cargar las reservas. Desliza para reintentar.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings(0);
  }, [fetchBookings]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    fetchBookings(0);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchBookings(nextPage, true);
  };

  const filteredBookings = bookings.filter((b) => groupByTab(b.status) === activeTab);

  const getWalkerDisplayName = (booking: Booking): string => {
    if (booking.walkers?.name) return booking.walkers.name;
    if (booking.walkers?.user_profiles?.first_name) return booking.walkers.user_profiles.first_name;
    return 'Paseador';
  };

  const getWalkerInitial = (booking: Booking): string => {
    const name = getWalkerDisplayName(booking);
    return name[0].toUpperCase();
  };

  const getPetNames = (booking: Booking): string => {
    if (!booking.pet_ids || booking.pet_ids.length === 0) return '';
    return booking.pet_ids
      .map((id) => pets[id]?.name)
      .filter(Boolean)
      .join(', ');
  };

  const renderBookingCard = ({ item }: { item: Booking }) => {
    const statusInfo = STATUS_CONFIG[item.status];
    const walkerPhoto = item.walkers?.user_id ? walkerPhotos[item.walkers.user_id] : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/booking-details', params: { id: item.id } })}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={styles.walkerRow}>
            {walkerPhoto ? (
              <Image source={{ uri: walkerPhoto }} style={styles.walkerPhoto} />
            ) : (
              <View style={styles.walkerPlaceholder}>
                <Text style={styles.walkerInitial}>{getWalkerInitial(item)}</Text>
              </View>
            )}
            <View style={styles.walkerInfo}>
              <Text style={styles.walkerName} numberOfLines={1}>{getWalkerDisplayName(item)}</Text>
              {item.walkers?.rating != null && (
                <Text style={styles.walkerRating}>⭐ {item.walkers.rating.toFixed(1)}</Text>
              )}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Calendar size={14} color="#9CA3AF" />
            <Text style={styles.detailText}>{formatLocalDate(item.scheduled_date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Clock size={14} color="#9CA3AF" />
            <Text style={styles.detailText}>{item.scheduled_time} · {item.duration}</Text>
          </View>
          {getPetNames(item) ? (
            <View style={styles.detailRow}>
              <Dog size={14} color="#9CA3AF" />
              <Text style={styles.detailText}>{getPetNames(item)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardBottom}>
          <View>
            <Text style={styles.priceLabel}>Total</Text>
            {(item.tip_amount ?? 0) > 0 && (
              <View style={styles.tipLine}>
                <Heart size={11} color="#EF4444" fill="#EF4444" />
                <Text style={styles.tipLineText}>+{formatMoney(item.tip_amount || 0)} propina</Text>
              </View>
            )}
          </View>
          <Text style={styles.priceValue}>{formatMoney(item.total_price)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const emptyConfig: Record<TabKey, { title: string; subtitle: string; actionLabel?: string }> = {
      upcoming: { title: 'Sin reservas próximas', subtitle: 'Cuando hagas una reserva, aparecerá aquí', actionLabel: 'Reservar un Paseo' },
      completed: { title: 'Sin reservas completadas', subtitle: 'Tus paseos completados se mostrarán aquí' },
      cancelled: { title: 'Sin cancelaciones', subtitle: 'No tienes reservas canceladas' },
    };
    const config = emptyConfig[activeTab];

    return (
      <EmptyState
        icon={<Dog size={36} color="#0EA5E9" />}
        title={config.title}
        description={config.subtitle}
        actionLabel={config.actionLabel}
        onAction={config.actionLabel ? () => router.push('/booking') : undefined}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mis Reservas</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.skeletonContainer}>
          <SkeletonCard count={3} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Reservas</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const count = bookings.filter((b) => groupByTab(b.status) === tab.key).length;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredBookings}
        renderItem={renderBookingCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={hasMore ? (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={handleLoadMore}
            disabled={loadingMore}
            activeOpacity={0.7}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#052e05" />
            ) : (
              <Text style={styles.loadMoreText}>Cargar más</Text>
            )}
          </TouchableOpacity>
        ) : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#0EA5E9']}
            tintColor="#0EA5E9"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  headerRight: {
    width: 36,
  },
skeletonContainer: {
    flex: 1,
    padding: 16,
    paddingTop: 24,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#ECFDF5',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#052e05',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: {
    backgroundColor: '#A7F3D0',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  tabBadgeTextActive: {
    color: '#052e05',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  walkerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  walkerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  walkerPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkerInitial: {
    fontSize: 16,
    fontWeight: '900',
    color: '#052e05',
  },
  walkerInfo: {
    marginLeft: 10,
    flex: 1,
  },
  walkerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  walkerRating: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDetails: {
    gap: 6,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#052e05',
  },
  tipLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  tipLineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  loadMoreBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#052e05',
  },
});