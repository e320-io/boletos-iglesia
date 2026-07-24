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
        reembolsado,
        registro:registros(
          evento_id,
          evento:eventos(nombre)
        )
      `)
      .gte('created_at', cutoff.toISOString())
      .limit(20000);

    if (error) throw error;

    // Reembolsos procesados hoy: el dinero sale de caja hoy aunque el pago
    // original sea de otro día, así que se filtra por reembolsado_at, no created_at.
    const { data: reembolsos, error: reembolsosError } = await supabase
      .from('pagos')
      .select(`
        monto_reembolsado,
        metodo_pago,
        reembolsado_at,
        registro:registros(
          evento_id,
          evento:eventos(nombre)
        )
      `)
      .eq('reembolsado', true)
      .gte('reembolsado_at', cutoff.toISOString())
      .limit(20000);

    if (reembolsosError) throw reembolsosError;

    const eventoMap = new Map<string, {
      nombre: string;
      efectivo: number;
      tarjeta: number;
      transferencia: number;
      stripe: number;
      otro: number;
    }>();

    const getEvento = (eventoId: string, eventoNombre: string) => {
      if (!eventoMap.has(eventoId)) {
        eventoMap.set(eventoId, { nombre: eventoNombre, efectivo: 0, tarjeta: 0, transferencia: 0, stripe: 0, otro: 0 });
      }
      return eventoMap.get(eventoId)!;
    };

    const addToMetodo = (ev: ReturnType<typeof getEvento>, metodo: string, monto: number) => {
      if (metodo === 'efectivo') ev.efectivo += monto;
      else if (metodo === 'tarjeta') ev.tarjeta += monto;
      else if (metodo === 'transferencia') ev.transferencia += monto;
      else if (metodo === 'stripe') ev.stripe += monto;
      else ev.otro += monto;
    };

    for (const p of pagos || []) {
      if (p.reembolsado || !p.created_at) continue;
      const pagoDateMX = new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      if (pagoDateMX !== todayMX) continue;

      const registro = p.registro as any;
      const eventoId = registro?.evento_id as string | null;
      if (!eventoId) continue;

      const ev = getEvento(eventoId, registro?.evento?.nombre ?? eventoId);
      addToMetodo(ev, p.metodo_pago, Number(p.monto));
    }

    for (const p of reembolsos || []) {
      if (!p.reembolsado_at) continue;
      const reembolsoDateMX = new Date(p.reembolsado_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      if (reembolsoDateMX !== todayMX) continue;

      const registro = p.registro as any;
      const eventoId = registro?.evento_id as string | null;
      if (!eventoId) continue;

      const ev = getEvento(eventoId, registro?.evento?.nombre ?? eventoId);
      addToMetodo(ev, p.metodo_pago, -Number(p.monto_reembolsado));
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
