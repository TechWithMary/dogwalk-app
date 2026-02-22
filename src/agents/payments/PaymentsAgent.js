import BaseAgent from '../BaseAgent.js';
import { initMercadoPago } from '@mercadopago/sdk-react';

// ============================================
// CONFIGURACIÓN DE COMISIONES
// ============================================
const PLATFORM_COMMISSION = 0.20; // 20% para la plataforma
const GATEWAY_FEE_RATE = 0.04;    // 4% fee de MercadoPago (absorbido por plataforma)

class PaymentsAgent extends BaseAgent {
  constructor() {
    super('PaymentsAgent', {
      publicKey: import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY,
    });
    this.isInitialized = false;
    this.supabase = null; // Espacio para el cliente de Supabase
  }

  // Método para "inyectar" el cliente de Supabase desde fuera
  setSupabaseClient(supabaseClient) {
    this.supabase = supabaseClient;
  }

  async initialize() {
    this.setStatus('initializing');
    if (this.config.publicKey) {
      initMercadoPago(this.config.publicKey, { locale: 'es-CO' });
      this.isInitialized = true;
      this.log('Mercado Pago SDK (React) initialized.');
    } else {
      this.handleError(new Error('Mercado Pago Public Key is not configured.'), 'initialization');
    }
    this.setStatus('ready');
  }

  // ============================================
  // CÁLCULO DE COMISIONES
  // ============================================
  calculateEarnings(totalPrice) {
    const total = parseFloat(totalPrice);
    const gatewayFee = total * GATEWAY_FEE_RATE;
    const platformFee = total * PLATFORM_COMMISSION;
    const netEarning = total - gatewayFee - platformFee;

    return {
      total: total,
      gatewayFee: parseFloat(gatewayFee.toFixed(2)),
      platformFee: parseFloat(platformFee.toFixed(2)),
      netEarning: parseFloat(netEarning.toFixed(2)),
      breakdown: {
        walker: `${((netEarning / total) * 100).toFixed(1)}%`,
        platform: `${(PLATFORM_COMMISSION * 100)}%`,
        gateway: `${(GATEWAY_FEE_RATE * 100)}%`
      }
    };
  }

  // ============================================
  // REGISTRAR TRANSACCIÓN COMPLETA
  // ============================================
  async recordTransaction(bookingId, userId, walkerId, totalPrice, paymentMethod = 'credit_card') {
    if (!this.supabase) throw new Error("Supabase client not set");

    try {
      const earnings = this.calculateEarnings(totalPrice);

      // 1. Registrar transacción
      const { data: transaction, error: txError } = await this.supabase
        .from('transactions')
        .insert({
          user_id: userId,
          booking_id: bookingId,
          transaction_type: 'payment',
          amount: earnings.total,
          gateway_fee: earnings.gatewayFee,
          platform_fee: earnings.platformFee,
          net_earning: earnings.netEarning,
          payment_method: paymentMethod,
          status: 'completed',
          description: `Pago de paseo #${bookingId}`,
          metadata: {
            earnings_breakdown: earnings.breakdown
          }
        })
        .select()
        .single();

      if (txError) throw txError;

      // 2. Actualizar balance del walker
      const { error: balanceError } = await this.supabase.rpc('increment_walker_balance', {
        walker_user_id: walkerId,
        amount: earnings.netEarning
      });

      if (balanceError) {
        console.warn('No se pudo actualizar balance automáticamente:', balanceError);
        // Fallback: actualizar manualmente
        await this.updateWalkerBalance(walkerId, earnings.netEarning);
      }

      this.log(`✅ Transacción registrada: Walker recibe $${earnings.netEarning}`);
      return { transaction, earnings };

    } catch (error) {
      this.handleError(error, 'recordTransaction');
      throw error;
    }
  }

  // ============================================
  // ACTUALIZAR BALANCE DEL WALKER (Fallback)
  // ============================================
  async updateWalkerBalance(walkerUserId, amount) {
    if (!this.supabase) throw new Error("Supabase client not set");

    try {
      // Obtener balance actual
      const { data: profile, error: getError } = await this.supabase
        .from('user_profiles')
        .select('balance')
        .eq('user_id', walkerUserId)
        .single();

      if (getError) throw getError;

      const currentBalance = parseFloat(profile.balance || 0);
      const newBalance = currentBalance + parseFloat(amount);

      // Actualizar
      const { error: updateError } = await this.supabase
        .from('user_profiles')
        .update({ balance: newBalance })
        .eq('user_id', walkerUserId);

      if (updateError) throw updateError;

      this.log(`Balance actualizado: $${currentBalance} → $${newBalance}`);
      return newBalance;

    } catch (error) {
      this.handleError(error, 'updateWalkerBalance');
      throw error;
    }
  }

  // ============================================
  // OBTENER BALANCE DEL WALKER
  // ============================================
  async getWalkerBalance(walkerUserId) {
    if (!this.supabase) throw new Error("Supabase client not set");

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('balance')
        .eq('user_id', walkerUserId)
        .single();

      if (error) throw error;
      return parseFloat(data.balance || 0);

    } catch (error) {
      this.handleError(error, 'getWalkerBalance');
      return 0;
    }
  }

  // ============================================
  // CREAR PREFERENCIA DE PAGO (Original)
  // ============================================
  async createPaymentPreference(amount, title) {
    if (!this.isInitialized) throw new Error("PaymentsAgent not initialized.");
    if (!this.supabase) throw new Error("Supabase client not set in PaymentsAgent.");

    try {
      this.recordMetric('create_preference_request', 1);

      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) throw new Error("No se pudo obtener el usuario. Inicia sesión de nuevo.");

      const { data, error } = await this.supabase.functions.invoke('create-payment-intent', {
        body: { amount, title, email: user.email },
      });

      if (error) throw error;
      if (!data.preferenceId) throw new Error("La respuesta del servidor no incluyó un ID de preferencia.");

      return data.preferenceId;

    } catch (error) {
      this.handleError(error, 'createPaymentPreference');
      throw error;
    }
  }
}

export default PaymentsAgent;
