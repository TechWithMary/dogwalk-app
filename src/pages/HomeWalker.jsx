import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, CheckCircle, ChevronRight, DollarSign, Loader2, MapPin, Power, Star, RefreshCw, CheckSquare, Wallet, Dog, AlertTriangle, XCircle, Clock, TrendingUp, Award, Navigation } from 'lucide-react';
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
  const [balance, setBalance] = useState(0);
  const [data, setData] = useState({ 
    stats: { monthlyEarnings: 0, completedWalks: 0, rating: 5.0 }, 
    newRequests: [], 
    activeWalks: [] 
  });
  const [acceptingId, setAcceptingId] = useState(null);
  const [processingWalkId, setProcessingWalkId] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [currentWalkId, setCurrentWalkId] = useState(null);
  const locationIntervalRef = useRef(null);
  const walkerIdRef = useRef(null);

  const acceptBooking = async (bookingId) => {
    try {
      setAcceptingId(bookingId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: walkerData } = await supabase
        .from('walkers')
        .select('id, name')
        .eq('user_id', user.id)
        .single();

      if (!walkerData) {
        toast.error('Perfil de paseador no encontrado');
        return;
      }

      const { error } = await supabase
        .from('bookings')
        .update({ status: 'accepted', walker_id: walkerData.id })
        .eq('id', bookingId)
        .in('status', ['pending', 'confirmed']);

      if (error) throw error;

      const { data: booking } = await supabase
        .from('bookings')
        .select('user_id')
        .eq('id', bookingId)
        .single();

      if (booking?.user_id) {
        await supabase.from('notifications').insert({
          user_id: booking.user_id,
          title: '🐕 Paseador Acceptado',
          body: `${walkerData.name || 'El paseador'} ha aceptado tu reserva. Pronto irá a buscar tu mascota.`,
          link_to: '/home'
        });
      }
      
      toast.success('¡Paseo aceptado!');
      fetchWalkerData();
    } catch (error) {
      console.error(error);
      toast.error('Error al aceptar paseo');
    } finally {
      setAcceptingId(null);
    }
  };

  const startWalk = async (walkId) => {
    setProcessingWalkId(walkId);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'in_progress', walk_start_time: new Date().toISOString() })
        .eq('id', walkId)
        .eq('status', 'picked_up');

      if (error) throw error;

      const { data: booking } = await supabase
        .from('bookings')
        .select('user_id, walkers(name)')
        .eq('id', walkId)
        .single();

      if (booking?.user_id) {
        await supabase.from('notifications').insert({
          user_id: booking.user_id,
          title: '🐕 Paseo en Curso',
          body: `${booking.walkers?.name || 'El paseador'} ha iniciado el paseo con tu mascota. ¡Puedes seguir su ubicación en tiempo real!`,
          link_to: '/home'
        });
      }
      
      startGPSTracking(walkId);
      toast.success('¡Paseo iniciado! GPS activo.');
      fetchWalkerData();
    } catch (error) {
      console.error(error);
      toast.error('Error al iniciar paseo');
    } finally {
      setProcessingWalkId(null);
    }
  };

  const sendLocation = async (bookingId) => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await supabase.from('locations').insert({
            booking_id: bookingId,
            walker_id: walkerIdRef.current,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
            activity_type: 'walking',
            location_source: 'gps'
          });
        } catch (err) {
          console.error('Error enviando ubicación:', err);
        }
      },
      (err) => console.error('Error GPS:', err),
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  const startGPSTracking = async (walkId) => {
    if (locationIntervalRef.current) return;
    
    if (!walkerIdRef.current) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: walkerData } = await supabase
          .from('walkers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        if (walkerData) {
          walkerIdRef.current = walkerData.id;
        }
      }
    }
    
    setCurrentWalkId(walkId);
    setIsTracking(true);
    
    sendLocation(walkId);
    
    locationIntervalRef.current = setInterval(() => {
      sendLocation(walkId);
    }, 10000);
  };

  const stopGPSTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    setIsTracking(false);
    setCurrentWalkId(null);
  };

  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  const finishWalk = async (walkId) => {
    if (!confirm('¿Confirmas que has terminado el paseo?')) return;
    
    setProcessingWalkId(walkId);
    try {
      const { data: booking } = await supabase
        .from('bookings')
        .select('user_id, total_price, walkers(id, user_id)')
        .eq('id', walkId)
        .single();

      const { error } = await supabase
        .from('bookings')
        .update({ status: 'completed', walk_end_time: new Date().toISOString() })
        .eq('id', walkId)
        .eq('status', 'in_progress');

      if (error) throw error;

      if (booking?.walkers?.user_id) {
        const price = parseFloat(booking.total_price || 0);
        const commission = price * 0.20;
        const netEarning = price - commission;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('balance')
          .eq('user_id', booking.walkers.user_id)
          .single();

        const newBalance = (profile?.balance || 0) + netEarning;
        await supabase
          .from('user_profiles')
          .update({ balance: newBalance })
          .eq('user_id', booking.walkers.user_id);

        await supabase.from('transactions').insert({
          user_id: booking.walkers.user_id,
          booking_id: walkId,
          transaction_type: 'payment',
          amount: price,
          net_earning: netEarning,
          platform_fee: commission,
          payment_method: 'wallet',
          status: 'completed',
          description: `Paseo completado - ${booking.duration}`
        });
      }

      if (booking?.user_id) {
        await supabase.from('notifications').insert({
          user_id: booking.user_id,
          title: '✅ Paseo Completado',
          body: 'El paseo ha terminado. Tu mascota está de vuelta contigo.',
          link_to: '/home'
        });
      }
      
      toast.success('¡Paseo completado! Gracias por tu trabajo.');
      stopGPSTracking();
      fetchWalkerData();
    } catch (error) {
      console.error(error);
      toast.error('Error al finalizar paseo');
    } finally {
      setProcessingWalkId(null);
    }
  };

  const confirmPickup = async (walkId) => {
    setProcessingWalkId(walkId);
    try {
      const { data: walkerData } = await supabase
        .from('walkers')
        .select('name')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data: booking } = await supabase
        .from('bookings')
        .select('user_id, pets(name)')
        .eq('id', walkId)
        .single();

      const petName = booking?.pets?.[0]?.name || 'tu mascota';

      const { error } = await supabase
        .from('bookings')
        .update({ status: 'picked_up' })
        .eq('id', walkId)
        .eq('status', 'accepted');

      if (error) throw error;

      if (booking?.user_id) {
        await supabase.from('notifications').insert({
          user_id: booking.user_id,
          title: '🐕 Mascota Recogida',
          body: `${walkerData?.name || 'El paseador'} ha recogido a ${petName}. ¡El paseo está por comenzar!`,
          link_to: '/home'
        });
      }
      
      toast.success('¡Mascota recogida! Ahora puedes iniciar el paseo.');
      fetchWalkerData();
    } catch (error) {
      console.error(error);
      toast.error('Error al confirmar recogida');
    } finally {
      setProcessingWalkId(null);
    }
  };

  const fetchWalkerData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: walkerData, error: walkerError } = await supabase
        .from('walkers')
        .select('id, overall_verification_status')
        .eq('user_id', user.id);

      if (walkerError) {
        console.error('Error fetching walker:', walkerError);
      }

      const walkerId = walkerData?.[0]?.id;

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      const walkerBalance = profileData?.balance || 0;
      setBalance(walkerBalance);

      if (!walkerId) {
        setData({ stats: { monthlyEarnings: 0, completedWalks: 0, rating: 5.0 }, newRequests: [], activeWalks: [] });
        setLoading(false);
        return;
      }

      const { data: myBookings } = await supabase
        .from('bookings')
        .select('*, pets(*)')
        .eq('walker_id', walkerId)
        .in('status', ['accepted', 'picked_up', 'in_progress']);

      const { data: availableBookings } = await supabase
        .from('bookings')
        .select('*')
        .is('walker_id', null)
        .in('status', ['pending', 'confirmed']);

      const bookings = [...(myBookings || []), ...(availableBookings || [])];

      console.log('Walker ID:', walkerId);
      console.log('My bookings:', myBookings);
      console.log('Available bookings:', availableBookings);
      console.log('Combined:', bookings);

      const { data: statsData } = await supabase
        .from('bookings')
        .select('total_price')
        .eq('walker_id', walkerId)
        .eq('status', 'completed');

      const totalEarned = statsData?.reduce((acc, curr) => acc + curr.total_price, 0) || 0;

      setData({
        stats: {
          monthlyEarnings: totalEarned,
          completedWalks: statsData?.length || 0,
          rating: 5.0
        },
        newRequests: bookings?.filter(b => b.status === 'pending' || b.status === 'confirmed') || [],
        activeWalks: bookings?.filter(b => b.status === 'accepted' || b.status === 'picked_up' || b.status === 'in_progress') || []
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalkerData();
  }, [fetchWalkerData]);

  
  const getCleanName = () => {
    const name = currentUser?.name || 'Paseador';
    return name.replace(/\b(nuevo|usuario|walker)\b/gi, '').trim() || 'Paseador';
  };

  if (loading) return <SkeletonLoader />;

  return (
    <div className="bg-gray-50 min-h-screen pb-20 font-sans">
      <div className="bg-gray-900 pt-12 pb-20 px-6 rounded-b-[40px] shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#13ec13] flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Dog className="text-black w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Panel Control</p>
              <h1 className="text-white text-xl font-black">Hola, {getCleanName()}!</h1>
            </div>
          </div>
          <button onClick={() => setIsOnline(!isOnline)} className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-xs transition-all ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            <Power size={14} /> {isOnline ? 'ONLINE' : 'OFFLINE'}
          </button>
        </div>
      </div>

      <div className="px-6 -mt-10 space-y-4">
        
        <div onClick={() => navigate('/walker-balance')} className="bg-white p-6 rounded-[32px] shadow-xl border border-gray-100 flex justify-between items-center active:scale-95 transition-all">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo para retirar</span>
            </div>
            <p className="text-3xl font-black text-gray-900">{formatMoney(balance)}</p>
          </div>
          <ChevronRight className="text-gray-300" />
        </div>

        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-[30px] border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase">Completados</p>
            <p className="text-xl font-black text-gray-900">{data.stats.completedWalks}</p>
          </div>
          <div className="bg-white p-5 rounded-[30px] border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center mb-3">
              <Award className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase">Calificación</p>
            <p className="text-xl font-black text-gray-900">{data.stats.rating.toFixed(1)}</p>
          </div>
        </div>

        
        <div className="flex p-1.5 bg-gray-200 rounded-2xl">
          <button onClick={() => setActiveTab('pending')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${activeTab === 'pending' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}>
            SOLICITUDES ({data.newRequests.length})
          </button>
          <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${activeTab === 'active' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'}`}>
            EN CURSO ({data.activeWalks.length})
          </button>
        </div>

        <div className="pb-10">
          {activeTab === 'pending' ? (
            data.newRequests.length > 0 ? data.newRequests.map(req => (
              <div key={req.id} className="bg-white p-5 rounded-[30px] mb-4 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400"><Dog /></div>
                    <div>
                      <h4 className="font-black text-gray-900">Paseo {req.duration}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><MapPin size={10}/> {req.address.split(',')[0]}</p>
                    </div>
                  </div>
                  <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black">{formatMoney(req.total_price)}</span>
                </div>
                <button 
                    onClick={() => acceptBooking(req.id)}
                    disabled={acceptingId === req.id}
                    className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                  >
                    {acceptingId === req.id ? 'Aceptando...' : 'Aceptar Solicitud'}
                  </button>
              </div>
            )) : (
              <div className="text-center py-16 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
                <RefreshCw className="w-10 h-10 text-gray-200 mx-auto mb-4 animate-spin-slow" />
                <p className="text-gray-400 font-bold text-sm">Buscando paseos cerca...</p>
              </div>
            )
          ) : (
            data.activeWalks.length > 0 ? data.activeWalks.map(walk => (
              <div key={walk.id} className="bg-white p-5 rounded-[30px] mb-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400"><Dog /></div>
                    <div>
                      <h4 className="font-black text-gray-900">Paseo {walk.duration}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><MapPin size={10}/> {walk.address?.split(',')[0] || 'Dirección no disponible'}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mt-1 inline-block ${
                        walk.status === 'accepted' ? 'bg-blue-100 text-blue-600' : 
                        walk.status === 'picked_up' ? 'bg-purple-100 text-purple-600' : 
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {walk.status === 'accepted' ? 'En camino' : 
                         walk.status === 'picked_up' ? 'Mascota recogida' : 'En curso'}
                      </span>
                    </div>
                  </div>
                  <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black">{formatMoney(walk.total_price)}</span>
                </div>

                {walk.status === 'accepted' && (
                  <button 
                    onClick={() => confirmPickup(walk.id)}
                    disabled={processingWalkId === walk.id}
                    className="w-full bg-purple-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processingWalkId === walk.id ? <Loader2 className="animate-spin w-4 h-4" /> : <><Dog size={16} /> Ya recogí la mascota</>}
                  </button>
                )}

                {walk.status === 'picked_up' && (
                  <button 
                    onClick={() => startWalk(walk.id)}
                    disabled={processingWalkId === walk.id}
                    className="w-full bg-blue-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processingWalkId === walk.id ? <Loader2 className="animate-spin w-4 h-4" /> : <><MapPin size={16} /> Iniciar Paseo GPS</>}
                  </button>
                )}

                {walk.status === 'in_progress' && (
                  <>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 flex items-center justify-center gap-2">
                      <Navigation className="w-4 h-4 text-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-700">GPS activo - El dueño puede ver tu ubicación</span>
                    </div>
                    <button 
                      onClick={() => finishWalk(walk.id)}
                      disabled={processingWalkId === walk.id}
                      className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {processingWalkId === walk.id ? <Loader2 className="animate-spin w-4 h-4" /> : <><CheckCircle size={16} /> Finalizar Paseo</>}
                    </button>
                  </>
                )}
              </div>
            )) : (
              <div className="text-center py-16">
                <p className="text-gray-400 font-bold text-sm">No tienes paseos activos</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeWalker;