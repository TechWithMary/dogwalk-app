// supabase/functions/create-payment-intent/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const MERCADOPAGO_API_URL = 'https://api.mercadopago.com/checkout/preferences';

serve(async (req) => {
  // Manejo robusto de CORS para la petición de pre-vuelo
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      console.error("CRITICAL: MERCADOPAGO_ACCESS_TOKEN no está definido.");
      throw new Error("Error de configuración del servidor.");
    }

    const { amount, title, email } = await req.json();
    if (!amount || !title || !email) {
      throw new Error("Se requiere monto, título y email.");
    }

    const preferencePayload = {
      items: [{
        title: title,
        description: 'Servicio de paseo de mascotas',
        quantity: 1,
        currency_id: 'COP',
        unit_price: amount,
      }],
      payer: {
        email: email,
      },
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
