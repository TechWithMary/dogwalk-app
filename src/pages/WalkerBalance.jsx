import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, ArrowDownCircle, Clock, CheckCircle, ChevronLeft, Wallet } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

const WalkerBalance = ({ onBack }) => {
  const [balance, setBalance] = useState(0);
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const MINIMUM_WITHDRAWAL = 50000;
  const NEXT_PAYOUT_DAY = 'Lunes';

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      // 1. Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // Si no hay usuario, no hacemos nada (el layout maneja la redirección)

      // 2. Obtener Balance
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle(); // 'maybeSingle' evita errores si no existe

      setBalance(profile?.balance || 0);

      // 3. Obtener Historial de Transacciones (Solo pagos recibidos)
      const { data: history } = await supabase
        .from('transactions')
        .select('*')
        .eq('transaction_type', 'payment')
        .not('net_earning', 'is', null)
        .order('created_at', { ascending: false })
        .limit(15);

      setEarnings(history || []);

    } catch (error) {
      console.error("Error silencioso billetera:", error);
    } finally {
      setLoading(false);
    }
  };

  const requestWithdrawal = async () => {
    if (balance < MINIMUM_WITHDRAWAL) {
      toast.error(`Mínimo $${MINIMUM_WITHDRAWAL.toLocaleString()} para retirar`);
      return;
    }
    setRequesting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('notifications').insert({
        user_id: user.id,
        title: '💰 Solicitud de Retiro',
        body: `Solicitud de retiro por $${balance.toLocaleString()}`,
        link_to: '/admin/payouts'
      });

      if (error) throw error;
      toast.success("Solicitud enviada. Procesaremos tu pago el lunes.");
    } catch (error) {
      toast.error("Error enviando solicitud");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gray-900 text-white px-6 pt-8 pb-16 rounded-b-[40px] shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="bg-white/10 p-2 rounded-full hover:bg-white/20"><ChevronLeft /></button>
          <h1 className="text-xl font-bold">Mis Ganancias</h1>
        </div>

        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
             <Wallet className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Saldo Disponible</p>
          <h2 className="text-5xl font-black text-emerald-400 tracking-tight">
            ${balance.toLocaleString('es-CO')}
          </h2>
        </div>

        <button 
          onClick={requestWithdrawal}
          disabled={balance < MINIMUM_WITHDRAWAL || requesting}
          className={`w-full mt-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${balance >= MINIMUM_WITHDRAWAL ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 active:scale-95' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
        >
          {requesting ? 'Procesando...' : <><ArrowDownCircle size={20}/> Solicitar Retiro</>}
        </button>
        {balance < MINIMUM_WITHDRAWAL && (
            <p className="text-center text-gray-500 text-xs mt-3">Mínimo para retirar: ${MINIMUM_WITHDRAWAL.toLocaleString()}</p>
        )}
      </div>

      <div className="px-6 mt-8">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock size={18} className="text-gray-400" /> Historial Reciente
        </h3>

        {earnings.length === 0 ? (
          <div className="text-center py-10 opacity-50 bg-white rounded-2xl border border-gray-100">
            <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-400">Aún no tienes ganancias registradas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {earnings.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-800">Paseo Finalizado</p>
                  <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-600">+${item.net_earning?.toLocaleString()}</p>
                  <p className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full inline-block mt-1 font-bold">Acreditado</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalkerBalance;