// supabase/functions/payment-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Mercado Pago webhook signature.
 * Manifest: id:[data.id];request-id:[x-request-id];ts:[ts];
 * https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
 */
async function verifyMercadoPagoSignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
  if (!secret) return false;

  const signatureHeader = req.headers.get('x-signature');
  if (!signatureHeader || !dataId) return false;

  const parts: Record<string, string> = {};
  for (const piece of signatureHeader.split(',')) {
    const eq = piece.indexOf('=');
    if (eq === -1) continue;
    parts[piece.slice(0, eq).trim()] = piece.slice(eq + 1).trim();
  }
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const requestId = req.headers.get('x-request-id');
  let manifest = `id:${dataId.toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(hex, v1.toLowerCase());
}

function paymentIdFromRequest(req: Request, payload: Record<string, unknown>): string {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('data.id') || url.searchParams.get('id');
  const data = payload?.data as { id?: string | number } | undefined;
  const fromBody = data?.id != null ? String(data.id) : '';
  return (fromQuery || fromBody || '').trim();
}

function isPaymentNotification(req: Request, payload: Record<string, unknown>): boolean {
  const action = String(payload?.action || '');
  const type = String(payload?.type || '');
  const topic = new URL(req.url).searchParams.get('topic') || new URL(req.url).searchParams.get('type') || '';
  if (action === 'payment.created' || action === 'payment.updated') return true;
  if (type === 'payment' || topic === 'payment') return true;
  return false;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawBody = await req.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return new Response(JSON.stringify({ error: 'invalid json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const paymentId = paymentIdFromRequest(req, payload);
    const signatureOk = await verifyMercadoPagoSignature(req, paymentId);
    if (!signatureOk) {
      return new Response(JSON.stringify({ error: 'invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isPaymentNotification(req, payload)) {
      return new Response(JSON.stringify({ status: 'ignored' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'missing payment id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'server misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const paymentDetails = await mpResponse.json();
    if (!mpResponse.ok) {
      return new Response(JSON.stringify({ error: 'payment lookup failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseAdmin.rpc('process_mercadopago_payment', {
      p_payment_id: String(paymentDetails.id ?? paymentId),
      p_status: paymentDetails.status ?? '',
      p_amount: paymentDetails.transaction_amount ?? 0,
      p_external_reference: paymentDetails.external_reference ?? '',
      p_currency: paymentDetails.currency_id ?? 'COP',
    });

    if (error) {
      console.error('process_mercadopago_payment failed');
      return new Response(JSON.stringify({ error: 'processing failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'received', result: data?.processed === false ? data.reason : 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (_error) {
    console.error('payment webhook failed');
    return new Response(JSON.stringify({ error: 'webhook failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
