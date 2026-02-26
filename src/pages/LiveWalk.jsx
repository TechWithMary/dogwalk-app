import React, { useEffect, useState } from 'react';
import { Phone, MessageSquare, Shield, Star, Loader2, CheckCircle, Navigation } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const containerStyle = { width: '100%', height: '100%' };

const LiveWalk = ({ setView }) => {
    const [booking, setBooking] = useState(null);
    const [walker, setWalker] = useState(null);
    const [status, setStatus] = useState('loading');
    const [walkerCoords, setWalkerCoords] = useState(null);

    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY
    });

    useEffect(() => {
        let subscription;
        let locationChannel;

        const fetchCurrentWalk = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('user_id', user.id)
                .is('rating', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                setBooking(data);
                setStatus(data.status);
                if (data.walker_id) fetchWalkerProfile(data.walker_id);

                // SUSCRIPCIÓN A CAMBIOS DE ESTADO
                subscription = supabase
                    .channel('live-walk-updates')
                    .on(
                        'postgres_changes',
                        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${data.id}` },
                        (payload) => {
                            setStatus(payload.new.status);
                        }
                    )
                    .subscribe();

                // SUSCRIPCIÓN A UBICACIÓN EN TIEMPO REAL
                locationChannel = supabase
                    .channel(`walker-location-${data.id}`)
                    .on(
                        'postgres_changes',
                        { 
                            event: 'INSERT', 
                            schema: 'public', 
                            table: 'locations', 
                            filter: `booking_id=eq.${data.id}` 
                        },
                        (payload) => {
                            setWalkerCoords({
                                lat: payload.new.latitude,
                                lng: payload.new.longitude
                            });
                        }
                    )
                    .subscribe();
            } else {
                setStatus('no_walk');
            }
        };

        fetchCurrentWalk();

        return () => { 
            if (subscription) supabase.removeChannel(subscription); 
            if (locationChannel) supabase.removeChannel(locationChannel);
        };
    }, []);

    const fetchWalkerProfile = async (walkerId) => {
        const { data } = await supabase.from('walkers').select('*').eq('id', walkerId).single();
        if (data) setWalker(data);
    };

    const submitReview = async () => {
        if (rating === 0) {
            alert("Selecciona al menos 1 estrella ⭐");
            return;
        }
        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ rating: rating, review_text: review })
                .eq('id', booking.id);

            if (error) throw error;
            setView('/home');
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (status === 'no_walk') {
        return (
            <div className="h-screen flex flex-col items-center justify-center p-6 bg-white text-center">
                <Navigation className="w-10 h-10 text-gray-400 mb-4" />
                <h2 className="text-xl font-bold mb-2 text-gray-800">Todo tranquilo</h2>
                <button onClick={() => setView('/home')} className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold">Volver</button>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-50 relative">
            <div className={`absolute inset-0 z-0 ${status === 'completed' ? 'opacity-20 blur-sm' : 'opacity-100'}`}>
                {isLoaded && booking && (
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={walkerCoords || { lat: booking.lat, lng: booking.lng }}
                        zoom={16}
                        options={{ disableDefaultUI: true }}
                    >
                        {/* Marcador de la Casa */}
                        <Marker position={{ lat: booking.lat, lng: booking.lng }} />
                        
                        {/* Marcador del Paseador (El perrito moviéndose) */}
                        {walkerCoords && (
                            <Marker 
                                position={walkerCoords}
                                icon={{
                                    url: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
                                    scaledSize: new window.google.maps.Size(40, 40)
                                }}
                            />
                        )}
                    </GoogleMap>
                )}
            </div>

            {status !== 'completed' && (
                <button onClick={() => setView('/home')} className="absolute top-4 left-4 z-10 bg-white p-2 rounded-full shadow-md">
                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
            )}

            <div className={`absolute bottom-0 left-0 w-full bg-white rounded-t-[30px] shadow-lg z-10 p-6 transition-all ${status === 'completed' ? 'h-[70%]' : 'min-h-[30%]'}`}>
                {status === 'pending' && (
                    <div className="text-center py-4">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" />
                        <h2 className="text-xl font-black">Buscando paseador...</h2>
                    </div>
                )}

                {(status === 'accepted' || status === 'in_progress') && walker && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black">{status === 'accepted' ? '¡Paseador asignado!' : 'Paseo en curso'}</h2>
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">En vivo</span>
                        </div>
                        <div className="flex items-center gap-4 mb-6">
                            <img src={walker.img || 'https://via.placeholder.com/150'} className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500" />
                            <div className="flex-1">
                                <h3 className="font-bold">{walker.name}</h3>
                                <div className="flex items-center gap-1 text-yellow-500 text-sm"><Star size={14} fill="currentColor" /> {walker.rating || 'Nuevo'}</div>
                            </div>
                            <div className="flex gap-2">
                                <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><Phone size={18} /></button>
                                <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><MessageSquare size={18} /></button>
                            </div>
                        </div>
                    </div>
                )}

                {status === 'completed' && (
                    <div className="text-center h-full flex flex-col">
                        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                        <h2 className="text-2xl font-black mb-6">¡Paseo Finalizado!</h2>
                        <div className="flex justify-center gap-3 mb-6">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <button key={s} onClick={() => setRating(s)}>
                                    <Star size={36} className={s <= rating ? 'text-yellow-400 fill-current' : 'text-gray-200'} />
                                </button>
                            ))}
                        </div>
                        <textarea 
                            value={review} 
                            onChange={(e) => setReview(e.target.value)}
                            placeholder="Comentario opcional..."
                            className="w-full bg-gray-50 p-4 rounded-xl border mb-4 text-sm"
                            rows="3"
                        />
                        <button onClick={submitReview} disabled={submitting} className="w-full bg-black text-white py-4 rounded-xl font-bold mt-auto">
                            {submitting ? 'Enviando...' : 'Calificar Paseo'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveWalk;