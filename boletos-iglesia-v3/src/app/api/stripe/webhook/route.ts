import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      } catch (err: any) {
        console.error('Webhook signature error:', err.message);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } else {
      event = JSON.parse(body);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== 'paid') return NextResponse.json({ ok: true });

      const meta = session.metadata || {};
      const { eventoId, nombre, telefono, correo, whatsapp, edad, nacionId, equipoId } = meta;
      const numBoletos = parseInt(meta.cantidad || '1');
      const asientoIds: string[] = JSON.parse(meta.asientoIds || '[]');
      const total = (session.amount_total || 0) / 100;
      const perBoleto = Math.floor(total / numBoletos);
      const remainder = total - perBoleto * numBoletos;

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
          monto_total: pagoBoleto,
          monto_pagado: pagoBoleto,
          precio_boleto: pagoBoleto,
          tipo: 'general',
          notas: numBoletos > 1 ? `Compra en línea - ${nombre} (${numBoletos} boletos)` : 'Compra en línea',
        }).select().single();

        if (regErr) { console.error('Error creating registro:', regErr); continue; }
        registroIds.push(reg.id);

        await supabase.from('pagos').insert({
          registro_id: reg.id,
          monto: pagoBoleto,
          metodo_pago: 'tarjeta',
          referencia: `Stripe-${session.id}`,
        });

        if (asientoIds[i]) {
          const { data: seat } = await supabase.from('asientos').select('estado').eq('id', asientoIds[i]).single();
          if (seat?.estado === 'disponible') {
            await supabase.from('asientos').update({ estado: 'ocupado', registro_id: reg.id }).eq('id', asientoIds[i]);
          }
        }
      }

      if (correo && registroIds.length > 0) {
        try {
          const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
          await fetch(`${appUrl}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registroId: registroIds[0], grupoIds: registroIds.length > 1 ? registroIds : undefined }),
          });
        } catch {}
      }

      await supabase.from('activity_log').insert({
        usuario_id: null,
        usuario_nombre: 'Compra en línea',
        accion: 'pago_registrado',
        detalle: `Stripe #${session.id} — $${total.toLocaleString()} — ${numBoletos} boleto(s) — ${nombre}`,
        evento_id: eventoId,
        registro_id: registroIds[0] || null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}
