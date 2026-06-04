import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Platform, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Star, X, Loader2, Heart, DollarSign, Wallet } from '../components/Icons';

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

const TIP_PRESETS = [2000, 5000, 10000, 20000];

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

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

  const [walletBalance, setWalletBalance] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [tipping, setTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    (async () => {
      const [bookingRes, balanceRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, walkers(*)')
          .eq('id', bookingId)
          .single(),
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return { data: null };
          return supabase
            .from('user_profiles')
            .select('balance')
            .eq('user_id', user.id)
            .maybeSingle();
        })(),
      ]);
      setBooking(bookingRes.data);
      if (balanceRes.data?.balance != null) {
        setWalletBalance(Number(balanceRes.data.balance));
      }
      setFetching(false);
    })();
  }, [bookingId]);

  const handleSelectPreset = (amount: number) => {
    if (amount > walletBalance) {
      Alert.alert(
        'Saldo insuficiente',
        `Tu billetera tiene ${formatCOP(walletBalance)}. Recargá fondos para dejar esta propina.`,
        [{ text: 'OK' }]
      );
      return;
    }
    setTipAmount(amount);
    setCustomTip('');
  };

  const handleCustomTip = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setCustomTip(clean);
    const num = parseInt(clean || '0', 10);
    setTipAmount(num);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Selecciona una puntuación');
      return;
    }

    if (tipAmount > walletBalance) {
      setError(`Saldo insuficiente. Tenés ${formatCOP(walletBalance)} en tu billetera.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario');

      console.log('[Rating] Booking:', JSON.stringify(booking, null, 2));
      console.log('[Rating] bookingId param:', bookingId, typeof bookingId);

      if (!bookingId) {
        throw new Error('bookingId no proporcionado');
      }

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

      const isUuid = String(bookingId).includes('-');
      const queryBookingId = isUuid ? bookingId : Number(bookingId);
      console.log('[Rating] Using bookingId as:', isUuid ? 'UUID string' : 'bigint', queryBookingId);

      const { data: reviewData, error: reviewError } = await supabase
        .from('booking_reviews')
        .insert([{
          booking_id: queryBookingId,
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
        .eq('id', queryBookingId)
        .select();

      console.log('[Rating] Booking update result:', updateData, 'error:', updateError);

      if (updateError) {
        throw new Error('No se pudo guardar la calificación: ' + updateError.message);
      }

      // 5. Process tip if user selected one
      if (tipAmount > 0) {
        setTipping(true);
        console.log('[Rating] Processing tip of', tipAmount, 'for booking', queryBookingId);

        const { data: tipResult, error: tipError } = await supabase.rpc('process_tip', {
          p_booking_id: queryBookingId,
          p_tip_amount: tipAmount,
        });

        console.log('[Rating] Tip result:', tipResult, 'error:', tipError);

        if (tipError) {
          // Tip failed - rating was already saved. Warn but don't block.
          console.error('[Rating] Tip failed but rating saved:', tipError);
          Alert.alert(
            'Reseña guardada',
            `Tu calificación se guardó correctamente, pero no pudimos procesar la propina: ${tipError.message}. Podés intentarlo de nuevo desde tu historial.`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }

        setTipSuccess(true);
        setTipping(false);
        // Show success and go back after 1.5s
        setTimeout(() => router.back(), 1800);
        return;
      }

      router.back();
    } catch (err: any) {
      console.error('[Rating] ERROR:', err);
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
      setTipping(false);
    }
  };

  const displayRating = hover || rating;
  const walkerName = booking?.walkers?.user_profiles?.first_name
    || booking?.walkers?.name
    || 'el paseador';

  if (fetching) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (tipSuccess) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <View style={styles.successIcon}>
          <Heart size={48} color="#EF4444" fill="#EF4444" />
        </View>
        <Text style={styles.successTitle}>¡Propina enviada!</Text>
        <Text style={styles.successSubtitle}>
          {formatCOP(tipAmount)} para {walkerName}
        </Text>
        <Text style={styles.successHint}>Recibirás el 100% — sin comisión</Text>
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.walkerName}>¿Cómo fue tu paseo con {walkerName}?</Text>

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

        {/* Tip section */}
        <View style={styles.tipSection}>
          <View style={styles.tipHeader}>
            <View style={styles.tipHeaderLeft}>
              <Heart size={20} color="#EF4444" fill="#EF4444" />
              <Text style={styles.tipTitle}>¿Querés dejar propina?</Text>
            </View>
            <View style={styles.walletBadge}>
              <Wallet size={12} color="#6B7280" />
              <Text style={styles.walletBalance}>{formatCOP(walletBalance)}</Text>
            </View>
          </View>

          <Text style={styles.tipSubtitle}>
            El 100% va al paseador, sin comisión. Se descuenta de tu billetera.
          </Text>

          <View style={styles.tipPresetsRow}>
            {TIP_PRESETS.map((amount) => {
              const selected = tipAmount === amount && !customTip;
              const disabled = amount > walletBalance;
              return (
                <TouchableOpacity
                  key={amount}
                  onPress={() => handleSelectPreset(amount)}
                  disabled={disabled}
                  style={[
                    styles.tipPreset,
                    selected && styles.tipPresetSelected,
                    disabled && styles.tipPresetDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.tipPresetText,
                      selected && styles.tipPresetTextSelected,
                      disabled && styles.tipPresetTextDisabled,
                    ]}
                  >
                    {formatCOP(amount)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.customTipRow}>
            <DollarSign size={18} color="#6B7280" />
            <TextInput
              style={styles.customTipInput}
              value={customTip}
              onChangeText={handleCustomTip}
              placeholder="Otro monto"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={8}
            />
            {tipAmount > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setTipAmount(0);
                  setCustomTip('');
                }}
                style={styles.clearTipBtn}
              >
                <X size={16} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>

          {tipAmount > 0 && (
            <View style={styles.tipConfirmRow}>
              <Text style={styles.tipConfirmText}>
                Vas a enviar <Text style={styles.tipConfirmAmount}>{formatCOP(tipAmount)}</Text> a {walkerName}
              </Text>
            </View>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (loading || tipping) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading || tipping}
        >
          {loading || tipping ? (
            <Loader2 size={20} color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>
              {tipAmount > 0 ? `Enviar Reseña y ${formatCOP(tipAmount)}` : 'Enviar Calificación'}
            </Text>
          )}
        </TouchableOpacity>

        {tipAmount > 0 && (
          <Text style={styles.tipFootnote}>
            Procesamos primero la calificación y luego la propina. Si la propina falla, igual queda la reseña.
          </Text>
        )}
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  walkerName: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
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
    minHeight: 110,
    marginBottom: 24,
  },
  tipSection: {
    width: '100%',
    backgroundColor: '#FFF7F7',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 20,
    marginBottom: 24,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tipHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  walletBalance: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  tipSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 16,
  },
  tipPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tipPreset: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FECACA',
    borderRadius: 14,
    alignItems: 'center',
  },
  tipPresetSelected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  tipPresetDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    opacity: 0.5,
  },
  tipPresetText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  tipPresetTextSelected: {
    color: '#EF4444',
  },
  tipPresetTextDisabled: {
    color: '#9CA3AF',
  },
  customTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  customTipInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 10,
    marginLeft: 4,
  },
  clearTipBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipConfirmRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
  },
  tipConfirmText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  tipConfirmAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginBottom: 12,
    textAlign: 'center',
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
  tipFootnote: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 14,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 8,
  },
  successHint: {
    fontSize: 14,
    color: '#6B7280',
  },
});
