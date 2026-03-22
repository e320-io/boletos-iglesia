import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createServerClient } from '@/lib/supabase';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });

export async function POST(request: NextRequest) {
  try {
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

    // Create pending registros
    const registroIds: string[] = [];
    for (let i = 0; i < numBoletos; i++) {
      const regNombre = i === 0 ? nombre : `${nombre} - Invitado ${i}`;
      const { data: reg, error: regErr } = await supabase.from('registros').insert({
        nombre: regNombre,
        telefono: i === 0 ? telefono || null : null,
        correo: i === 0 ? correo || null : null,
        whatsapp: i === 0 ? whatsapp || null : null,
        edad: i === 0 && edad ? parseInt(edad) : null,
        nacion_id: nacionId || null,
        equipo_id: equipoId || null,
        evento_id: eventoId,
        status: 'pendiente',
        monto_total: precioUnitario,
        monto_pagado: 0,
        precio_boleto: precioUnitario,
        tipo: 'general',
        notas: numBoletos > 1 ? `Compra en línea - ${nombre} (${numBoletos} boletos)` : 'Compra en línea',
      }).select().single();

      if (regErr) throw regErr;
      registroIds.push(reg.id);

      // Reserve seats if provided
      if (asientoIds && asientoIds[i]) {
        await supabase.from('asientos').update({ estado: 'reservado', registro_id: reg.id }).eq('id', asientoIds[i]);
      }
    }

    // Build seat labels for description
    let seatDesc = '';
    if (asientoIds && asientoIds.length > 0) {
      const { data: seats } = await supabase.from('asientos').select('fila, columna').in('id', asientoIds);
      if (seats) seatDesc = ' — Asientos: ' + seats.map(s => `${s.fila}${s.columna}`).join(', ');
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://boletos.rnmexico.org';

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
          success: `${appUrl}/comprar/resultado?status=success&registros=${registroIds.join(',')}`,
          failure: `${appUrl}/comprar/resultado?status=failure&registros=${registroIds.join(',')}`,
          pending: `${appUrl}/comprar/resultado?status=pending&registros=${registroIds.join(',')}`,
        },
        auto_return: 'approved',
        notification_url: `${appUrl}/api/mercadopago/webhook`,
        external_reference: registroIds.join(','),
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      },
    });

    return NextResponse.json({
      preferenceId: result.id,
      initPoint: result.init_point,
      registroIds,
    });
  } catch (error: any) {
    console.error('MP preference error:', error);
    return NextResponse.json({ error: error.message || 'Error al crear preferencia' }, { status: 500 });
  }
}
