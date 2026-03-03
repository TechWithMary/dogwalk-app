import React, { useState } from 'react';
import { agentRegistry } from '../agents/AgentRegistry';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const MercadoPagoButton = ({ amount, title, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const paymentsAgent = agentRegistry.get('PaymentsAgent');
      if (!paymentsAgent) throw new Error("PaymentsAgent no disponible");
      
    
      const preferenceId = await paymentsAgent.createPaymentPreference(amount, title);
      
    
      window.location.href = `https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=${preferenceId}`;

    } catch (error) {
      console.error("Error en el flujo de pago:", error);
      toast.error("Error al iniciar el pago. Revisa tus credenciales.");
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handlePayment} 
      disabled={isLoading} 
      className="w-full h-16 bg-[#13ec13] text-black rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
    >
      {isLoading ? (
        <Loader2 className="animate-spin w-5 h-5" />
      ) : (
        'Hacer el Pago'
      )}
    </button>
  );
};

export default MercadoPagoButton;