import React, { useEffect, useState } from 'react';
import { Phone, MessageSquare, Shield, Star, Loader2, CheckCircle, Navigation } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

// --- TU API KEY AQUÍ ---
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
// ----------------------

const containerStyle = { width: '100%', height: '100%' };

const LiveWalk = ({ setView }) => {
    const [booking, setBooking] = useState(null);
    const [walker, setWalker] = useState(null);
    const [status, setStatus] = useState('loading');

    // Estados para la Calificación
    const [rating, setRating] = useState(0); // 1 a 5 estrellas
    const [review, setReview] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY
    });

    useEffect(() => {
        let subscription;

        const fetchCurrentWalk = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Buscamos la última reserva activa O la última completada sin calificar
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('user_id', user.id)
                .is('rating', null) // <--- Solo traemos las que NO tienen calificación aún
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Error:", error);
            }

            if (data) {
                setBooking(data);
                setStatus(data.status);
                if (data.walker_id) fetchWalkerProfile(data.walker_id);

                subscription = supabase
                    .channel('live-walk-updates')
                    .on(
                        'postgres_changes',
                        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${data.id}` },
                        (payload) => {
                            setStatus(payload.new.status);
                            if (payload.new.walker_id && !walker) fetchWalkerProfile(payload.new.walker_id);
                        }
                    )
                    .subscribe();
            } else {
                setStatus('no_walk');
            }
        };

        fetchCurrentWalk();

        return () => { if (subscription) supabase.removeChannel(subscription); };
    }, [walker]);

    const fetchWalkerProfile = async (walkerId) => {
        const { data } = await supabase.from('walkers').select('*').eq('id', walkerId).single();
        if (data) setWalker(data);
    };

    // --- FUNCIÓN ENVIAR RESEÑA ---
    const submitReview = async () => {
        if (rating === 0) {
            alert("Por favor selecciona al menos 1 estrella ⭐");
            return;
        }
        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('bookings')
                .update({
                    rating: rating,
                    review_text: review
                })
                .eq('id', booking.id);

            if (error) throw error;

            alert("¡Gracias por tu opinión! ⭐");
            setView('/home'); // Volvemos al home, ciclo cerrado.

        } catch (error) {
            alert("Error guardando reseña: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (status === 'no_walk') {
        return (
            <div className="h-screen flex flex-col items-center justify-center p-6 bg-white text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Navigation className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Todo tranquilo por aquí</h2>
                <p className="text-gray-400 text-sm mb-6">No tienes paseos activos ni pendientes de calificar.</p>
                <button onClick={() => setView('/home')} className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-600 transition">
                    Volver al Inicio
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-50 relative">

            {/* MAPA DE FONDO (Solo visible si no ha terminado) */}
            <div className={`absolute inset-0 z-0 ${status === 'completed' ? 'opacity-20 blur-sm' : 'opacity-100'}`}>
                {isLoaded && booking && (
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={{ lat: booking.lat || 6.2442, lng: booking.lng || -75.5812 }}
                        zoom={15}
                        options={{ disableDefaultUI: true }}
                    >
                        <Marker position={{ lat: booking.lat || 6.2442, lng: booking.lng || -75.5812 }} />
                    </GoogleMap>
                )}
            </div>

            {status !== 'completed' && (
                <button onClick={() => setView('/home')} className="absolute top-4 left-4 z-10 bg-white/90 p-2 rounded-full shadow-md">
                    <Navigation className="w-5 h-5 text-gray-700" />
                </button>
            )}

            {/* PANEL INFERIOR */}
            <div className={`absolute bottom-0 left-0 w-full bg-white rounded-t-[30px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-10 p-6 pb-8 transition-all duration-500 ${status === 'completed' ? 'h-[70%]' : 'min-h-[30%]'}`}>

                {/* ESTADO 1: PENDIENTE */}
                {status === 'pending' && (
                    <div className="text-center py-4">
                        <div className="relative w-16 h-16 mx-auto mb-4">
                            <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping"></div>
                            <div className="relative bg-emerald-500 w-full h-full rounded-full flex items-center justify-center text-white">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                        </div>
                        <h2 className="text-xl font-black text-gray-900 mb-1">Buscando paseador...</h2>
                        <div className="mt-6 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-1/3 animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                )}

                {/* ESTADO 2: EN CURSO */}
                {(status === 'accepted' || status === 'in_progress') && walker && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-black text-gray-900">
                                {status === 'accepted' ? '¡Paseador Encontrado!' : 'Paseo en Curso'}
                            </h2>
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">Activo</span>
                        </div>
                        <div className="flex items-center gap-4 mb-6">
                            <img src={walker.img} alt={walker.name} className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 p-0.5" />
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-lg">{walker.name}</h3>
                                <div className="flex items-center gap-1 text-yellow-500 text-sm font-bold">
                                    <Star className="w-4 h-4 fill-current" /> {walker.rating}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-emerald-100 hover:text-emerald-600"><Phone className="w-5 h-5" /></button>
                                <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-emerald-100 hover:text-emerald-600"><MessageSquare className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl flex items-start gap-3 border border-gray-100">
                            <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-gray-800 mb-0.5">Paseo Seguro</p>
                                <p className="text-[10px] text-gray-400">Monitoreo GPS activo.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ESTADO 3: FINALIZADO Y CALIFICACIÓN */}
                {status === 'completed' && (
                    <div className="text-center h-full flex flex-col">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-1">¡Paseo Finalizado!</h2>
                        <p className="text-gray-500 text-sm mb-6">¿Cómo estuvo {walker?.name || 'el paseador'}?</p>

                        {/* SELECTOR DE ESTRELLAS */}
                        <div className="flex justify-center gap-3 mb-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className="transition-transform hover:scale-110 focus:outline-none"
                                >
                                    <Star
                                        className={`w-10 h-10 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-100'}`}
                                    />
                                </button>
                            ))}
                        </div>

                        {/* CAMPO DE TEXTO */}
                        <textarea
                            placeholder="Escribe un comentario (opcional)..."
                            value={review}
                            onChange={(e) => setReview(e.target.value)}
                            className="w-full bg-gray-50 rounded-xl p-4 text-sm outline-none border border-gray-100 focus:ring-2 focus:ring-emerald-100 resize-none mb-4"
                            rows="3"
                        ></textarea>

                        <button
                            onClick={submitReview}
                            disabled={submitting}
                            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition-all mt-auto disabled:opacity-70"
                        >
                            {submitting ? 'Enviando...' : 'Enviar Calificación'}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default LiveWalk;