import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import MercadoPagoButton from '../components/MercadoPagoButton';
import { ArrowUpRight, ArrowDownLeft, Plus, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

const formatMoney = (val) => '$' + (val || 0).toLocaleString('es-CO');

const SkeletonLoader = () => (
    <div className="animate-pulse p-6">
        <div className="h-48 bg-gray-200 rounded-3xl mb-8"></div>
        <div className="h-16 bg-gray-200 rounded-2xl mb-4"></div>
        <div className="h-16 bg-gray-200 rounded-2xl"></div>
    </div>
);

const Wallet = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [walletData, setWalletData] = useState({ balance: 0, transactions: [] });
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (profileError) throw profileError;
      setProfile(userProfile);

      const { data: history } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setWalletData({
        balance: userProfile?.balance || 0,
        transactions: history || []
      });

    } catch (error) {
      console.error(error);
      toast.error("Error al cargar la billetera");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const failed = params.get('failed');
    const pending = params.get('pending');

    if (success === 'true') {
      toast.success("¡Recarga exitosa! Tu saldo se ha actualizado.");
      window.history.replaceState({}, document.title, '/wallet');
    } else if (failed === 'true') {
      toast.error("El pago no se completó. Intenta de nuevo.");
      window.history.replaceState({}, document.title, '/wallet');
    } else if (pending === 'true') {
      toast("Tu pago está siendo procesado. Te notificaremos cuando esté listo.");
      window.history.replaceState({}, document.title, '/wallet');
    }

    fetchWalletData();
  }, []);

  const isWalker = profile?.role === 'walker';

  const handlePaymentSuccess = () => {
    toast.success("¡Recarga exitosa! Tu saldo se actualizará pronto.");
    setIsToppingUp(false);
    setTopUpAmount('');
    fetchWalletData();
  };

  if (loading) return <SkeletonLoader />;

  return (
    <div className={`min-h-full pb-24 p-6 ${isWalker ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <WalletBalanceCard balance={walletData.balance} profile={profile} isWalker={isWalker} />

      {!isWalker && (
        isToppingUp ? (
          <TopUpSection 
            amount={topUpAmount}
            onAmountChange={setTopUpAmount}
            profileEmail={profile?.email}
            onSuccess={handlePaymentSuccess}
            onCancel={() => setIsToppingUp(false)}
          />
        ) : (
          <ActionButtons onTopUpClick={() => setIsToppingUp(true)} onManageCardsClick={() => navigate('/manage-cards')} />
        )
      )}
      
      <TransactionHistory transactions={walletData.transactions} isWalker={isWalker} />
    </div>
  );
};

const WalletBalanceCard = ({ balance, profile, isWalker }) => (
  <div className={`relative w-full h-48 rounded-3xl overflow-hidden shadow-2xl mb-8 ${isWalker ? 'bg-gray-800' : 'bg-gray-900'}`}>
    <div className="p-6 flex flex-col justify-between h-full text-white">
      <div>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Saldo Disponible</p>
        <h2 className="text-3xl font-black tracking-tight">{formatMoney(balance)}</h2>
      </div>
      <div>
        <p className="text-gray-500 text-xs font-bold uppercase mb-1">Titular</p>
        <p className="font-bold uppercase tracking-wide text-sm">{profile?.first_name || 'Usuario'}</p>
      </div>
    </div>
  </div>
);

const ActionButtons = ({ onTopUpClick, onManageCardsClick }) => (
  <div className="grid grid-cols-2 gap-4 mb-8">
    <button onClick={onTopUpClick} className="bg-white p-4 rounded-2xl shadow-sm border flex items-center gap-3 hover:border-emerald-500 transition">
      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><Plus className="w-5 h-5" /></div>
      <span className="font-bold text-sm text-gray-700">Recargar</span>
    </button>
    <button onClick={onManageCardsClick} className="bg-white p-4 rounded-2xl shadow-sm border flex items-center gap-3 hover:border-blue-500 transition">
      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><CreditCard className="w-5 h-5" /></div>
      <span className="font-bold text-sm text-gray-700">Mis Tarjetas</span>
    </button>
  </div>
);

const TopUpSection = ({ amount, onAmountChange, profileEmail, onSuccess, onCancel }) => (
  <div className="bg-white p-6 rounded-2xl shadow-lg border mb-8">
    <h3 className="font-bold text-lg mb-4 text-gray-800">Recargar Saldo</h3>
    <div className="mb-4">
      <label htmlFor="topUpAmount" className="text-xs font-bold text-gray-500">Monto en COP</label>
      <input
        id="topUpAmount"
        type="tel"
        value={amount}
        onChange={(e) => /^\d*$/.test(e.target.value) && onAmountChange(e.target.value)}
        placeholder="Ej: 50000"
        className="w-full mt-1 p-3 border-2 border-gray-100 rounded-xl text-lg font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition outline-none text-gray-800"
      />
    </div>
    {amount && parseInt(amount) >= 5000 ? (
      <MercadoPagoButton
        amount={parseInt(amount)}
        title={`Recarga HappiWalk - ${profileEmail || 'Usuario'}`}
        onSuccess={onSuccess}
      />
    ) : (
      <button disabled className="w-full h-14 bg-gray-100 text-gray-400 font-bold rounded-xl text-sm">
        {amount ? 'Mínimo $5.000 COP' : 'Introduce un monto'}
      </button>
    )}
    <button onClick={onCancel} className="w-full text-center mt-4 text-sm font-bold text-gray-400 hover:text-gray-600">
      Cancelar
    </button>
  </div>
);

const TransactionHistory = ({ transactions, isWalker }) => (
  <>
    <h3 className={`font-black text-lg mb-4 ${isWalker ? 'text-white' : 'text-gray-800'}`}>Historial de Movimientos</h3>
    <div className="space-y-3">
      {transactions.length > 0 ? transactions.map((t, i) => (
        <div key={i} className={`p-4 rounded-2xl flex items-center justify-between shadow-sm ${isWalker ? 'bg-gray-800' : 'bg-white border border-gray-100'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isWalker ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-50 text-orange-500'}`}>
              {t.transaction_type === 'payment' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
            </div>
            <div>
              <p className={`font-bold text-sm ${isWalker ? 'text-white' : 'text-gray-700'}`}>
                {t.transaction_type === 'payment' ? (isWalker ? "Ganancia por paseo" : "Pago de paseo") : "Recarga de saldo"}
              </p>
              <p className="text-gray-400 text-[10px] font-bold uppercase">{new Date(t.created_at).toLocaleDateString('es-CO')}</p>
            </div>
          </div>
          <span className={`font-black text-sm ${isWalker || t.transaction_type === 'deposit' ? 'text-emerald-500' : 'text-gray-900'}`}>
            {t.transaction_type === 'payment' ? (isWalker ? '+' : '-') : '+'}{formatMoney(Math.abs(isWalker ? t.net_earning : t.amount))}
          </span>
        </div>
      )) : <p className="text-center text-gray-400 text-sm p-8 font-bold uppercase tracking-widest">No hay movimientos</p>}
    </div>
  </>
);

export default Wallet;