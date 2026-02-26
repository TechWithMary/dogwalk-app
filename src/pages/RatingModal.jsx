import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Star, X, Loader2, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const RatingModal = ({ booking, onClose, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Selecciona una puntuación');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: reviewError } = await supabase
        .from('booking_reviews')
        .insert([{
          booking_id: booking.id,
          reviewer_id: user.id,
          reviewee_id: booking.walker_id,
          rating: rating,
          comment: comment
        }]);

      if (reviewError) throw reviewError;

      await supabase
        .from('bookings')
        .update({ rating: rating, review_text: comment })
        .eq('id', booking.id);

      toast.success('¡Gracias por tu calificación!');
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 text-center">
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
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm outline-none mb-6 min-h-[100px]"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Enviar Calificación'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingModal;