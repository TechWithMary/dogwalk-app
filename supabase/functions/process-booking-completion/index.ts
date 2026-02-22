import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const COMMISSION_RATE = 0.20; // 20% commission

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookingId } = await req.json();
    if (!bookingId) throw new Error("Booking ID is required.");

    // Crear un cliente de Supabase con rol de servicio para poder modificar datos sin RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Obtener la transacción asociada a la reserva
    const { data: transaction, error: transError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    if (transError) throw new Error(`Error fetching transaction: ${transError.message}`);
    if (!transaction) throw new Error(`No transaction found for booking ID: ${bookingId}`);

    // 2. Calcular la comisión y la ganancia
    const totalAmount = transaction.amount;
    const platformFee = totalAmount * COMMISSION_RATE;
    const netEarning = totalAmount - platformFee;

    // 3. Actualizar la transacción con los nuevos valores
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        platform_fee: platformFee,
        net_earning: netEarning,
        status: 'completed' // Asegurarnos de que el estado final sea 'completed'
      })
      .eq('id', transaction.id);

    if (updateError) throw new Error(`Error updating transaction: ${updateError.message}`);

    return new Response(JSON.stringify({ message: "Booking processed successfully", netEarning }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
