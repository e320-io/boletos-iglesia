import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const body = await request.json();
    const { eventoId, nombre, telefono, correo, whatsapp, edad, nacionId, equipoId, rol, asientoIds, cantidad } = body;

    const supabase = createServerClient();
    const { data: evento, error: evError } = await supabase.from('eventos').select('*').eq('id', eventoId).single();
    if (evError || !evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

    const numBoletos = cantidad || 1;

    let precioBoleto = evento.precio_default;
    if (evento.usa_fases_precio) {
      const { data: fases } = await supabase
        .from('fases_precio').select('precio, fecha_inicio, fecha_fin')
        .eq('evento_id', eventoId).order('fecha_inicio');
      if (fases && fases.length > 0) {
        const hoy = new Date().toISOString().split('T')[0];
        const faseActiva = fases.find((f: any) => f.fecha_inicio <= hoy && hoy <= f.fecha_fin);
        if (faseActiva) precioBoleto = faseActiva.precio;
      }
    }

    const total = precioBoleto * numBoletos;
    if (total <= 0) return NextResponse.json({ error: 'Este evento es gratuito' }, { status: 400 });

    if (asientoIds && asientoIds.length > 0) {
      const { data: seats } = await supabase.from('asientos').select('id, estado').in('id', asientoIds);
      const unavailable = (seats || []).filter((s: any) => s.estado !== 'disponible');
      if (unavailable.length > 0) {
        return NextResponse.json({ error: 'Uno o más asientos ya no están disponibles. Selecciona otros.' }, { status: 409 });
      }
    }

    let seatDesc = '';
    if (asientoIds && asientoIds.length > 0) {
      const { data: seats } = await supabase.from('asientos').select('fila, columna').in('id', asientoIds);
      if (seats) seatDesc = ' — Asientos: ' + seats.map((s: any) => s.fila === 'RE' ? `RE-${s.columna}` : `${s.fila}${s.columna}`).join(', ');
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: {
            name: `${evento.nombre} — ${numBoletos} boleto${numBoletos > 1 ? 's' : ''}${seatDesc}`,
          },
          unit_amount: Math.round(total * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: correo || undefined,
      success_url: `${appUrl}/comprar/resultado?status=success`,
      cancel_url: `${appUrl}/comprar/resultado?status=failure`,
      metadata: {
        eventoId,
        nombre: nombre || '',
        telefono: telefono || '',
        correo: correo || '',
        whatsapp: whatsapp || '',
        edad: edad ? String(edad) : '',
        nacionId: nacionId || '',
        equipoId: equipoId || '',
        rol: rol || '',
        asientoIds: JSON.stringify(asientoIds || []),
        cantidad: String(numBoletos),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: error.message || 'Error al crear sesión de pago' }, { status: 500 });
  }
}
