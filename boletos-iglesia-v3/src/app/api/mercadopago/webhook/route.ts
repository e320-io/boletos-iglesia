import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.type === 'payment' || body.action === 'payment.created' || body.action === 'payment.updated') {
      const paymentId = body.data?.id || body.id;
      if (!paymentId) return NextResponse.json({ ok: true });

      const accessToken = (process.env.MP_ACCESS_TOKEN || '').trim();
      const client = new MercadoPagoConfig({ accessToken });
      const payment = new Payment(client);
      const paymentData = await payment.get({ id: paymentId });

      if (!paymentData) return NextResponse.json({ ok: true });

      const status = paymentData.status;
      const externalRef = paymentData.external_reference;

      if (!externalRef) return NextResponse.json({ ok: true });

      // Only create registros when payment is APPROVED
      if (status !== 'approved') return NextResponse.json({ ok: true });

      // Decode buyer data from external_reference
      let buyerData: any;
      try {
        buyerData = JSON.parse(Buffer.from(externalRef, 'base64').toString('utf-8'));
      } catch {
        // Legacy format (comma-separated IDs) — skip
        return NextResponse.json({ ok: true });
      }

      const { eventoId, nombre, telefono, correo, whatsapp, edad, nacionId, equipoId, asientoIds, cantidad } = buyerData;
      const numBoletos = cantidad || 1;
      const total = paymentData.transaction_amount || 0;
      const perBoleto = Math.floor(total / numBoletos);
      const remainder = total - (perBoleto * numBoletos);

      const supabase = createServerClient();
      const registroIds: string[] = [];

      for (let i = 0; i < numBoletos; i++) {
        const regNombre = i === 0 ? nombre : `${nombre} - Invitado ${i}`;
        const pagoBoleto = i === 0 ? perBoleto + remainder : perBoleto;

        const { data: reg, error: regErr } = await supabase.from('registros').insert({
          nombre: regNombre,
          telefono: i === 0 ? telefono || null : null,
          correo: i === 0 ? correo || null : null,
          whatsapp: i === 0 ? whatsapp || null : null,
          edad: i === 0 && edad ? parseInt(edad) : null,
          nacion_id: nacionId || null,
          equipo_id: equipoId || null,
          evento_id: eventoId,
          status: 'liquidado',
          monto_total: perBoleto + (i === 0 ? remainder : 0),
          monto_pagado: pagoBoleto,
          precio_boleto: perBoleto + (i === 0 ? remainder : 0),
          tipo: 'general',
          notas: numBoletos > 1 ? `Compra en línea - ${nombre} (${numBoletos} boletos)` : 'Compra en línea',
        }).select().single();

        if (regErr) {
          console.error('Error creating registro:', regErr);
          continue;
        }
        registroIds.push(reg.id);

        // Record payment
        await supabase.from('pagos').insert({
          registro_id: reg.id,
          monto: pagoBoleto,
          metodo_pago: 'tarjeta',
          referencia: `MP-${paymentId}`,
        });

        // Assign seat if provided and still available
        if (asientoIds && asientoIds[i]) {
          const { data: seat } = await supabase.from('asientos')
            .select('estado').eq('id', asientoIds[i]).single();
          if (seat && seat.estado === 'disponible') {
            await supabase.from('asientos').update({ estado: 'ocupado', registro_id: reg.id }).eq('id', asientoIds[i]);
          }
        }
      }

      // Send confirmation email
      if (correo && registroIds.length > 0) {
        try {
          const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
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
        detalle: `MP #${paymentId} — $${total.toLocaleString()} — ${numBoletos} boleto(s) — ${nombre}`,
        evento_id: eventoId,
        registro_id: registroIds[0] || null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to MP
  }
}
