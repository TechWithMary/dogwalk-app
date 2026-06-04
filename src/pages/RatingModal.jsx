import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Star, X, Loader2, MessageSquare, Heart, Wallet, DollarSign, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const TIP_PRESETS = [2000, 5000, 10000, 20000];

const formatCOP = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const RatingModal = ({ booking, onClose, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [tipping, setTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile?.balance != null) {
        setWalletBalance(Number(profile.balance));
      }
    })();
  }, []);

  const handleSelectPreset = (amount) => {
    if (amount > walletBalance) {
      toast.error(`Saldo insuficiente. Tenés ${formatCOP(walletBalance)} en tu billetera.`);
      return;
    }
    setTipAmount(amount);
    setCustomTip('');
  };

  const handleCustomTip = (text) => {
    const clean = text.replace(/[^0-9]/g, '');
    setCustomTip(clean);
    const num = parseInt(clean || '0', 10);
    setTipAmount(num);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Selecciona una puntuación');
      return;
    }

    if (!booking?.walker_id) {
      toast.error('Error: No hay paseador asociado a esta reserva');
      return;
    }

    if (tipAmount > walletBalance) {
      toast.error(`Saldo insuficiente. Tenés ${formatCOP(walletBalance)} en tu billetera.`);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario');

      console.log('[RatingModal] Booking:', booking);
      console.log('[RatingModal] booking.id type:', typeof booking.id, booking.id);

      if (!booking?.id) {
        throw new Error('booking.id no proporcionado');
      }

      const { data: walkerData, error: walkerError } = await supabase
        .from('walkers')
        .select('user_id')
        .eq('id', booking.walker_id)
        .maybeSingle();

      console.log('[RatingModal] Walker data:', walkerData, 'error:', walkerError);

      const revieweeId = walkerData?.user_id;
      if (!revieweeId) {
        throw new Error('No se encontró el usuario del paseador (walker_id=' + booking.walker_id + ')');
      }

      const isUuid = String(booking.id).includes('-');
      const queryBookingId = isUuid ? booking.id : Number(booking.id);
      console.log('[RatingModal] Using bookingId as:', isUuid ? 'UUID string' : 'bigint', queryBookingId);

      const { error: reviewError } = await supabase
        .from('booking_reviews')
        .insert([{
          booking_id: queryBookingId,
          reviewer_id: user.id,
          reviewee_id: revieweeId,
          rating: rating,
          comment: comment || null,
          overall_experience_rating: rating
        }]);

      if (reviewError) {
        console.error('[RatingModal] Review error:', reviewError);
        throw new Error('Error insertando reseña: ' + reviewError.message);
      }

      const { data: updateData, error: updateError } = await supabase
        .from('bookings')
        .update({ rating: rating, review_text: comment || null })
        .eq('id', queryBookingId)
        .select();

      console.log('[RatingModal] Booking update result:', updateData, 'error:', updateError);

      if (updateError) {
        console.error('[RatingModal] Update error:', updateError);
        throw new Error('No se pudo guardar la calificación: ' + updateError.message);
      }

      // Process tip if user selected one
      if (tipAmount > 0) {
        setTipping(true);
        console.log('[RatingModal] Processing tip of', tipAmount, 'for booking', queryBookingId);

        const { data: tipResult, error: tipError } = await supabase.rpc('process_tip', {
          p_booking_id: queryBookingId,
          p_tip_amount: tipAmount,
        });

        console.log('[RatingModal] Tip result:', tipResult, 'error:', tipError);

        if (tipError) {
          // Rating was saved but tip failed - warn but don't block
          console.error('[RatingModal] Tip failed but rating saved:', tipError);
          toast.success('¡Gracias por tu calificación!');
          toast.error(`Pero la propina falló: ${tipError.message}. Intentá de nuevo desde tu historial.`);
          onSuccess(queryBookingId);
          return;
        }

        setTipping(false);
        setTipSuccess(true);
        setTimeout(() => {
          onSuccess(queryBookingId);
        }, 1800);
        return;
      }

      toast.success('¡Gracias por tu calificación!');
      onSuccess(queryBookingId);
    } catch (error) {
      console.error('[RatingModal] ERROR:', error);
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
      setTipping(false);
    }
  };

  if (tipSuccess) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-8 text-center">
          <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart size={48} className="text-red-500 fill-current" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">¡Propina enviada!</h2>
          <p className="text-xl font-bold text-red-500 mb-2">{formatCOP(tipAmount)}</p>
          <p className="text-sm text-gray-500">El 100% va al paseador, sin comisión</p>
        </div>
      </div>
    );
  }

  if (!booking?.walker_id) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6">
          <div className="flex justify-end">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={20} className="text-gray-400" />
            </button>
          </div>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star size={32} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-black text-gray-800 mb-2">Paseo Completado</h2>
            <p className="text-gray-500 text-sm">No hay paseador asociado a esta reserva.</p>
            <button
              onClick={onClose}
              className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold mt-6"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-end">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={20} className="text-gray-400" />
            </button>
          </div>
          <div className="mb-4 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star size={32} className="text-yellow-500 fill-current" />
            </div>
            <h2 className="text-xl font-black text-gray-800">¿Cómo fue el paseo?</h2>
          </div>
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  size={36}
                  className={star <= (hover || rating) ? 'text-yellow-400 fill-current' : 'text-gray-200'}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentario opcional..."
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm outline-none mb-6 min-h-[80px]"
          />

          {/* Tip section */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart size={18} className="text-red-500 fill-current" />
                <h3 className="font-bold text-gray-800 text-sm">¿Querés dejar propina?</h3>
              </div>
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                <Wallet size={11} className="text-gray-500" />
                <span className="text-[10px] font-bold text-gray-500">{formatCOP(walletBalance)}</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">El 100% va al paseador, sin comisión.</p>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {TIP_PRESETS.map((amount) => {
                const selected = tipAmount === amount && !customTip;
                const disabled = amount > walletBalance;
                return (
                  <button
                    key={amount}
                    onClick={() => handleSelectPreset(amount)}
                    disabled={disabled}
                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-colors ${
                      selected
                        ? 'bg-red-100 border-red-500 text-red-500'
                        : disabled
                        ? 'bg-gray-50 border-gray-200 text-gray-300'
                        : 'bg-white border-red-200 text-gray-600 hover:border-red-400'
                    }`}
                  >
                    {formatCOP(amount)}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 mb-2">
              <DollarSign size={16} className="text-gray-400" />
              <input
                type="text"
                value={customTip}
                onChange={(e) => handleCustomTip(e.target.value)}
                placeholder="Otro monto"
                className="flex-1 ml-2 text-sm outline-none"
              />
              {tipAmount > 0 && (
                <button
                  onClick={() => { setTipAmount(0); setCustomTip(''); }}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </div>
            {tipAmount > 0 && (
              <p className="text-xs text-center text-gray-600 pt-2 border-t border-red-200">
                Vas a enviar <span className="font-bold text-red-500">{formatCOP(tipAmount)}</span>
              </p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || tipping}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading || tipping ? (
              <Loader2 className="animate-spin" />
            ) : tipAmount > 0 ? (
              `Enviar Reseña y ${formatCOP(tipAmount)}`
            ) : (
              'Enviar Calificación'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingModal;
