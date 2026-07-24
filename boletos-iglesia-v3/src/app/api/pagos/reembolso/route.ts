import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    const { pago_id, monto_reembolsado, motivo } = body;

    if (!pago_id || !monto_reembolsado || monto_reembolsado <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const { data: pago, error: pagoFetchError } = await supabase
      .from('pagos')
      .select('*')
      .eq('id', pago_id)
      .single();

    if (pagoFetchError) throw pagoFetchError;
    if (pago.reembolsado) {
      return NextResponse.json({ error: 'Este pago ya fue reembolsado' }, { status: 400 });
    }
    if (Number(monto_reembolsado) > Number(pago.monto)) {
      return NextResponse.json({ error: 'El monto a reembolsar no puede ser mayor al pago' }, { status: 400 });
    }

    const { data: registro, error: regFetchError } = await supabase
      .from('registros')
      .select('*')
      .eq('id', pago.registro_id)
      .single();

    if (regFetchError) throw regFetchError;

    const newPagado = Math.max(0, Number(registro.monto_pagado) - Number(monto_reembolsado));
    const newStatus = newPagado <= 0 ? 'pendiente' : newPagado >= Number(registro.monto_total) ? 'liquidado' : 'abono';

    const { error: pagoUpdateError } = await supabase
      .from('pagos')
      .update({
        reembolsado: true,
        monto_reembolsado,
        reembolsado_at: new Date().toISOString(),
        motivo_reembolso: motivo || null,
      })
      .eq('id', pago_id);

    if (pagoUpdateError) throw pagoUpdateError;

    const { error: regUpdateError } = await supabase
      .from('registros')
      .update({ monto_pagado: newPagado, status: newStatus })
      .eq('id', pago.registro_id);

    if (regUpdateError) throw regUpdateError;

    return NextResponse.json({ status: 'ok', newStatus, newPagado });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
