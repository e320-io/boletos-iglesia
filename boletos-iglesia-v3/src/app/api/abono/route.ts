import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    const { registro_id, monto, metodo_pago, referencia } = body;

    if (!registro_id || !monto || monto <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // Get current registro
    const { data: registro, error: regFetchError } = await supabase
      .from('registros')
      .select('*')
      .eq('id', registro_id)
      .single();

    if (regFetchError) throw regFetchError;

    const newPagado = Number(registro.monto_pagado) + Number(monto);
    const newStatus = newPagado >= Number(registro.monto_total) ? 'liquidado' : 'abono';

    // Record payment
    const { error: payError } = await supabase
      .from('pagos')
      .insert({
        registro_id,
        monto,
        metodo_pago: metodo_pago || 'efectivo',
        referencia: referencia || null,
      });

    if (payError) throw payError;

    // Update registro
    const { error: updateError } = await supabase
      .from('registros')
      .update({ monto_pagado: newPagado, status: newStatus })
      .eq('id', registro_id);

    if (updateError) throw updateError;

    return NextResponse.json({ status: 'ok', newStatus, newPagado });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
