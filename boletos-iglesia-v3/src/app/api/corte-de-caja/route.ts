import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createServerClient();

    // Get today in Mexico City timezone
    const now = new Date();
    const todayMX = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD

    // Query window: yesterday through tomorrow UTC to cover any MX timezone offset
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startUTC = yesterday.toISOString().slice(0, 10) + 'T00:00:00.000Z';
    const endUTC = tomorrow.toISOString().slice(0, 10) + 'T23:59:59.999Z';

    // Get all active events
    const { data: eventos, error: eventosError } = await supabase
      .from('eventos')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');

    if (eventosError) throw eventosError;
    if (!eventos || eventos.length === 0) {
      return NextResponse.json({ eventos: [], fecha: todayMX });
    }

    // Get today's pagos
    const { data: pagos, error: pagosError } = await supabase
      .from('pagos')
      .select('monto, metodo_pago, created_at, registro_id')
      .gte('created_at', startUTC)
      .lte('created_at', endUTC);

    if (pagosError) throw pagosError;
    if (!pagos || pagos.length === 0) {
      return NextResponse.json({ eventos: [], fecha: todayMX });
    }

    // Get the evento_id for each registro referenced by today's pagos
    const registroIds = [...new Set(pagos.map(p => p.registro_id).filter(Boolean))];
    const { data: registros, error: registrosError } = await supabase
      .from('registros')
      .select('id, evento_id')
      .in('id', registroIds);

    if (registrosError) throw registrosError;

    const registroMap = new Map<string, string>();
    for (const r of (registros || [])) {
      registroMap.set(r.id, r.evento_id);
    }

    // Build event totals map
    const eventoMap = new Map<string, {
      nombre: string;
      efectivo: number;
      tarjeta: number;
      transferencia: number;
      stripe: number;
      otro: number;
    }>();

    for (const e of eventos) {
      eventoMap.set(e.id, { nombre: e.nombre, efectivo: 0, tarjeta: 0, transferencia: 0, stripe: 0, otro: 0 });
    }

    for (const p of pagos) {
      // Filter to today's Mexico City date
      const pagoDateMX = new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      if (pagoDateMX !== todayMX) continue;

      const eventoId = registroMap.get(p.registro_id);
      if (!eventoId || !eventoMap.has(eventoId)) continue;

      const ev = eventoMap.get(eventoId)!;
      const monto = Number(p.monto);

      if (p.metodo_pago === 'efectivo') ev.efectivo += monto;
      else if (p.metodo_pago === 'tarjeta') ev.tarjeta += monto;
      else if (p.metodo_pago === 'transferencia') ev.transferencia += monto;
      else if (p.metodo_pago === 'stripe') ev.stripe += monto;
      else ev.otro += monto;
    }

    const result = Array.from(eventoMap.entries())
      .map(([id, data]) => ({
        id,
        nombre: data.nombre,
        total: data.efectivo + data.tarjeta + data.transferencia + data.stripe + data.otro,
        efectivo: data.efectivo,
        tarjeta: data.tarjeta,
        transferencia: data.transferencia,
        stripe: data.stripe,
        otro: data.otro,
      }))
      .filter(e => e.total > 0);

    return NextResponse.json({ eventos: result, fecha: todayMX });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
