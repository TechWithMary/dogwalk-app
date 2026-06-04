import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Star, X, Loader2 } from '../components/Icons';

interface Booking {
  id: string;
  walker_id: string;
  duration: string;
  total_price: number;
  walkers?: {
    user_id: string;
    name: string;
    user_profiles?: {
      first_name?: string;
      last_name?: string;
    };
  };
}

export default function RatingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.bookingId as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) return;
    (async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*, walkers(*)')
        .eq('id', bookingId)
        .single();
      setBooking(data);
      setFetching(false);
    })();
  }, [bookingId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Selecciona una puntuación');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario');

      console.log('[Rating] Booking:', JSON.stringify(booking, null, 2));
      console.log('[Rating] bookingId param:', bookingId, typeof bookingId);

      let revieweeId = '';

      if (booking?.walker_id) {
        const { data: walkerData, error: walkerError } = await supabase
          .from('walkers')
          .select('user_id')
          .eq('id', booking.walker_id)
          .maybeSingle();

        console.log('[Rating] Walker data:', walkerData, 'error:', walkerError);
        revieweeId = walkerData?.user_id || '';
      }

      if (!revieweeId) {
        throw new Error('No se encontró el paseador (booking.walker_id=' + booking?.walker_id + ')');
      }

      const numericBookingId = Number(bookingId);
      if (!numericBookingId || isNaN(numericBookingId)) {
        throw new Error('bookingId inválido: ' + bookingId);
      }

      console.log('[Rating] Inserting review with booking_id:', numericBookingId, 'reviewee:', revieweeId);

      const { data: reviewData, error: reviewError } = await supabase
        .from('booking_reviews')
        .insert([{
          booking_id: numericBookingId,
          reviewer_id: user.id,
          reviewee_id: revieweeId,
          rating: rating,
          comment: comment.trim() || null,
          overall_experience_rating: rating,
        }])
        .select();

      console.log('[Rating] Review insert result:', reviewData, 'error:', reviewError);

      if (reviewError) {
        throw new Error('Error insertando reseña: ' + reviewError.message);
      }

      console.log('[Rating] Updating booking rating...');
      const { data: updateData, error: updateError } = await supabase
        .from('bookings')
        .update({ rating: rating, review_text: comment.trim() || null })
        .eq('id', numericBookingId)
        .select();

      console.log('[Rating] Booking update result:', updateData, 'error:', updateError);

      if (updateError) {
        throw new Error('No se pudo guardar la calificación: ' + updateError.message);
      }

      router.back();
    } catch (err: any) {
      console.error('[Rating] ERROR:', err);
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const displayRating = hover || rating;

  if (fetching) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <X size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calificar Paseo</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              onPressIn={() => setHover(star)}
              onPressOut={() => setHover(0)}
              style={styles.starBtn}
            >
              <Star
                size={40}
                color={star <= displayRating ? '#FBBF24' : '#E5E7EB'}
                fill={star <= displayRating ? '#FBBF24' : 'none'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder="¿Cómo fue tu experiencia? (opcional)"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={20} color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Enviar Calificación</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  starBtn: {
    padding: 8,
  },
  commentInput: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
    fontSize: 15,
    color: '#111827',
    minHeight: 120,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginBottom: 12,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});