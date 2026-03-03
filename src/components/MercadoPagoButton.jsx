import React, { useState, useEffect } from 'react';
import { Wallet, initMercadoPago } from '@mercadopago/sdk-react';
import { agentRegistry } from '../agents/AgentRegistry';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const mpPublicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;

const MercadoPagoButton = ({ amount, title, onSuccess }) => {
  const [preferenceId, setPreferenceId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mpPublicKey) {
      initMercadoPago(mpPublicKey, { locale: 'es-CO' });
    }
  }, []);

  const createPreference = async () => {
    setIsLoading(true);
    try {
      const paymentsAgent = agentRegistry.get('PaymentsAgent');
      if (!paymentsAgent) throw new Error("PaymentsAgent no disponible");
      
      const prefId = await paymentsAgent.createPaymentPreference(amount, title);
      setPreferenceId(prefId);
    } catch (error) {
      console.error(error);
      toast.error("Error al iniciar el pago");
      setIsLoading(false);
    }
  };

  if (!mpPublicKey) return null;

  if (preferenceId) {
    return (
      <Wallet 
        initialization={{ preferenceId: preferenceId }} 
        onReady={() => setIsLoading(false)}
        onSubmit={onSuccess}
      />
    );
  }

  return (
    <button 
      onClick={createPreference} 
      disabled={isLoading} 
      className="w-full h-16 bg-[#13ec13] text-black rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
    >
      {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Pagar Ahora'}
    </button>
  );
};

export default MercadoPagoButton;
