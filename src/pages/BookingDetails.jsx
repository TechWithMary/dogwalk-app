import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, MapPin, Clock, Dog, Phone, MessageSquare, Navigation, CheckCircle, Check, Loader2, MapPinned, PawPrint } from 'lucide-react';
import toast from 'react-hot-toast';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const BookingDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingId = location.state?.bookingId;
  
  const [booking, setBooking] = useState(null);
  const [walker, setWalker] = useState(null);
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [walkerLocation, setWalkerLocation] = useState(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
    language: 'es',
    region: 'CO'
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (!bookingId) {
        setLoading(false);
        return;
      }

      const { data: bookingData } = await supabase
        .from('bookings')
        .select('*, walkers(*)')
        .eq('id', bookingId)
        .single();

      setBooking(bookingData);

      if (bookingData?.walker_id) {
        const { data: walkerProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', bookingData.walkers?.user_id)
          .single();
        setWalker(walkerProfile);
      }

      let petsData = [];
      
      // Si hay mascotas específicas guardadas en la reserva, obtenerlas
      const petIds = bookingData?.pet_ids;
      if (petIds && Array.isArray(petIds) && petIds.length > 0) {
        const { data: specificPets } = await supabase
          .from('pets')
          .select('*')
          .in('id', petIds);
        petsData = specificPets || [];
      } else {
        // Si no hay pet_ids, obtener todas las mascotas del dueño
        const { data: allPets } = await supabase
          .from('pets')
          .select('*')
          .eq('owner_id', bookingData?.user_id);
        petsData = allPets || [];
      }

      setPets(petsData || []);

      setLoading(false);
    };

    fetchData();
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase
      .channel('booking-updates-' + bookingId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`
        },
        (payload) => {
          if (payload.new) {
            setBooking(prev => ({ ...prev, ...payload.new }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  useEffect(() => {
    if (booking?.status !== 'in_progress' || !booking?.id) return;

    const fetchWalkerLocation = async () => {
      const { data: locationData } = await supabase
        .from('locations')
        .select('*')
        .eq('booking_id', booking.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (locationData) {
        setWalkerLocation({
          lat: parseFloat(locationData.latitude),
          lng: parseFloat(locationData.longitude)
        });
      }
    };

    fetchWalkerLocation();

    const channel = supabase
      .channel('tracking-' + booking.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'locations',
          filter: `booking_id=eq.${booking.id}`
        },
        (payload) => {
          if (payload.new) {
            setWalkerLocation({
              lat: parseFloat(payload.new.latitude),
              lng: parseFloat(payload.new.longitude)
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [booking?.status, booking?.id]);

  const getStatusInfo = (status) => {
    const statuses = {
      'pending': { label: 'Por Confirmar', color: 'orange', icon: '⏳' },
      'confirmed': { label: 'Confirmado', color: 'blue', icon: '✓' },
      'accepted': { label: 'En camino', color: 'blue', icon: '🚶' },
      'picked_up': { label: 'Mascota recogida', color: 'purple', icon: '🐕' },
      'in_progress': { label: 'Paseo en Curso', color: 'emerald', icon: '🚶' },
      'completed': { label: 'Completado', color: 'gray', icon: '✅' },
      'cancelled': { label: 'Cancelado', color: 'red', icon: '❌' }
    };
    return statuses[status] || statuses.pending;
  };

  const formatMoney = (val) => '$' + (val || 0).toLocaleString('es-CO');

  const formatLocalDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 mb-6">
          <ArrowLeft size={20} /> Volver
        </button>
        <div className="bg-white p-6 rounded-2xl text-center">
          <p className="text-gray-500">Reserva no encontrada</p>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(booking.status);
  const isWalker = booking.walker_id && walker?.user_id === user?.id;
  const petNames = pets.map(p => p.name).join(', ') || 'tu(s) mascota(s)';

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white p-4 flex items-center gap-3 border-b">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-lg font-black">Detalles de Reserva</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className={`bg-white p-4 rounded-2xl border-l-4 ${
          statusInfo.color === 'orange' ? 'border-orange-500' :
          statusInfo.color === 'blue' ? 'border-blue-500' :
          statusInfo.color === 'purple' ? 'border-purple-500' :
          statusInfo.color === 'emerald' ? 'border-emerald-500' :
          statusInfo.color === 'gray' ? 'border-gray-500' :
          'border-red-500'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{statusInfo.icon}</span>
            <div>
              <p className="font-bold text-gray-900">{statusInfo.label}</p>
              <p className="text-xs text-gray-500">#{booking.id.slice(0, 8)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Fecha</p>
              <p className="font-bold">{formatLocalDate(booking.scheduled_date)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Hora</p>
              <p className="font-bold">{booking.scheduled_time}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Duración</p>
              <p className="font-bold">{booking.duration}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Total</p>
              <p className="font-bold text-emerald-600">{formatMoney(booking.total_price)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <MapPin size={18} className="text-emerald-500" /> Dirección
          </h3>
          <p className="text-sm text-gray-600">{booking.address}</p>
        </div>

        {pets.length > 0 && (
          <div className="bg-white p-4 rounded-2xl">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <PawPrint size={18} className="text-emerald-500" /> Mascota(s)
            </h3>
            <div className="flex flex-wrap gap-2">
              {pets.map(pet => (
                <span key={pet.id} className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1">
                  <Dog size={14} /> {pet.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {booking.walkers && walker && (
          <div className="bg-white p-4 rounded-2xl">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Dog size={18} className="text-emerald-500" /> Paseador
            </h3>
            <div className="flex items-center gap-3">
              <img 
                src={booking.walkers.img || 'https://via.placeholder.com/50'} 
                className="w-12 h-12 rounded-full object-cover" 
              />
              <div className="flex-1">
                <p className="font-bold">{booking.walkers.name || walker.first_name || 'Paseador'}</p>
                <p className="text-xs text-gray-500">⭐ {booking.walkers.rating || 'Nuevo'}</p>
                {walker.phone && <p className="text-xs text-gray-400">{walker.phone}</p>}
              </div>
              <div className="flex gap-2">
                {walker.phone && (
                  <>
                    <a href={`tel:${walker.phone}`} className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <Phone size={18} className="text-emerald-600" />
                    </a>
                    <a href={`https://wa.me/57${walker.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <MessageSquare size={18} className="text-green-600" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {booking.status === 'accepted' && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-blue-500" />
              <p className="font-bold text-blue-700">El paseador está en camino</p>
            </div>
            <p className="text-sm text-blue-600">Pronto irá a recoger a {petNames}</p>
          </div>
        )}

        {booking.status === 'picked_up' && (
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Dog className="w-5 h-5 text-purple-500" />
              <p className="font-bold text-purple-700">Mascota recogida</p>
            </div>
            <p className="text-sm text-purple-600">{petNames} está con el paseador. ¡El paseo está por comenzar!</p>
          </div>
        )}

        {booking.status === 'in_progress' && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Navigation className="w-5 h-5 text-emerald-500" />
                <p className="font-bold text-emerald-700">Paseo en curso</p>
              </div>
              <p className="text-sm text-emerald-600">{petNames} está disfrutando el paseo. ¡Sigue su recorrido en tiempo real!</p>
            </div>

            {isLoaded && walkerLocation && (
              <div className="bg-white p-4 rounded-2xl">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPinned size={18} className="text-emerald-500" /> Ubicación en tiempo real
                </h3>
                <div className="h-64 rounded-xl overflow-hidden">
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={walkerLocation}
                    zoom={15}
                    options={{
                      disableDefaultUI: true,
                      zoomControl: true,
                    }}
                  >
                    <Marker position={walkerLocation} />
                    {booking.lat && booking.lng && (
                      <Marker 
                        position={{ lat: booking.lat, lng: booking.lng }}
                        icon={{
                          url: 'https://maps.google.com/mapfiles/ms/icons/home.png'
                        }}
                      />
                    )}
                  </GoogleMap>
                </div>
              </div>
            )}
          </>
        )}

        {booking.status === 'completed' && (
          <div className="bg-gray-100 p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-gray-500" />
              <p className="font-bold text-gray-700">Paseo completado</p>
            </div>
            <button className="w-full mt-3 bg-gray-900 text-white py-3 rounded-xl font-bold text-sm">
              Calificar experiencia
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingDetails;
