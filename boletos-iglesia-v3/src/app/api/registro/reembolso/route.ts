import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    const { registro_id, motivo } = body;

    if (!registro_id) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const { data: pagos, error: pagosFetchError } = await supabase
      .from('pagos')
      .select('*')
      .eq('registro_id', registro_id)
      .eq('reembolsado', false);

    if (pagosFetchError) throw pagosFetchError;

    const now = new Date().toISOString();

    for (const pago of pagos || []) {
      const { error: pagoUpdateError } = await supabase
        .from('pagos')
        .update({
          reembolsado: true,
          monto_reembolsado: pago.monto,
          reembolsado_at: now,
          motivo_reembolso: motivo || null,
        })
        .eq('id', pago.id);
      if (pagoUpdateError) throw pagoUpdateError;
    }

    const { error: regUpdateError } = await supabase
      .from('registros')
      .update({ monto_pagado: 0, status: 'reembolsado' })
      .eq('id', registro_id);

    if (regUpdateError) throw regUpdateError;

    const { error: asientoError } = await supabase
      .from('asientos')
      .update({ estado: 'disponible', registro_id: null })
      .eq('registro_id', registro_id);

    if (asientoError) throw asientoError;

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
