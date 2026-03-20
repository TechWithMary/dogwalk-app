import React, { useEffect, useState } from 'react';
import { MapPin, Dog, Star, ChevronRight, Bell, Loader2, CreditCard, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient'; 
import { formatMoney } from '../utils/format';
import { isWithinRadius } from '../utils/distance';
import RatingModal from './RatingModal';
import WalkerProfileView from './WalkerProfileView'; 
import { useJsApiLoader } from '@react-google-maps/api';

const Home = ({ currentUser, navigate, setView }) => {
  
  const onNavigate = navigate || setView;

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
    language: 'es',
    region: 'CO'
  });

  const [walkers, setWalkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [upcomingWalk, setUpcomingWalk] = useState(null);
  const [petCount, setPetCount] = useState(0);
  const [displayName, setDisplayName] = useState('Amigo');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [bookingToRate, setBookingToRate] = useState(null);
  const [selectedWalker, setSelectedWalker] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuario no autenticado");

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('first_name')
          .eq('user_id', user.id)
          .maybeSingle();

        let finalName = 'Amigo';
        const fName = profile?.first_name || '';
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.first_name || '';
        const currentUserName = currentUser?.name || '';

        const isInvalid = (n) => !n || n.toLowerCase() === 'usuario' || n.toLowerCase().includes('nuevo');

        if (!isInvalid(currentUserName)) {
            finalName = currentUserName.split(' ')[0];
        } else if (!isInvalid(fName)) {
            finalName = fName.trim().split(' ')[0];
        } else if (!isInvalid(metaName)) {
            finalName = metaName.trim().split(' ')[0];
        }
        
        setDisplayName(finalName);

        const { data: locationProfile } = await supabase
          .from('user_profiles')
          .select('lat, lng')
          .eq('user_id', user.id)
          .single();

        const userLat = locationProfile?.lat;
        const userLng = locationProfile?.lng;

        let walkersRes = [];
        
        if (userLat && userLng) {
          const { data: allWalkers } = await supabase
            .from('walkers')
            .select(`*, user_profiles (*)`)
            .eq('overall_verification_status', 'approved');

          if (allWalkers) {
            walkersRes = allWalkers.filter(walker => {
              if (!walker.service_latitude || !walker.service_longitude || !walker.service_radius_km) return false;
              return isWithinRadius(
                userLat, userLng,
                walker.service_latitude, walker.service_longitude,
                walker.service_radius_km
              );
            }).slice(0, 3);
          }
        } else {
          const { data: defaultWalkers } = await supabase
            .from('walkers')
            .select(`*, user_profiles (*)`)
            .eq('overall_verification_status', 'approved')
            .limit(3);
          walkersRes = defaultWalkers || [];
        }
        
        setWalkers(walkersRes);

        const { count: notificationsCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('user_id', user.id);
        setUnreadNotifications(notificationsCount || 0);

        const { data: upcomingWalkRes } = await supabase
          .from('bookings')
          .select('*, walkers (*)')
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

        const { data: pendingReview } = await supabase
          .from('bookings')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .is('rating', null)
          .limit(1)
          .maybeSingle();

        if (pendingReview) {
          setBookingToRate(pendingReview);
          setShowRatingModal(true);
        }

      } catch (error) {
        console.error('Error cargando datos:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  if (selectedWalker) {
    return (
      <WalkerProfileView 
        walker={selectedWalker} 
        onBack={() => setSelectedWalker(null)} 
        onNavigate={onNavigate} 
      />
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-full pb-24">
      
      {showRatingModal && bookingToRate && (
        <RatingModal 
          booking={bookingToRate} 
          onClose={() => setShowRatingModal(false)} 
          onSuccess={() => {
            setShowRatingModal(false);
          }}
        />
      )}

      <div className="bg-white px-6 pt-6 pb-4 rounded-b-[30px] shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Hola, {displayName} 👋</h1>
            <p className="text-gray-400 text-xs font-medium mt-1">¿Listo para un nuevo paseo?</p>
          </div>
          <button onClick={() => onNavigate('/notifications')} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center relative hover:bg-gray-200 transition">
             <Bell className="w-5 h-5 text-gray-600" />
             {unreadNotifications > 0 && (
                <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
             )}
          </button>
        </div>
      </div>

      <div className="px-6">
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg shadow-emerald-200 flex flex-col justify-between h-32 cursor-pointer active:scale-95 transition-transform" onClick={() => onNavigate('/booking')}>
            <Dog className="w-6 h-6" />
            <span className="font-black text-base">Reservar un Paseo</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col justify-between h-32 cursor-pointer active:scale-95 transition-transform" onClick={() => onNavigate('/manage-pets')}>
            <div className="flex justify-between items-start">
              <Dog className="w-6 h-6 text-blue-500" />
              <span className="font-black text-2xl text-blue-500">{petCount}</span>
            </div>
            <span className="font-black text-base text-gray-800">Mis Mascotas</span>
          </div>
        </div>

        {upcomingWalk && (
          <div className="mb-6">
            <h3 className="font-black text-gray-900 text-lg mb-3">Tu Paseo</h3>
            <div className={`bg-white p-5 rounded-3xl shadow-sm border ${upcomingWalk.status === 'pending' ? 'border-orange-200' : upcomingWalk.status === 'accepted' || upcomingWalk.status === 'picked_up' ? 'border-blue-200' : 'border-emerald-200'}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black ${upcomingWalk.status === 'pending' ? 'bg-orange-50 text-orange-600' : upcomingWalk.status === 'accepted' || upcomingWalk.status === 'picked_up' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {(() => {
                    const dateParts = upcomingWalk.scheduled_date?.split('-');
                    const month = dateParts ? new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])).toLocaleDateString('es-CO', { month: 'short' }) : '';
                    const dayNum = dateParts ? parseInt(dateParts[2]) : '';
                    return (
                      <>
                        <span className="text-[10px] uppercase">{month}</span>
                        <span className="text-2xl">{dayNum}</span>
                      </>
                    );
                  })()}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">Paseo de {upcomingWalk.duration}</p>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{upcomingWalk.scheduled_time}</span>
                  </div>
                  {upcomingWalk.walkers && (
                    <p className="text-xs text-blue-600 font-bold mt-1">🐕 {upcomingWalk.walkers.name || 'Paseador asignado'}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="block text-xs font-black text-gray-900">{formatMoney(upcomingWalk.total_price)}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    upcomingWalk.status === 'pending' ? 'bg-orange-100 text-orange-700' : 
                    upcomingWalk.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                    upcomingWalk.status === 'picked_up' ? 'bg-purple-100 text-purple-700' :
                    upcomingWalk.status === 'in_progress' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {upcomingWalk.status === 'pending' ? 'Por Pagar' : 
                     upcomingWalk.status === 'confirmed' ? 'Pagado' :
                     upcomingWalk.status === 'accepted' ? 'En camino' :
                     upcomingWalk.status === 'picked_up' ? 'Recogida' :
                     upcomingWalk.status === 'in_progress' ? 'En curso' :
                     upcomingWalk.status}
                  </span>
                </div>
              </div>

              {(upcomingWalk.status === 'in_progress') && (
                <button 
                  onClick={() => onNavigate('/live-walk')}
                  className="w-full py-3 mb-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 bg-emerald-500 text-white shadow-lg shadow-emerald-200 animate-pulse"
                >
                  🐕 ¡Mira a tu mascota en tiempo real!
                </button>
              )}

              <button 
                onClick={() => onNavigate('/booking-details', { state: { bookingId: upcomingWalk.id } })}
                className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${upcomingWalk.status === 'pending' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-gray-100 text-gray-700'}`}
              >
                {upcomingWalk.status === 'pending' ? <><CreditCard size={14}/> Completar Pago</> : 'Ver detalles'} 
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        <h3 className="font-black text-gray-900 text-lg mb-4">Paseadores Verificados</h3>
        <div className="space-y-4">
          {loading ? (
             <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400"/></div>
          ) : (
            walkers.map((walker) => {
              const profile = walker.user_profiles;
              const fullName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') : (walker.name || 'Paseador');
              
              return (
                <div 
                  key={walker.id} 
                  onClick={() => setSelectedWalker(walker)} 
                  className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-4 cursor-pointer active:scale-[0.98] transition-all"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 shrink-0 relative">
                      {profile?.profile_photo_url ? (
                        <img src={profile.profile_photo_url} alt={fullName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-emerald-100 flex items-center justify-center">
                          <span className="text-emerald-600 font-black text-lg">
                            {fullName?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-0 bg-black/40 w-full flex items-center justify-center gap-1 py-0.5">
                          <Star className="w-2 h-2 text-yellow-400 fill-current" />
                          <span className="text-white text-[8px] font-bold">
                            {walker.rating ? Number(walker.rating).toFixed(1) : 'Nuevo'}
                          </span>
                      </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-gray-900 text-sm">{fullName}</h4>
                        <span className="text-emerald-600 font-black text-xs">{formatMoney(walker.price || 30000)}</span>
                      </div>
                      <p className="text-gray-400 text-[10px] flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {walker.location || 'Medellín'}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;