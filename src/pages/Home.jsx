import React, { useEffect, useState } from 'react';
import { MapPin, Dog, Star, ChevronRight, Bell, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient'; 
import { formatMoney } from '../utils/format';

const Home = ({ currentUser, navigate }) => {
  const [walkers, setWalkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [upcomingWalk, setUpcomingWalk] = useState(null);
  const [petCount, setPetCount] = useState(0);
  const [displayName, setDisplayName] = useState('Amigo'); // Agregamos estado para el nombre

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuario no autenticado para fetching");

        // --- LÓGICA CAZA-NOMBRES ---
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
        // -----------------------------

        // 1. Obtener Paseadores Destacados
        const { data: walkersRes } = await supabase
          .from('walkers')
          .select(`*, user_profiles (*)`)
          .eq('is_verified', true)
          .order('criminal_record_cert', { ascending: false, nulls: 'last' })
          .limit(3);
        setWalkers(walkersRes || []);

        // 2. Obtener Notificaciones
        const { count: notificationsCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('user_id', user.id);
        setUnreadNotifications(notificationsCount || 0);

        // 3. Obtener Próximo Paseo
        const { data: upcomingWalkRes } = await supabase
          .from('bookings')
          .select('*, walkers (*)')
          .eq('user_id', user.id)
          .in('status', ['confirmed', 'in_progress'])
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time', { ascending: true })
          .limit(1)
          .maybeSingle();
        setUpcomingWalk(upcomingWalkRes);

        // 4. Obtener Número Real de Mascotas
        const { count: petsCount } = await supabase
          .from('pets')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', user.id);
        setPetCount(petsCount || 0);

      } catch (error) {
        console.error('Error cargando los datos de la página principal:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  return (
    <div className="bg-gray-50 min-h-full pb-24">
      
      {/* Encabezado con saludo y notificaciones */}
      <div className="bg-white px-6 pt-6 pb-4 rounded-b-[30px] shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            {/* Aquí usamos nuestro displayName en lugar de currentUser?.name */}
            <h1 className="text-2xl font-black text-gray-900">Hola, {displayName} 👋</h1>
            <p className="text-gray-400 text-xs font-medium mt-1">¿Listo para un nuevo paseo?</p>
          </div>
          <button onClick={() => navigate('/notifications')} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center relative hover:bg-gray-200 transition">
             <Bell className="w-5 h-5 text-gray-600" />
             {unreadNotifications > 0 && (
                <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
             )}
          </button>
        </div>
      </div>

      <div className="px-6">
        
        {/* Tarjeta del Próximo Paseo */}
        <div className="mb-8">
          <h3 className="font-black text-gray-900 text-lg mb-3">Tu Próximo Paseo</h3>
          {upcomingWalk ? (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gray-100 flex flex-col items-center justify-center font-black text-emerald-600">
                <span className="text-xs uppercase">{new Date(upcomingWalk.scheduled_date).toLocaleDateString('es-CO', { month: 'short' })}</span>
                <span className="text-3xl">{new Date(upcomingWalk.scheduled_date).getDate()}</span>
              </div>
              <div>
                <p className="font-bold text-gray-800">Paseo con {upcomingWalk.walkers?.name || 'Paseador'}</p>
                <p className="text-xs text-gray-500">{upcomingWalk.scheduled_time} - {upcomingWalk.duration} min</p>
              </div>
              <ChevronRight className="ml-auto text-gray-400" />
            </div>
          ) : (
            <div className="text-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-600">No tienes paseos programados.</p>
              <p className="text-xs text-gray-400 mt-1">¡Es un día perfecto para una aventura!</p>
            </div>
          )}
        </div>

        {/* Accesos Rápidos (Reservar y Mascotas) */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg shadow-emerald-200 flex flex-col justify-between h-32 cursor-pointer active:scale-95 transition-transform" onClick={() => navigate('/booking')}>
            <Dog className="w-6 h-6" />
            <span className="font-black text-base">Reservar un Paseo</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col justify-between h-32 cursor-pointer active:scale-95 transition-transform" onClick={() => navigate('/manage-pets')}>
            <div className="flex justify-between items-start">
              <Dog className="w-6 h-6 text-blue-500" />
              <span className="font-black text-2xl text-blue-500">{petCount}</span>
            </div>
            <span className="font-black text-base text-gray-800">Mis Mascotas</span>
          </div>
        </div>

        {/* Lista de Paseadores Verificados */}
        <div className="flex justify-between items-end mb-4">
          <h3 className="font-black text-gray-900 text-lg">Paseadores Verificados</h3>
        </div>

        <div className="space-y-4">
          {loading ? (
             <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400"/></div>
          ) : (
            walkers.length > 0 ? walkers.map((walker) => {
              const profile = walker.user_profiles;
              const fullName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') : (walker.name || 'Paseador');
              
              return (
                <div key={walker.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-4 hover:shadow-md transition-all cursor-pointer">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-200 shrink-0 relative">
                      <img src={profile?.profile_photo_url || walker.img || 'https://via.placeholder.com/150'} alt={fullName} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1 pt-4">
                      <div className="flex items-center justify-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          <span className="text-white text-[10px] font-bold">{walker.rating || 'Nuevo'}</span>
                      </div>
                      </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center py-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-gray-900 text-base">{fullName}</h4>
                        <span className="text-emerald-600 font-black text-sm">{formatMoney(walker.price || 30000)}</span>
                      </div>
                      <p className="text-gray-400 text-xs mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> {walker.location || 'Ubicación no definida'}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-sm font-bold text-gray-600">No hay paseadores verificados aún.</p>
                <p className="text-xs text-gray-400 mt-1">Vuelve a revisar pronto.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;