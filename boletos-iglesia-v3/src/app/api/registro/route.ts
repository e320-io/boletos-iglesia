import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    const {
      nombre, telefono, correo, nacion_id,
      asientos_ids, monto_pago, metodo_pago, precio_boleto
    } = body;

    if (!nombre || !nacion_id || !asientos_ids?.length) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const montoTotal = asientos_ids.length * (precio_boleto || 400);
    const montoPagado = monto_pago || 0;
    const status = montoPagado >= montoTotal ? 'liquidado' : montoPagado > 0 ? 'abono' : 'pendiente';

    // Create registro
    const { data: registro, error: regError } = await supabase
      .from('registros')
      .insert({
        nombre,
        telefono: telefono || null,
        correo: correo || null,
        nacion_id,
        status,
        monto_total: montoTotal,
        monto_pagado: montoPagado,
        precio_boleto: precio_boleto || 400,
      })
      .select()
      .single();

    if (regError) throw regError;

    // Assign seats
    const { error: seatError } = await supabase
      .from('asientos')
      .update({ estado: 'ocupado', registro_id: registro.id })
      .in('id', asientos_ids);

    if (seatError) throw seatError;

    // Record payment
    if (montoPagado > 0) {
      await supabase
        .from('pagos')
        .insert({
          registro_id: registro.id,
          monto: montoPagado,
          metodo_pago: metodo_pago || 'efectivo',
        });
    }

    return NextResponse.json({ registro, status: 'ok' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
