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
      const externalReference = paymentDetails.external_reference;
      const description = paymentDetails.description;

      console.log(`Pago recibido - Email: ${userEmail}, Monto: ${amountPaid}, Status: ${status}, Ref: ${externalReference}`);

      // 2. Si el pago está aprobado, procesar
      if (status === 'approved') {
        
        // Primero, buscar al usuario en auth.users por email
        const { data: authUser, error: authError } = await supabaseAdmin
          .from('users')
          .select('id, email')
          .eq('email', userEmail)
          .single();

        if (authError || !authUser) {
          console.error(`No se encontró usuario en auth.users para el email: ${userEmail}`);
          throw new Error(`No se encontró el usuario para el email: ${userEmail}`);
        }

        const userId = authUser.id;
        console.log(`Usuario encontrado: ${userId}`);

        // Determinar tipo de transacción
        const isWalletRecharge = externalReference === 'wallet_recharge' || 
                                  (description && description.includes('Recarga HappiWalk'));

        if (isWalletRecarga) {
          // === PROCESAR RECARGA DE BILLETERA ===
          console.log(`Procesando recarga de billetera para usuario ${userId}`);

          // Obtener perfil actual
          const { data: profile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('balance')
            .eq('user_id', userId)
            .single();

          if (profileError) {
            console.error(`Error obteniendo perfil: ${profileError.message}`);
            throw new Error(`Error obteniendo perfil: ${profileError.message}`);
          }

          // Actualizar balance
          const currentBalance = parseFloat(profile?.balance || 0);
          const newBalance = currentBalance + amountPaid;

          const { error: updateError } = await supabaseAdmin
            .from('user_profiles')
            .update({ balance: newBalance })
            .eq('user_id', userId);

          if (updateError) {
            console.error(`Error actualizando balance: ${updateError.message}`);
            throw new Error(`Error actualizando balance: ${updateError.message}`);
          }

          console.log(`Balance actualizado: ${currentBalance} → ${newBalance}`);

          // Registrar transacción
          const { error: txError } = await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: userId,
              transaction_type: 'deposit',
              amount: amountPaid,
              net_amount: amountPaid,
              payment_method: paymentDetails.payment_method_id ? 'credit_card' : 'mercadopago',
              payment_gateway: 'mercadopago',
              gateway_transaction_id: paymentId.toString(),
              status: 'completed',
              description: 'Recarga de billetera via MercadoPago',
              metadata: {
                mp_payment_id: paymentId,
                mp_external_reference: externalReference,
                previous_balance: currentBalance,
                new_balance: newBalance
              }
            });

          if (txError) {
            console.error(`Error registrando transacción: ${txError.message}`);
            // No lanzamos error porque el balance ya se actualizó
          } else {
            console.log(`Transacción registrada exitosamente`);
          }

          // Notificar al usuario
          await supabaseAdmin.from('notifications').insert({
            user_id: userId,
            title: '💰 Recarga Exitosa',
            body: `Tu recarga de $${amountPaid.toLocaleString()} ha sido procesada. Nuevo saldo: $${newBalance.toLocaleString()}`,
            link_to: '/wallet'
          });

        } else {
          // === PROCESAR PAGO DE RESERVA (Reservas de paseo) ===
          console.log(`Procesando pago de reserva para usuario ${userId}`);
          
          // Registrar transacción
          const { error: txError } = await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: userId,
              transaction_type: 'payment',
              amount: amountPaid,
              net_amount: amountPaid,
              payment_method: paymentDetails.payment_method_id ? 'credit_card' : 'mercadopago',
              payment_gateway: 'mercadopago',
              gateway_transaction_id: paymentId.toString(),
              status: 'completed',
              description: description || 'Pago de paseo',
              metadata: {
                mp_payment_id: paymentId,
                mp_external_reference: externalReference
              }
            });

          if (txError) {
            console.error(`Error registrando transacción de pago: ${txError.message}`);
          }
        }
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
