import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerClient();

    // Today in Mexico City timezone (same logic as RegistrosList per-event corte)
    const todayMX = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

    // Mirror RegistrosList approach: fetch registros with nested pagos, filter in memory
    // This guarantees the same data the per-event cortes see
    const { data: registros, error } = await supabase
      .from('registros')
      .select('evento_id, evento:eventos(nombre), pagos(monto, metodo_pago, created_at)')
      .limit(10000);

    if (error) throw error;
    if (!registros || registros.length === 0) {
      return NextResponse.json({ eventos: [], fecha: todayMX });
    }

    const eventoMap = new Map<string, {
      nombre: string;
      efectivo: number;
      tarjeta: number;
      transferencia: number;
      stripe: number;
      otro: number;
    }>();

    for (const registro of registros) {
      const eventoId = registro.evento_id as string | null;
      if (!eventoId) continue;

      const pagos = (registro.pagos || []) as Array<{ monto: number; metodo_pago: string; created_at: string }>;

      for (const p of pagos) {
        if (!p.created_at) continue;
        const pagoDateMX = new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        if (pagoDateMX !== todayMX) continue;

        if (!eventoMap.has(eventoId)) {
          const eventoNombre = (registro.evento as any)?.nombre ?? eventoId;
          eventoMap.set(eventoId, { nombre: eventoNombre, efectivo: 0, tarjeta: 0, transferencia: 0, stripe: 0, otro: 0 });
        }

        const ev = eventoMap.get(eventoId)!;
        const monto = Number(p.monto);
        if (p.metodo_pago === 'efectivo') ev.efectivo += monto;
        else if (p.metodo_pago === 'tarjeta') ev.tarjeta += monto;
        else if (p.metodo_pago === 'transferencia') ev.transferencia += monto;
        else if (p.metodo_pago === 'stripe') ev.stripe += monto;
        else ev.otro += monto;
      }
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
      .filter(e => e.total > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return NextResponse.json({ eventos: result, fecha: todayMX });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
