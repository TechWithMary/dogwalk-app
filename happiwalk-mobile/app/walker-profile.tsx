import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

interface Walker {
  id: string;
  name: string;
  location: string;
  rating: number;
  price: number;
  description?: string;
  verified_at?: string;
  user_profiles?: {
    profile_photo_url: string;
    phone?: string;
    bio?: string;
  };
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  owner: {
    name: string;
    user_profiles: {
      profile_photo_url: string;
    };
  };
}

export default function WalkerProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const walkerId = params.walkerId as string;

  const [walker, setWalker] = useState<Walker | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (walkerId) {
      fetchWalker();
    }
  }, [walkerId]);

  const fetchWalker = async () => {
    try {
      const { data: walkerData, error: walkerError } = await supabase
        .from('walkers')
        .select('*, user_profiles(*)')
        .eq('id', walkerId)
        .single();

      if (walkerError) throw walkerError;
      setWalker(walkerData);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select(`
          *,
          owner:users(name, user_profiles(profile_photo_url))
        `)
        .eq('walker_id', walkerId)
        .order('created_at', { ascending: false })
        .limit(10);

      setReviews(reviewsData || []);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudo cargar el perfil del paseador');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return '$' + (price || 30000).toLocaleString('es-CO');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (!walker) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Paseador no encontrado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil del Paseador</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.profileImageContainer}>
            {walker.user_profiles?.profile_photo_url ? (
              <Image
                source={{ uri: walker.user_profiles.profile_photo_url }}
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                <Text style={styles.profileInitial}>
                  {(walker.name || 'P')[0].toUpperCase()}
                </Text>
              </View>
            )}
            {walker.verified_at && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            )}
          </View>
          <Text style={styles.walkerName}>{walker.name}</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationText}>📍 {walker.location || 'Medellín'}</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>⭐ {walker.rating ? walker.rating.toFixed(1) : 'Nuevo'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>💰 {formatPrice(walker.price)}/hr</Text>
            </View>
          </View>
        </View>

        {walker.user_profiles?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acerca de</Text>
            <Text style={styles.bioText}>{walker.user_profiles.bio}</Text>
          </View>
        )}

        {walker.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.descriptionText}>{walker.description}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reseñas ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <Text style={styles.emptyReviewsText}>Aún no hay reseñas</Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  {review.owner?.user_profiles?.profile_photo_url ? (
                    <Image
                      source={{ uri: review.owner.user_profiles.profile_photo_url }}
                      style={styles.reviewerImage}
                    />
                  ) : (
                    <View style={[styles.reviewerImage, styles.reviewerImagePlaceholder]}>
                      <Text style={styles.reviewerInitial}>
                        {(review.owner?.name || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.reviewerInfo}>
                    <Text style={styles.reviewerName}>{review.owner?.name || 'Usuario'}</Text>
                    <View style={styles.reviewRating}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Text key={i} style={styles.star}>
                          {i < Math.floor(review.rating) ? '⭐' : '☆'}
                        </Text>
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('es-CO')}
                  </Text>
                </View>
                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => router.push({ pathname: '/booking', params: { walkerId } })}
        >
          <Text style={styles.bookBtnText}>
            Reservar {walker.name?.split(' ')[0] || 'Paseo'}
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    fontWeight: '700',
    color: '#111827',
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
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
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 40,
    fontWeight: '800',
    color: '#10B981',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  walkerName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  descriptionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  emptyReviews: {
    padding: 20,
    alignItems: 'center',
  },
  emptyReviewsText: {
    color: '#9CA3AF',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerImagePlaceholder: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  reviewRating: {
    flexDirection: 'row',
    marginTop: 2,
  },
  star: {
    fontSize: 12,
    marginRight: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reviewComment: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  bottomBar: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bookBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
