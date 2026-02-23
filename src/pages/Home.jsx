import React, { useEffect, useState } from 'react';
import { MapPin, Dog, Star, ChevronRight, Bell, Loader2, CreditCard, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient'; 
import { formatMoney } from '../utils/format';

const Home = ({ currentUser, navigate, setView }) => {
  
  const onNavigate = navigate || setView;

  const [walkers, setWalkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [upcomingWalk, setUpcomingWalk] = useState(null);
  const [petCount, setPetCount] = useState(0);
  const [displayName, setDisplayName] = useState('Amigo');

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

        const { data: walkersRes } = await supabase
          .from('walkers')
          .select(`*, user_profiles (*)`)
          .eq('overall_verification_status', 'approved')
          .limit(3);
        setWalkers(walkersRes || []);

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
          .in('status', ['pending', 'confirmed', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setUpcomingWalk(upcomingWalkRes);

        const { count: petsCount } = await supabase
          .from('pets')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', user.id);
        setPetCount(petsCount || 0);

      } catch (error) {
        console.error('Error cargando datos:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  return (
    <div className="bg-gray-50 min-h-full pb-24">
      
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
        
        <div className="mb-8">
          <h3 className="font-black text-gray-900 text-lg mb-3">Tu Próximo Paseo</h3>
          {upcomingWalk ? (
            <div className={`bg-white p-5 rounded-3xl shadow-sm border ${upcomingWalk.status === 'pending' ? 'border-orange-200' : 'border-gray-100'}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black ${upcomingWalk.status === 'pending' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <span className="text-[10px] uppercase">{new Date(upcomingWalk.scheduled_date).toLocaleDateString('es-CO', { month: 'short' })}</span>
                  <span className="text-2xl">{new Date(upcomingWalk.scheduled_date).getDate()}</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">Paseo de {upcomingWalk.duration}</p>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{upcomingWalk.scheduled_time}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-black text-gray-900">{formatMoney(upcomingWalk.total_price)}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${upcomingWalk.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {upcomingWalk.status === 'pending' ? 'Por Pagar' : 'Programado'}
                  </span>
                </div>
              </div>

              
              <button 
                onClick={() => onNavigate('/booking-details', { state: { bookingId: upcomingWalk.id } })}
                className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${upcomingWalk.status === 'pending' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-gray-50 text-gray-600 border border-gray-100'}`}
              >
                {upcomingWalk.status === 'pending' ? <><CreditCard size={14}/> Completar Pago Ahora</> : 'Ver detalles de la reserva'} 
                <ChevronRight size={14} />
              </button>
            </div>
          ) : (
            <div className="text-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-600">No tienes paseos programados.</p>
              <button onClick={() => onNavigate('/booking')} className="text-emerald-600 text-xs font-bold mt-2">¡Programar uno ahora!</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
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

        <h3 className="font-black text-gray-900 text-lg mb-4">Paseadores Verificados</h3>
        <div className="space-y-4">
          {loading ? (
             <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400"/></div>
          ) : (
            walkers.map((walker) => {
              const profile = walker.user_profiles;
              const fullName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') : (walker.name || 'Paseador');
              
              return (
                <div key={walker.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 shrink-0 relative">
                      <img src={profile?.profile_photo_url || 'https://via.placeholder.com/150'} alt={fullName} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 bg-black/40 w-full flex items-center justify-center gap-1 py-0.5">
                          <Star className="w-2 h-2 text-yellow-400 fill-current" />
                          <span className="text-white text-[8px] font-bold">{walker.rating || 'N/A'}</span>
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