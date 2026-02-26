import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, CheckCircle, ChevronRight, DollarSign, Loader2, MapPin, Power, Star, RefreshCw, CheckSquare, Wallet, Dog, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AvailabilityManager from '../components/AvailabilityManager';
import ServiceAreaManager from '../components/ServiceAreaManager';
import toast from 'react-hot-toast';
import { formatMoney } from '../utils/format';

const SkeletonLoader = () => (
  <div className="px-6 mt-4 space-y-4 animate-pulse">
    <div className="grid grid-cols-2 gap-4"><div className="bg-gray-200 h-24 rounded-2xl"></div><div className="bg-gray-200 h-24 rounded-2xl"></div></div>
    <div className="bg-gray-200 h-20 rounded-2xl"></div>
    <div className="bg-gray-200 h-16 rounded-2xl"></div><div className="bg-gray-200 h-16 rounded-2xl"></div>
  </div>
);

const HomeWalker = ({ currentUser }) => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [data, setData] = useState({ stats: { monthlyEarnings: 0, completedWalks: 0, rating: 0 }, newRequests: [], activeWalks: [] });
  const [walkerProfile, setWalkerProfile] = useState(null);
  const [showAvailabilityManager, setShowAvailabilityManager] = useState(false);
  const [showServiceAreaManager, setShowServiceAreaManager] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [balance, setBalance] = useState(0);
  const [displayName, setDisplayName] = useState('Paseador'); 

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      let { data: walkerData } = await supabase
        .from('walkers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const isInvalidName = (name) => {
        if (!name) return true;
        const lower = name.toLowerCase();
        return lower.includes('usuario') || lower.includes('paseador');
      };

      let finalName = '';
      const profileFirst = userProfile?.first_name || '';
      const walkerName = walkerData?.name || '';
      const metaFirst = user.user_metadata?.first_name || user.user_metadata?.name || user.user_metadata?.full_name || '';

      if (!isInvalidName(walkerName)) {
          finalName = walkerName.split(' ')[0];
      } else if (!isInvalidName(profileFirst)) {
          finalName = profileFirst.split(' ')[0];
      } else if (!isInvalidName(metaFirst)) {
          finalName = metaFirst.split(' ')[0];
      } else {
          finalName = 'Paseador'; 
      }

      setDisplayName(finalName);
      setBalance(userProfile?.balance || 0);

      if (!walkerData) {
        walkerData = { id: null, verification_status: 'pending', overall_verification_status: 'pending', name: finalName };
      } else {
        walkerData.name = finalName;
      }
      
      setWalkerProfile(walkerData);

      if (walkerData.id) {
        const [requests, walks, earnings] = await Promise.all([
          supabase.rpc('get_pending_bookings_for_walker', { walker_id_param: walkerData.id }),
          supabase.from('bookings').select('*').eq('walker_id', walkerData.id).neq('status', 'completed').order('created_at', { ascending: true }),
          supabase.from('transactions').select('net_earning').eq('user_id', user.id).not('net_earning', 'is', null)
        ]);

        const monthlyEarnings = earnings.data?.reduce((sum, t) => sum + (t.net_earning || 0), 0) || 0;
        
        setData({
          stats: { monthlyEarnings, completedWalks: walkerData.reviews || 0, rating: walkerData.rating || 0 },
          newRequests: requests.data || [],
          activeWalks: walks.data || [],
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- LÓGICA DE RASTREO GPS EN TIEMPO REAL ---
  useEffect(() => {
    let watchId;
    
    // Si hay paseos activos, empezamos a rastrear
    if (data.activeWalks.length > 0 && isOnline) {
      const activeBooking = data.activeWalks[0]; // Rastreamos el primero activo
      
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            await supabase.from('locations').insert([{
              booking_id: activeBooking.id,
              walker_id: walkerProfile.id,
              latitude: latitude,
              longitude: longitude,
              timestamp: new Date().toISOString()
            }]);
          },
          (err) => console.error("Error GPS:", err),
          { enableHighAccuracy: true, distanceFilter: 15 }
        );
      }
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [data.activeWalks, isOnline, walkerProfile?.id]);

  const acceptBooking = async (bookingId) => {
    setProcessingId(bookingId);
    try {
      const { data: success, error } = await supabase.rpc('accept_booking', { booking_id_param: bookingId, walker_id_param: walkerProfile.id });
      if (error) throw error;
      if (success) {
        toast.success("¡Paseo Aceptado! 🚀");
        fetchData();
      } else {
        toast.error("Otro paseador ha aceptado este paseo.");
        fetchData();
      }
    } catch (error) {
      toast.error("No se pudo aceptar: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const finishWalk = async (bookingId) => {
    if(!window.confirm("¿Confirmar que finalizaste el paseo?")) return;
    setProcessingId(bookingId);
    try {
      const { error: updateError } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId);
      if (updateError) throw updateError;
      toast.success("¡Paseo finalizado! Procesando tu ganancia...");
      const { error: processError } = await supabase.functions.invoke('process-booking-completion', { body: { bookingId } });
      if (processError) throw processError;
      toast.success("¡Ganancia registrada!");
      fetchData();
    } catch (error) {
      toast.error("Error al finalizar: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const renderVerificationStatus = () => {
    if (!walkerProfile || walkerProfile.overall_verification_status === 'approved') return null;

    if (walkerProfile.overall_verification_status === 'rejected') {
      return (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl mb-6 shadow-sm">
          <div className="flex gap-3">
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm text-red-900 mb-1">Solicitud Rechazada</h3>
              <p className="text-xs text-red-700 mb-2">Tus documentos no fueron aprobados. Por favor, súbelos nuevamente.</p>
              <button onClick={() => navigate('/onboarding-walker')} className="w-full text-xs bg-red-500 text-white px-3 py-2 rounded-lg font-bold hover:bg-red-600 flex justify-center items-center gap-1 active:scale-95 transition-all">
                Corregir Documentos <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (walkerProfile.overall_verification_status === 'pending') {
      return (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl mb-6 shadow-sm">
          <div className="flex gap-3">
            <Clock className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm text-orange-900 mb-1">Verificación en Proceso</h3>
              <p className="text-xs text-orange-700">Estamos revisando tus documentos. Te notificaremos cuando tu perfil esté activo.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-6 shadow-sm">
        <div className="flex gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-sm text-amber-900 mb-1">Faltan Documentos</h3>
            <p className="text-xs text-amber-700 mb-2">Sube tu documento de identidad y foto para activar tu cuenta y empezar a recibir paseos.</p>
            <button onClick={() => navigate('/onboarding-walker')} className="w-full text-xs bg-amber-500 text-white px-3 py-2 rounded-lg font-bold hover:bg-amber-600 flex justify-center items-center gap-1 active:scale-95 transition-all">
              Subir Documentos <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-100 min-h-full pb-24">
      <div className="bg-gray-900 px-6 pt-8 pb-16 rounded-b-[30px] shadow-lg">
        <div className="flex justify-between items-center text-white">
            <div>
             <h1 className="text-xl font-black">
              Hola, {displayName}
            </h1>
             <p className={`text-xs font-bold flex items-center gap-1 mt-1 ${walkerProfile?.overall_verification_status === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
               {walkerProfile?.overall_verification_status === 'approved' ? <><CheckCircle className="w-3 h-3"/> Verificado</> : <><AlertTriangle className="w-3 h-3"/> No Verificado</>}
             </p>
           </div>
          <button onClick={() => setIsOnline(!isOnline)} className={`p-2 rounded-full text-xs shadow-lg transition-colors ${isOnline ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'}`}><Power className="w-5 h-5" /></button>
        </div>
      </div>
      
      <div className="px-6 -mt-10">
        {loading ? <SkeletonLoader/> : (
          <>
            {renderVerificationStatus()}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100"><DollarSign className="w-6 h-6 text-emerald-500 mb-2"/><p className="text-xs font-bold text-gray-400 uppercase">Ganancias</p><p className="text-xl font-black text-gray-900">{formatMoney(data.stats.monthlyEarnings)}</p></div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100"><Star className="w-6 h-6 text-yellow-500 mb-2"/><p className="text-xs font-bold text-gray-400 uppercase">Calificación</p><p className="text-xl font-black text-gray-900">{data.stats.rating.toFixed(1)}</p></div>
            </div>

            <button onClick={() => navigate('/walker-balance')} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 p-5 rounded-2xl shadow-lg shadow-emerald-200 mb-6 text-white flex items-center justify-between active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <Wallet className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Balance Disponible</p>
                  <p className="text-2xl font-black">{formatMoney(balance)}</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 opacity-70" />
            </button>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <button onClick={() => setShowAvailabilityManager(true)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-left active:scale-95 transition-transform"><Calendar className="w-6 h-6 text-indigo-500 mb-2"/><p className="font-bold text-sm text-gray-800">Mi Horario</p></button>
              <button onClick={() => setShowServiceAreaManager(true)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-left active:scale-95 transition-transform"><MapPin className="w-6 h-6 text-rose-500 mb-2"/><p className="font-bold text-sm text-gray-800">Mi Zona</p></button>
            </div>

            <div className="flex gap-2 mb-4 p-1 bg-gray-200 rounded-xl">
              <button onClick={() => setActiveTab('pending')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'pending' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Nuevos ({data.newRequests.length})</button>
              <button onClick={() => setActiveTab('active')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'active' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Mis Paseos ({data.activeWalks.length})</button>
            </div>

            {activeTab === 'pending' && (
              data.newRequests.length > 0 ? data.newRequests.map(b => (
                <div key={b.id} className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 mb-3 animate-fade-in-down">
                  <div className="flex justify-between items-start mb-2"><h4 className="font-bold text-gray-900 flex items-center gap-2"><Dog className="w-4 h-4 text-emerald-500"/> Nuevo Paseo</h4><span className="font-black text-emerald-600">{formatMoney(b.total_price)}</span></div>
                  <p className="text-xs text-gray-500 mb-4 flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0"/> <span className="line-clamp-2">{b.address}</span></p>
                  <button onClick={() => acceptBooking(b.id)} disabled={processingId === b.id} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm flex justify-center active:scale-[0.98] transition-all disabled:opacity-70">{processingId === b.id ? <Loader2 className="animate-spin"/> : 'Aceptar Trabajo'}</button>
                </div>
              )) : <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300"><RefreshCw className="mx-auto mb-3 text-gray-300 w-8 h-8"/><p className="text-sm font-bold text-gray-500">No hay nuevas solicitudes</p><p className="text-xs text-gray-400 mt-1">Te avisaremos cuando haya paseos cerca.</p></div>
            )}
            
            {activeTab === 'active' && (
              data.activeWalks.length > 0 ? data.activeWalks.map(b => (
                <div key={b.id} className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-blue-500 mb-3 animate-fade-in-down">
                  <div className="flex justify-between items-start mb-2"><h4 className="font-bold text-gray-900">Paseo de {b.duration}</h4><span className="font-black text-blue-600">{formatMoney(b.total_price)}</span></div>
                  <p className="text-xs text-gray-500 mb-4 flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0"/> <span className="line-clamp-2">{b.address}</span></p>
                  <button onClick={() => finishWalk(b.id)} disabled={processingId === b.id} className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70">{processingId === b.id ? <Loader2 className="animate-spin"/> : <><CheckSquare size={16}/> Finalizar Paseo</>}</button>
                </div>
              )) : <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300"><Dog className="mx-auto mb-3 text-gray-300 w-8 h-8"/><p className="text-sm font-bold text-gray-500">No tienes paseos activos</p><p className="text-xs text-gray-400 mt-1">Acepta solicitudes para empezar a ganar.</p></div>
            )}
          </>
        )}
      </div>

      {showAvailabilityManager && walkerProfile && <AvailabilityManager walkerId={walkerProfile.id} onClose={() => setShowAvailabilityManager(false)} />}
      {showServiceAreaManager && walkerProfile && <ServiceAreaManager walkerId={walkerProfile.id} onClose={() => setShowServiceAreaManager(false)} />}
    </div>
  );
};

export default HomeWalker;