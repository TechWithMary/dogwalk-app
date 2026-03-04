import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, CheckCircle, ChevronRight, DollarSign, Loader2, MapPin, Power, Star, RefreshCw, CheckSquare, Wallet, Dog, AlertTriangle, XCircle, Clock, TrendingUp, Award } from 'lucide-react';
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

  const acceptBooking = async (bookingId) => {
    try {
      setAcceptingId(bookingId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: walkerData } = await supabase
        .from('walkers')
        .select('id')
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
        .eq('status', 'pending');

      if (error) throw error;
      
      toast.success('¡Paseo aceptado!');
      fetchWalkerData();
    } catch (error) {
      console.error(error);
      toast.error('Error al aceptar paseo');
    } finally {
      setAcceptingId(null);
    }
  };

  const fetchWalkerData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: walkerData } = await supabase
        .from('walkers')
        .select('id, balance, overall_verification_status')
        .eq('user_id', user.id)
        .single();

      const walkerId = walkerData?.id;
      const walkerBalance = walkerData?.balance || 0;

      setBalance(walkerBalance);

      if (!walkerId) {
        setData({ stats: { monthlyEarnings: 0, completedWalks: 0, rating: 5.0 }, newRequests: [], activeWalks: [] });
        setLoading(false);
        return;
      }

      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('walker_id', walkerId)
        .in('status', ['pending', 'accepted', 'in_progress'])
        .order('created_at', { ascending: false });

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
        newRequests: bookings?.filter(b => b.status === 'pending') || [],
        activeWalks: bookings?.filter(b => b.status === 'accepted' || b.status === 'in_progress') || []
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
              <div key={walk.id} className="bg-white p-5 rounded-[30px] mb-4 shadow-sm border-l-4 border-emerald-500">
                 
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