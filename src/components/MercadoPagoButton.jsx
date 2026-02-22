import React, { useState } from 'react';
import { Wallet, initMercadoPago } from '@mercadopago/sdk-react';
import { agentRegistry } from '../agents/AgentRegistry';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const mpPublicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
if (mpPublicKey && !window.mercadoPagoInstance) {
  window.mercadoPagoInstance = initMercadoPago(mpPublicKey, { locale: 'es-CO' });
}

const MercadoPagoButton = ({ amount, title, onSuccess }) => {
  const [preferenceId, setPreferenceId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const createPreference = async () => {
    setIsLoading(true);
    toast('Iniciando pago...', { icon: '⏳' });

    try {
      const paymentsAgent = agentRegistry.get('PaymentsAgent');
      if (!paymentsAgent) {
        throw new Error("PaymentsAgent no está disponible.");
      }
      
      const preferenceId = await paymentsAgent.createPaymentPreference(amount, title);
      setPreferenceId(preferenceId);

    } catch (error) {
      console.error("Error detallado en createPreference:", error);
      toast.error(`Error al iniciar el pago: ${error.message}`);
      setIsLoading(false);
    }
  };

  if (!mpPublicKey) {
    return <p className="text-red-500 text-xs text-center">Error: La pasarela de pagos no está configurada.</p>;
  }

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
    <button onClick={createPreference} disabled={isLoading} className="w-full h-14 bg-[#13ec13] ...">
      {isLoading ? <Loader2 className="animate-spin" /> : 'Continuar al Pago'}
    </button>
  );
};

export default MercadoPagoButton;
