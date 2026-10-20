import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const MERCADOPAGO_API_URL = 'https://api.mercadopago.com/checkout/preferences';

type BookingInput = {
  pet_ids?: string[];
  duration?: string;
  address?: string;
  lat?: number;
  lng?: number;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  walker_id?: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!accessToken || !supabaseUrl || !anonKey || !serviceKey) {
      throw new Error('Error de configuración del servidor.');
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const body = await req.json();
    const kind = body?.kind === 'topup' ? 'topup' : body?.kind === 'booking' ? 'booking' : null;
    if (!kind) {
      throw new Error('Se requiere kind booking o topup.');
    }

    const admin = createClient(supabaseUrl, serviceKey);
    let externalReference = '';
    let unitPrice = 0;
    let title = '';
    let description = '';

    if (kind === 'topup') {
      const amount = Number(body.amount);
      if (!Number.isInteger(amount)) {
        throw new Error('El monto de recarga debe ser un entero en COP.');
      }
      const { data, error } = await admin.rpc('service_create_pending_topup', {
        p_user_id: user.id,
        p_amount: amount,
      });
      if (error) throw new Error(error.message);
      unitPrice = data.amount;
      externalReference = user.id;
      title = 'Recarga HappiWalk';
      description = 'Recarga de billetera HappiWalk';
    } else {
      const booking = (body.booking ?? {}) as BookingInput;
      const petIds = Array.isArray(booking.pet_ids) ? booking.pet_ids : [];
      const { data, error } = await admin.rpc('service_create_pending_booking', {
        p_user_id: user.id,
        p_pet_ids: petIds,
        p_duration: booking.duration ?? '',
        p_address: booking.address ?? '',
        p_lat: booking.lat ?? null,
        p_lng: booking.lng ?? null,
        p_scheduled_date: booking.scheduled_date ?? null,
        p_scheduled_time: booking.scheduled_time ?? null,
        p_walker_id: booking.walker_id || null,
      });
      if (error) throw new Error(error.message);
      unitPrice = data.amount;
      externalReference = data.booking_id;
      title = 'Paseo HappiWalk';
      description = 'Servicio de paseo de mascotas';
    }

    const preferencePayload = {
      items: [{
        title,
        description,
        quantity: 1,
        currency_id: 'COP',
        unit_price: unitPrice,
      }],
      payer: {
        email: user.email,
      },
      back_urls: {
        success: 'happiwalk://payment/success',
        failure: 'happiwalk://payment/failure',
        pending: 'happiwalk://payment/pending',
      },
      auto_return: 'approved',
      notification_url: `${supabaseUrl}/functions/v1/payment-webhook`,
      external_reference: externalReference,
    };

    const response = await fetch(MERCADOPAGO_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferencePayload),
    });

    const responseData = await response.json();
    if (!response.ok) {
      console.error('Mercado Pago preference rejected');
      throw new Error(responseData.message || 'Fallo al crear la preferencia.');
    }

    return new Response(JSON.stringify({
      preferenceId: responseData.id,
      amount: unitPrice,
      externalReference,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de pago';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
