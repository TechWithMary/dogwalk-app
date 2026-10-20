import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';

const MercadoPagoButton = ({ amount, booking }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const body = booking
        ? { kind: 'booking', booking }
        : { kind: 'topup', amount: Math.round(Number(amount)) };

      const { data, error } = await supabase.functions.invoke('create-payment-intent', { body });
      if (error) throw error;
      if (!data?.preferenceId) throw new Error('No se pudo iniciar el pago');

      window.location.href = `https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=${data.preferenceId}`;
    } catch (error) {
      console.error('No se pudo iniciar el pago');
      toast.error(error.message || 'Error al iniciar el pago.');
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
