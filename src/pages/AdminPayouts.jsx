import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { DollarSign, Check, X, Loader2, ArrowDownCircle, User, Smartphone, CreditCard, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminPayouts = () => {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchPayouts();
  }, [activeTab]);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select(`
          *,
          walkers:walker_id (
            id,
            name,
            user_id,
            user_profiles (first_name, last_name, phone, bank_account_type, bank_account_number)
          )
        `)
        .eq('status', activeTab)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayouts(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando retiros");
    } finally {
      setLoading(false);
    }
  };

  const processPayout = async (payoutId, newStatus) => {
    if (!confirm(`¿Confirmas que quieres ${newStatus === 'completed' ? 'APROBAR' : 'RECHAZAR'} este retiro?`)) return;

    setProcessingId(payoutId);
    try {
      console.log('Procesando payout:', payoutId, 'nuevo status:', newStatus);
      
      // Primero obtener los datos del payout
      const { data: payoutData, error: fetchError } = await supabase
        .from('payouts')
        .select('*, walkers(*)')
        .eq('id', payoutId)
        .single();

      if (fetchError) throw fetchError;

      console.log('Payout data:', payoutData);

      const { data, error } = await supabase
        .from('payouts')
        .update({ status: newStatus, payout_date: new Date().toISOString().split('T')[0] })
        .eq('id', payoutId)
        .select();

      console.log('Update result:', data, 'Error:', error);

      if (error) throw error;

      // Si se aprueba, restar del balance del paseador
      if (newStatus === 'completed' && payoutData?.walkers?.user_id) {
        const walkerUserId = payoutData.walkers.user_id;
        console.log('Restando balance del walker:', walkerUserId, 'monto:', payoutData.amount);
        
        // Obtener balance actual
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('balance')
          .eq('user_id', walkerUserId)
          .single();
        
        const currentBalance = profile?.balance || 0;
        const newBalance = Math.max(0, currentBalance - payoutData.amount);

        console.log('Balance actual:', currentBalance, 'Nuevo balance:', newBalance);

        // Actualizar balance
        const { error: balanceError } = await supabase
          .from('user_profiles')
          .update({ balance: newBalance })
          .eq('user_id', walkerUserId);

        console.log('Balance update error:', balanceError);

        // Registrar transacción de retiro
        await supabase.from('transactions').insert({
          user_id: walkerUserId,
          booking_id: payoutData.id,
          transaction_type: 'withdrawal',
          amount: payoutData.amount,
          net_amount: payoutData.amount,
          status: 'completed',
          description: `Retiro aprobado - ${payoutData.notes || ''}`
        });
      }

      // Notificar al paseador
      if (payoutData?.walkers?.user_id) {
        await supabase.from('notifications').insert({
          user_id: payoutData.walkers.user_id,
          title: newStatus === 'completed' ? '✅ Retiro Aprobado' : '❌ Retiro Rechazado',
          body: newStatus === 'completed' 
            ? `Tu retiro de $${payoutData.amount?.toLocaleString()} ha sido procesado.`
            : 'Tu solicitud de retiro ha sido rechazada. Contacta soporte.',
          link_to: '/walker-balance'
        });
      }

      toast.success(newStatus === 'completed' ? 'Retiro aprobado y balance actualizado' : 'Retiro rechazado');
      fetchPayouts();
    } catch (error) {
      console.error('Error procesando payout:', error);
      toast.error("Error al procesar: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatMoney = (amount) => {
    return '$' + (amount || 0).toLocaleString('es-CO');
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-orange-100 text-orange-600',
      processing: 'bg-blue-100 text-blue-600',
      completed: 'bg-emerald-100 text-emerald-600',
      rejected: 'bg-red-100 text-red-600'
    };
    const labels = {
      pending: 'Pendiente',
      processing: 'Procesando',
      completed: 'Completado',
      rejected: 'Rechazado'
    };
    return (
      <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-emerald-500 w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-emerald-100 p-3 rounded-xl">
          <DollarSign className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Retiros</h1>
          <p className="text-gray-400 text-sm">Gestionar solicitudes de pago</p>
        </div>
      </div>

      <div className="flex p-1 bg-gray-200 rounded-2xl mb-6">
        <button 
          onClick={() => setActiveTab('pending')} 
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${activeTab === 'pending' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}
        >
          PENDIENTES
        </button>
        <button 
          onClick={() => setActiveTab('completed')} 
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${activeTab === 'completed' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}
        >
          COMPLETADOS
        </button>
        <button 
          onClick={() => setActiveTab('rejected')} 
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${activeTab === 'rejected' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500'}`}
        >
          RECHAZADOS
        </button>
      </div>

      {payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-400">Todo al día</h3>
          <p className="text-xs text-gray-300">
            {activeTab === 'pending' ? 'No hay retiros pendientes' : `No hay retiros ${activeTab}`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {payouts.map((payout) => {
            const walker = payout.walkers;
            const profile = walker?.user_profiles;
            const walkerName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : walker?.name || 'Paseador';

            return (
              <div key={payout.id} className="bg-white rounded-3xl shadow-lg shadow-gray-200/50 overflow-hidden border border-gray-100">
                <div className="p-5 border-b border-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                        {walkerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{walkerName}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Smartphone size={14}/> {profile?.phone || 'Sin teléfono'}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(payout.status)}
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4">
<div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-gray-400 uppercase">Monto</span>
                      <span className="text-2xl font-black text-emerald-600">{formatMoney(payout.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-700 capitalize">
                        {profile?.bank_account_type || 'Nequi'}
                      </span>
                      <span className="text-gray-500">
                        •••• {profile?.bank_account_number?.slice(-4) || '****'}
                      </span>
                    </div>
                  </div>

                  {payout.notes && (
                    <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                      <Clock size={12} /> {payout.notes}
                    </p>
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    Solicitado: {new Date(payout.created_at).toLocaleDateString('es-CO', { 
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>

                {payout.status === 'pending' && (
                  <div className="p-4 bg-orange-50 border-t border-orange-100">
                    <p className="text-xs text-orange-700 font-bold mb-3">⚠️ IMPORTANTE: Haz la transferencia primero, luego confirma</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => processPayout(payout.id, 'rejected')}
                        disabled={processingId === payout.id}
                        className="flex-1 py-3 rounded-xl border-2 border-red-100 text-red-500 font-bold hover:bg-red-50 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                      >
                        <X size={18} /> Rechazar
                      </button>
                      <button 
                        onClick={() => processPayout(payout.id, 'completed')}
                        disabled={processingId === payout.id}
                        className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-200 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                      >
                        {processingId === payout.id ? <Loader2 className="animate-spin" /> : <><Check size={18} /> Confirmar Transferencia</>}
                      </button>
                    </div>
                  </div>
                )}

                {payout.status === 'completed' && (
                  <div className="p-4 bg-emerald-50 border-t border-emerald-100 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span className="font-bold text-emerald-700 text-sm">Pago procesado el {new Date(payout.payout_date).toLocaleDateString('es-CO')}</span>
                  </div>
                )}

                {payout.status === 'rejected' && (
                  <div className="p-4 bg-red-50 border-t border-red-100 flex items-center justify-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="font-bold text-red-700 text-sm">Retiro rechazado</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminPayouts;
