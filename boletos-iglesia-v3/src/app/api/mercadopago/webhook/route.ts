import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createServerClient } from '@/lib/supabase';

const client = new MercadoPagoConfig({ accessToken: (process.env.MP_ACCESS_TOKEN || '').trim() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // MP sends different notification types
    if (body.type === 'payment' || body.action === 'payment.created' || body.action === 'payment.updated') {
      const paymentId = body.data?.id || body.id;
      if (!paymentId) return NextResponse.json({ ok: true });

      // Fetch payment details from MP
      const payment = new Payment(client);
      const paymentData = await payment.get({ id: paymentId });

      if (!paymentData) return NextResponse.json({ ok: true });

      const status = paymentData.status; // approved, pending, rejected, etc.
      const externalRef = paymentData.external_reference;

      if (!externalRef) return NextResponse.json({ ok: true });

      const registroIds = externalRef.split(',');
      const supabase = createServerClient();

      if (status === 'approved') {
        const total = paymentData.transaction_amount || 0;
        const numBoletos = registroIds.length;
        const perBoleto = Math.floor(total / numBoletos);
        const remainder = total - (perBoleto * numBoletos);

        for (let i = 0; i < registroIds.length; i++) {
          const regId = registroIds[i];
          const pagoBoleto = i === 0 ? perBoleto + remainder : perBoleto;

          // Update registro to liquidado
          await supabase.from('registros').update({
            monto_pagado: pagoBoleto,
            status: 'liquidado',
          }).eq('id', regId);

          // Record payment
          await supabase.from('pagos').insert({
            registro_id: regId,
            monto: pagoBoleto,
            metodo_pago: 'tarjeta',
            referencia: `MP-${paymentId}`,
          });

          // Change reserved seats to occupied
          await supabase.from('asientos').update({ estado: 'ocupado' })
            .eq('registro_id', regId).eq('estado', 'reservado');
        }

        // Send confirmation email
        const { data: firstReg } = await supabase.from('registros').select('correo').eq('id', registroIds[0]).single();
        if (firstReg?.correo) {
          try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://boletos.rnmexico.org';
            await fetch(`${appUrl}/api/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                registroId: registroIds[0],
                grupoIds: registroIds.length > 1 ? registroIds : undefined,
              }),
            });
          } catch {}
        }

        // Log activity
        await supabase.from('activity_log').insert({
          usuario_id: null,
          usuario_nombre: 'Compra en línea',
          accion: 'pago_registrado',
          detalle: `MP #${paymentId} — $${total.toLocaleString()} — ${registroIds.length} boleto(s)`,
          evento_id: null,
          registro_id: registroIds[0],
        });

      } else if (status === 'rejected' || status === 'cancelled') {
        // Release seats and delete pending registros
        for (const regId of registroIds) {
          await supabase.from('asientos').update({ estado: 'disponible', registro_id: null })
            .eq('registro_id', regId);
          await supabase.from('registros').delete().eq('id', regId).eq('status', 'pendiente');
        }
      }
      // For 'pending' status, keep registros as-is (waiting for payment at OXXO etc.)
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to MP
  }
}
