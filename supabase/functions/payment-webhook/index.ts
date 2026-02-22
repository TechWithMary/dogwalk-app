// supabase/functions/payment-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("Webhook de Mercado Pago recibido:", JSON.stringify(payload, null, 2));

    // Solo actuar si el webhook es de un pago
    if (payload.type === 'payment' && payload.action === 'payment.created') {
      const paymentId = payload.data.id;

      // 1. Obtener los detalles del pago desde Mercado Pago
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')}`
        }
      });
      const paymentDetails = await mpResponse.json();

      if (!mpResponse.ok) {
        throw new Error(`Error al obtener detalles del pago: ${paymentDetails.message}`);
      }

      const userEmail = paymentDetails.payer.email;
      const amountPaid = paymentDetails.transaction_amount;
      const status = paymentDetails.status;

      // 2. Si el pago está aprobado, actualizar el saldo del usuario
      if (status === 'approved') {
        // a. Encontrar al usuario por su email
        const { data: userProfile, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('user_id, balance')
          .eq('email', userEmail)
          .single();

        if (profileError || !userProfile) {
          throw new Error(`No se encontró el perfil para el email: ${userEmail}`);
        }

        // b. Actualizar el saldo
        const newBalance = (userProfile.balance || 0) + amountPaid;
        const { error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({ balance: newBalance })
          .eq('user_id', userProfile.user_id);

        if (updateError) {
          throw new Error(`Error al actualizar el saldo: ${updateError.message}`);
        }

        console.log(`Saldo actualizado para ${userEmail}. Nuevo saldo: ${newBalance}`);
        
        // c. Opcional: Registrar la transacción en la tabla 'transactions'
        // ...
      }
    }

    return new Response(JSON.stringify({ status: "received" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error en el webhook:", error.message);
    return new Response(JSON.stringify({ error: "Error procesando el webhook" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
