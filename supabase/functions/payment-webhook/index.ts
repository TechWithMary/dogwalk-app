// supabase/functions/payment-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

function isWithinRadius(lat1: number, lng1: number, lat2: number, lng2: number, radiusKm: number): boolean {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c) <= radiusKm;
}

async function findNearbyWalker(lat: number, lng: number, scheduledDate: string | null, scheduledTime: string | null) {
  console.log(`Buscando walker cercano a lat: ${lat}, lng: ${lng}`);
  
  let walkerIds: string[] = [];
  
  // Si es agendado, buscar por disponibilidad
  if (scheduledDate && scheduledTime) {
    const dateObj = new Date(scheduledDate + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    
    const { data: availability } = await supabaseAdmin
      .from('walker_availability')
      .select('walker_id')
      .eq('day_of_week', dayOfWeek)
      .lte('start_time', scheduledTime)
      .gte('end_time', scheduledTime);
    
    if (availability?.length) {
      walkerIds = availability.map(a => a.walker_id);
    }
  }
  
  // Si no hay disponibilidad específica, buscar todos los walkers verificados
  let query = supabaseAdmin
    .from('walkers')
    .select('id, user_id, name, rating, service_latitude, service_longitude, service_radius_km')
    .eq('overall_verification_status', 'approved');
  
  if (walkerIds.length > 0) {
    query = query.in('id', walkerIds);
  }
  
  const { data: walkers } = await query;
  
  if (!walkers?.length) {
    console.log('No se encontraron walkers');
    return null;
  }
  
  // Filtrar por distancia
  const nearbyWalkers = walkers
    .filter(w => w.service_latitude && w.service_longitude && w.service_radius_km)
    .filter(w => isWithinRadius(lat, lng, w.service_latitude, w.service_longitude, w.service_radius_km));
  
  if (!nearbyWalkers.length) {
    console.log('No hay walkers en el radio de servicio');
    return null;
  }
  
  // Retornar el de mejor rating
  nearbyWalkers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  console.log(`Walker asignado: ${nearbyWalkers[0].name}`);
  return nearbyWalkers[0];
}

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
        
        // Verificar si es un booking (external_reference es JSON con type: 'booking')
        let bookingData = null;
        let isBooking = false;
        
        try {
          const parsed = JSON.parse(externalReference);
          if (parsed && parsed.type === 'booking') {
            bookingData = parsed;
            isBooking = true;
          }
        } catch (e) {
          // No es JSON, es string simple
          isBooking = externalReference === 'booking_payment';
        }

        if (isWalletRecharge) {
          // === PROCESAR RECARGA DE BILLETERA ===
          console.log(`Procesando recarga de billetera para usuario ${userId}`);

          const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('balance')
            .eq('user_id', userId)
            .single();

          const currentBalance = parseFloat(profile?.balance || 0);
          const newBalance = currentBalance + amountPaid;

          await supabaseAdmin
            .from('user_profiles')
            .update({ balance: newBalance })
            .eq('user_id', userId);

          await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: userId,
              transaction_type: 'deposit',
              amount: amountPaid,
              net_amount: amountPaid,
              payment_method: 'credit_card',
              payment_gateway: 'mercadopago',
              gateway_transaction_id: paymentId.toString(),
              status: 'completed',
              description: 'Recarga de billetera via MercadoPago',
            });

          await supabaseAdmin.from('notifications').insert({
            user_id: userId,
            title: '💰 Recarga Exitosa',
            body: `Tu recarga de $${amountPaid.toLocaleString()} ha sido procesada. Nuevo saldo: $${newBalance.toLocaleString()}`,
            link_to: '/wallet'
          });

        } else if (isBooking && bookingData) {
          // === PROCESAR PAGO DE RESERVA (BOOKING) ===
          console.log(`Procesando pago de reserva para usuario ${userId}`);
          
          // 1. Buscar walker cercano
          const walker = await findNearbyWalker(
            bookingData.lat, 
            bookingData.lng, 
            bookingData.scheduled_date, 
            bookingData.scheduled_time
          );
          
          // 2. Crear el booking
          const { data: newBooking, error: bookingError } = await supabaseAdmin
            .from('bookings')
            .insert({
              user_id: bookingData.user_id,
              address: bookingData.address,
              lat: bookingData.lat,
              lng: bookingData.lng,
              duration: bookingData.duration,
              total_price: bookingData.total_price,
              status: 'confirmed',
              walker_id: walker?.id || null,
              scheduled_date: bookingData.scheduled_date,
              scheduled_time: bookingData.scheduled_time,
              pet_ids: bookingData.pet_ids,
              is_paid: true,
              payment_method: 'credit_card',
              payment_completed_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (bookingError) {
            console.error('Error creando booking:', bookingError);
          } else {
            console.log(`Booking creado: ${newBooking.id}`);
            
            // 3. Actualizar balance del walker si hay uno asignado
            if (walker) {
              const netEarning = bookingData.total_price * 0.80 * 0.96;
              await supabaseAdmin.rpc('increment_walker_balance', {
                walker_user_id: walker.user_id,
                amount: netEarning
              });
              console.log(`Balance del walker actualizado: $${netEarning}`);
            }
          }
          
          // 4. Registrar transacción
          await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: bookingData.user_id,
              booking_id: newBooking?.id || null,
              transaction_type: 'payment',
              amount: amountPaid,
              net_amount: amountPaid,
              payment_method: 'credit_card',
              payment_gateway: 'mercadopago',
              gateway_transaction_id: paymentId.toString(),
              status: 'completed',
              description: `Paseo ${bookingData.duration}`,
            });

          // 5. Notificar al usuario
          await supabaseAdmin.from('notifications').insert({
            user_id: bookingData.user_id,
            title: '🎉 Reserva Confirmada',
            body: walker 
              ? `Tu paseo con ${walker.name} ha sido confirmado para el ${bookingData.scheduled_date || 'hoy'}`
              : `Tu paseo ha sido confirmado para el ${bookingData.scheduled_date || 'hoy'}`,
            link_to: `/booking-details?id=${newBooking?.id}`
          });

          // 6. Notificar al walker si hay uno asignado
          if (walker) {
            await supabaseAdmin.from('notifications').insert({
              user_id: walker.user_id,
              title: '🐕 Nuevo Paseo Asignado',
              body: `Tienes un nuevo paseo programado para el ${bookingData.scheduled_date || 'hoy'} en ${bookingData.address}`,
              link_to: '/walker/home'
            });
          }

        } else {
          // === PAGO DE RESERVA SIMPLE (sin external_reference detallado) ===
          console.log(`Procesando pago de reserva simple para usuario ${userId}`);
          
          await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: userId,
              transaction_type: 'payment',
              amount: amountPaid,
              net_amount: amountPaid,
              payment_method: 'credit_card',
              payment_gateway: 'mercadopago',
              gateway_transaction_id: paymentId.toString(),
              status: 'completed',
              description: description || 'Pago de paseo',
            });
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
