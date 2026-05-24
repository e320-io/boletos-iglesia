import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerClient();

    // Today in Mexico City timezone (same logic as RegistrosList per-event corte)
    const todayMX = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

    // Query pagos directly (not through registros) to avoid Supabase's 1000-row limit
    // on registros. Filter to last 48h at DB level to keep the result set small,
    // then apply the exact Mexico City date filter in memory.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);

    const { data: pagos, error } = await supabase
      .from('pagos')
      .select(`
        monto,
        metodo_pago,
        created_at,
        registro:registros(
          evento_id,
          evento:eventos(nombre)
        )
      `)
      .gte('created_at', cutoff.toISOString())
      .limit(20000);

    if (error) throw error;

    const eventoMap = new Map<string, {
      nombre: string;
      efectivo: number;
      tarjeta: number;
      transferencia: number;
      stripe: number;
      otro: number;
    }>();

    for (const p of pagos || []) {
      if (!p.created_at) continue;
      const pagoDateMX = new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      if (pagoDateMX !== todayMX) continue;

      const registro = p.registro as any;
      const eventoId = registro?.evento_id as string | null;
      if (!eventoId) continue;

      if (!eventoMap.has(eventoId)) {
        const eventoNombre = registro?.evento?.nombre ?? eventoId;
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

    return NextResponse.json({ eventos: result, fecha: todayMX }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
