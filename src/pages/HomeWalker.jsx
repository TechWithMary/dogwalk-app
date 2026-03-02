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
          supabase.from('bookings')
            .select('*')
            .eq('walker_id', walkerData.id)
            .in('status', ['accepted', 'confirmed', 'in_progress'])
            .order('created_at', { ascending: true }),
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

  useEffect(() => {
    let watchId;
    if (data.activeWalks.length > 0 && isOnline) {
      const activeBooking = data.activeWalks[0];
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
          (err) => console.error(err),
          { enableHighAccuracy: true, distanceFilter: 15 }
        );
      }
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
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

  const rejectAsignment = async (bookingId) => {
    if(!window.confirm("¿No puedes realizar este paseo? Se liberará para la comunidad.")) return;
    setProcessingId(bookingId);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'pending', walker_id: null })
        .eq('id', bookingId);
      if (error) throw error;
      toast.success("Paseo liberado");
      fetchData();
    } catch (error) {
      toast.error("Error: " + error.message);
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
      const { error: processError } = await supabase.functions.invoke('process-booking-completion', { body: { bookingId } });
      if (processError) throw processError;
      toast.success("¡Finalizado!");
      fetchData();
    } catch (error) {
      toast.error("Error: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const renderVerificationStatus = () => {
    if (!walkerProfile || walkerProfile.overall_verification_status === 'approved') return null;
    return (
      <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl mb-6">
        <p className="text-xs text-orange-700">Perfil en verificación</p>
      </div>
    );
  };

  return (
    <div className="bg-gray-100 min-h-full pb-24">
      <div className="bg-gray-900 px-6 pt-8 pb-16 rounded-b-[30px]">
        <div className="flex justify-between items-center text-white">
          <h1 className="text-xl font-black">Hola, {displayName}</h1>
          <button onClick={() => setIsOnline(!isOnline)} className={`p-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-700'}`}><Power size={20} /></button>
        </div>
      </div>
      
      <div className="px-6 -mt-10">
        {loading ? <SkeletonLoader/> : (
          <>
            {renderVerificationStatus()}

            <button onClick={() => navigate('/walker-balance')} className="w-full bg-emerald-600 p-5 rounded-2xl mb-6 text-white flex justify-between items-center shadow-lg">
              <div><p className="text-xs opacity-80">Balance</p><p className="text-2xl font-black">{formatMoney(balance)}</p></div>
              <ChevronRight />
            </button>

            <div className="flex gap-2 mb-4 p-1 bg-gray-200 rounded-xl">
              <button onClick={() => setActiveTab('pending')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'pending' ? 'bg-white text-emerald-700' : 'text-gray-500'}`}>Nuevos</button>
              <button onClick={() => setActiveTab('active')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${activeTab === 'active' ? 'bg-white text-blue-700' : 'text-gray-500'}`}>Mis Paseos</button>
            </div>

            {activeTab === 'pending' && (
              data.newRequests.length > 0 ? data.newRequests.map(b => (
                <div key={b.id} className="bg-white p-4 rounded-2xl mb-3 shadow-sm border border-emerald-100">
                  <div className="flex justify-between mb-2"><h4 className="font-bold">Nuevo Paseo</h4><span className="font-black">{formatMoney(b.total_price)}</span></div>
                  <button onClick={() => acceptBooking(b.id)} className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm">Aceptar</button>
                </div>
              )) : <div className="text-center py-10 opacity-50">No hay solicitudes</div>
            )}
            
            {activeTab === 'active' && (
              data.activeWalks.length > 0 ? data.activeWalks.map(b => (
                <div key={b.id} className="bg-white p-4 rounded-2xl mb-3 shadow-sm border-l-4 border-l-blue-500">
                  <div className="flex justify-between mb-2"><h4 className="font-bold">Paseo de {b.duration}</h4><span className="font-black">{formatMoney(b.total_price)}</span></div>
                  <p className="text-xs text-gray-500 mb-4 truncate">{b.address}</p>
                  
                  <div className="flex gap-2">
                    {b.status === 'accepted' && (
                      <button onClick={() => rejectAsignment(b.id)} className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1">
                        <XCircle size={16}/> Rechazar
                      </button>
                    )}
                    <button onClick={() => finishWalk(b.id)} className="flex-[2] bg-gray-900 text-white py-3 rounded-xl font-bold text-sm">Finalizar Paseo</button>
                  </div>
                </div>
              )) : <div className="text-center py-10 opacity-50">No tienes paseos activos</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HomeWalker;