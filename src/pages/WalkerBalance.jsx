import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, ArrowDownCircle, Clock, CheckCircle, ChevronLeft, Wallet, ArrowUpCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

const WalkerBalance = ({ onBack }) => {
  const [balance, setBalance] = useState(0);
  const [earnings, setEarnings] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const MINIMUM_WITHDRAWAL = 50000;

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      setBalance(profile?.balance || 0);

      // Historial de ganancias (transactions)
      const { data: history } = await supabase
        .from('transactions')
        .select('*')
        .eq('transaction_type', 'payment')
        .not('net_earning', 'is', null)
        .order('created_at', { ascending: false })
        .limit(15);

      setEarnings(history || []);

      // Historial de retiros (payouts)
      const { data: walkerData } = await supabase
        .from('walkers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walkerData) {
        const { data: payoutsData } = await supabase
          .from('payouts')
          .select('*')
          .eq('walker_id', walkerData.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setPayouts(payoutsData || []);
      }

    } catch (error) {
      console.error("Error silencioso billetera:", error);
    } finally {
      setLoading(false);
    }
  };

  const requestWithdrawal = async () => {
    const amount = parseInt(withdrawAmount.replace(/\D/g, ''));
    
    if (!amount || amount < MINIMUM_WITHDRAWAL) {
      toast.error(`Mínimo $${MINIMUM_WITHDRAWAL.toLocaleString()} para retirar`);
      return;
    }

    if (amount > balance) {
      toast.error('No tienes suficiente saldo');
      return;
    }

    setRequesting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario');

      const { data: walkerData } = await supabase
        .from('walkers')
        .select('id, user_id')
        .eq('user_id', user.id)
        .single();

      if (!walkerData) {
        toast.error('Perfil de paseador no encontrado');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('bank_account_type, bank_account_number, bank_name')
        .eq('user_id', user.id)
        .single();

      if (!profile?.bank_account_number) {
        toast.error('Primero completa tus datos bancarios en tu perfil');
        return;
      }

      const payoutData = {
        walker_id: walkerData.id,
        amount: amount,
        status: 'pending',
        payout_date: new Date().toISOString().split('T')[0],
        notes: `Tipo: ${profile?.bank_account_type || 'Nequi'}, Cuenta: ${profile?.bank_account_number || 'No registrada'}`
      };

      const { error: payoutError } = await supabase
        .from('payouts')
        .insert(payoutData);

      if (payoutError) {
        console.error('Error creando payout:', payoutError);
        throw payoutError;
      }

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: user.id,
        title: '💰 Solicitud de Retiro Enviada',
        body: `Tu solicitud de retiro por $${amount.toLocaleString()} ha sido recibida.`,
        link_to: '/walker-balance'
      });

      toast.success("Solicitud enviada. Te notificaremos cuando procesemos el pago.");
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      fetchWalletData();
    } catch (error) {
      console.error(error);
      toast.error("Error al solicitar retiro");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-900"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500"></div></div>;

  const formatMoney = (amount) => '$' + (amount || 0).toLocaleString('es-CO');

  const getPayoutStatusBadge = (status) => {
    const styles = {
      pending: 'bg-orange-100 text-orange-600',
      completed: 'bg-emerald-100 text-emerald-600',
      rejected: 'bg-red-100 text-red-600'
    };
    const labels = { pending: 'Pendiente', completed: 'Completado', rejected: 'Rechazado' };
    return <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Modal de retiro */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6">
            <h3 className="text-xl font-black mb-4">¿Cuánto quieres retirar?</h3>
            <input
              type="text"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="$0"
              className="w-full text-3xl font-black text-center border-2 border-gray-200 rounded-2xl py-4 mb-4 outline-none focus:border-emerald-500"
            />
            <div className="flex gap-2 mb-4">
              {[50000, 100000, 200000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setWithdrawAmount(amt.toString())}
                  className="flex-1 py-2 text-xs font-bold bg-gray-100 rounded-lg"
                >
                  ${amt.toLocaleString()}
                </button>
              ))}
              <button
                onClick={() => setWithdrawAmount(balance.toString())}
                className="flex-1 py-2 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-lg"
              >
                Todo
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4 text-center">Saldo disponible: {formatMoney(balance)}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowWithdrawModal(false); setWithdrawAmount(''); }}
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={requestWithdrawal}
                disabled={requesting}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold disabled:opacity-50"
              >
                {requesting ? 'Enviando...' : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          onClick={() => setShowWithdrawModal(true)}
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
          <ArrowUpCircle size={18} className="text-gray-400" /> Retiros
        </h3>
        {payouts.length === 0 ? (
          <div className="text-center py-6 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-400 text-sm">No tienes retiros solicitados</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {payouts.map((payout) => (
              <div key={payout.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-800">Retiro</p>
                  <p className="text-xs text-gray-400">{new Date(payout.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-gray-600">-${payout.amount?.toLocaleString()}</p>
                  {getPayoutStatusBadge(payout.status)}
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock size={18} className="text-gray-400" /> Ganancias
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