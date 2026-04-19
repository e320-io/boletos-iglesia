import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const accessToken = (process.env.MP_ACCESS_TOKEN || '').trim();
    if (!accessToken) {
      return NextResponse.json({ error: 'Mercado Pago no configurado' }, { status: 500 });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const body = await request.json();
    const { eventoId, nombre, telefono, correo, whatsapp, edad, nacionId, equipoId, asientoIds, cantidad } = body;

    const supabase = createServerClient();

    // Fetch event
    const { data: evento, error: evError } = await supabase.from('eventos').select('*').eq('id', eventoId).single();
    if (evError || !evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

    const numBoletos = cantidad || 1;
    const precioUnitario = evento.precio_default;
    const total = precioUnitario * numBoletos;

    if (total <= 0) return NextResponse.json({ error: 'Este evento es gratuito' }, { status: 400 });

    // Validate seats are still available (don't reserve them yet)
    if (asientoIds && asientoIds.length > 0) {
      const { data: seats } = await supabase.from('asientos').select('id, estado').in('id', asientoIds);
      const unavailable = (seats || []).filter(s => s.estado !== 'disponible');
      if (unavailable.length > 0) {
        return NextResponse.json({ error: 'Uno o más asientos ya no están disponibles. Selecciona otros.' }, { status: 409 });
      }
    }

    // Build seat labels for description
    let seatDesc = '';
    if (asientoIds && asientoIds.length > 0) {
      const { data: seats } = await supabase.from('asientos').select('fila, columna').in('id', asientoIds);
      if (seats) seatDesc = ' — Asientos: ' + seats.map((s: any) => s.fila === 'RE' ? `RE-${s.columna}` : `${s.fila}${s.columna}`).join(', ');
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();

    // Pack buyer data into external_reference (no DB writes yet)
    const buyerData = JSON.stringify({
      eventoId, nombre, telefono, correo, whatsapp, edad,
      nacionId, equipoId, asientoIds, cantidad: numBoletos,
    });
    const encodedData = Buffer.from(buyerData).toString('base64');

    // Create MP preference
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [{
          id: eventoId,
          title: `${evento.nombre} — ${numBoletos} boleto${numBoletos > 1 ? 's' : ''}${seatDesc}`,
          quantity: 1,
          unit_price: total,
          currency_id: 'MXN',
        }],
        payer: {
          name: nombre,
          email: correo || undefined,
          phone: telefono ? { number: telefono } : undefined,
        },
        back_urls: {
          success: `${appUrl}/comprar/resultado?status=success`,
          failure: `${appUrl}/comprar/resultado?status=failure`,
          pending: `${appUrl}/comprar/resultado?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${appUrl}/api/mercadopago/webhook`,
        external_reference: encodedData,
      },
    });

    return NextResponse.json({
      preferenceId: result.id,
      initPoint: result.init_point,
    });
  } catch (error: any) {
    console.error('MP preference error:', error);
    return NextResponse.json({ error: error.message || 'Error al crear preferencia' }, { status: 500 });
  }
}
