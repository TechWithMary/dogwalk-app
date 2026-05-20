import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const MERCADOPAGO_API_URL = 'https://api.mercadopago.com/checkout/preferences';

serve(async (req) => {
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      console.error("CRITICAL: MERCADOPAGO_ACCESS_TOKEN no está definido.");
      throw new Error("Error de configuración del servidor.");
    }

    const body = await req.json();
    const { amount, title, email, bookingData } = body;
    
    if (!amount || !title || !email) {
      throw new Error("Se requiere monto, título y email.");
    }

    const isWalletRecharge = title && title.includes('Recarga HappiWalk');
    
    // Construir external_reference
    let externalReference;
    if (isWalletRecharge) {
      externalReference = 'wallet_recharge';
    } else if (bookingData) {
      // Es un booking - guardar todos los datos necesarios para el webhook
      externalReference = JSON.stringify({
        type: 'booking',
        user_id: bookingData.user_id,
        pet_ids: bookingData.pet_ids,
        duration: bookingData.duration,
        address: bookingData.address,
        lat: bookingData.lat,
        lng: bookingData.lng,
        scheduled_date: bookingData.scheduled_date,
        scheduled_time: bookingData.scheduled_time,
        total_price: bookingData.total_price,
        booking_type: bookingData.booking_type || 'now'
      });
    } else {
      externalReference = 'booking_payment';
    }
    
    const preferencePayload = {
      items: [{
        title: title,
        description: isWalletRecharge ? 'Recarga de billetera HappiWalk' : 'Servicio de paseo de mascotas',
        quantity: 1,
        currency_id: 'COP',
        unit_price: amount,
      }],
      payer: {
        email: email,
      },
      back_urls: {
        success: "happiwalk://payment/success",
        failure: "happiwalk://payment/failure",
        pending: "happiwalk://payment/pending"
      },
      auto_return: "approved",
      notification_url: "https://trmleuxyneucveymqmod.supabase.co/functions/v1/payment-webhook",
      external_reference: externalReference,
    };

    const response = await fetch(MERCADOPAGO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferencePayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Error recibido de Mercado Pago:", responseData);
      throw new Error(responseData.message || 'Fallo al crear la preferencia.');
    }

    return new Response(JSON.stringify({ preferenceId: responseData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error final en la función:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
