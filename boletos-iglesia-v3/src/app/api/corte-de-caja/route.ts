import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerClient();

    // Get today in Mexico City timezone
    const now = new Date();
    const todayMX = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // YYYY-MM-DD

    // Query window: yesterday through tomorrow UTC to cover MX timezone offset (UTC-6)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startUTC = yesterday.toISOString().slice(0, 10) + 'T00:00:00.000Z';
    const endUTC = tomorrow.toISOString().slice(0, 10) + 'T23:59:59.999Z';

    // Single query: pagos → registros → eventos in one round-trip
    // count:'exact' lets us detect if the default row limit is cutting results
    const { data: pagos, error: pagosError, count: totalEnRango } = await supabase
      .from('pagos')
      .select('monto, metodo_pago, created_at, registro:registros(evento_id, evento:eventos(nombre))', { count: 'exact' })
      .gte('created_at', startUTC)
      .lte('created_at', endUTC)
      .limit(10000);

    if (pagosError) throw pagosError;
    if (!pagos || pagos.length === 0) {
      return NextResponse.json({ eventos: [], fecha: todayMX, debug: { pagosEncontrados: 0, totalEnRango, startUTC, endUTC } });
    }

    // Build event totals map — filter to Mexico City today
    const eventoMap = new Map<string, {
      nombre: string;
      efectivo: number;
      tarjeta: number;
      transferencia: number;
      stripe: number;
      otro: number;
    }>();

    let pagosHoy = 0;
    let pagosSinRegistro = 0;
    const eventosDetectados = new Set<string>();

    for (const p of pagos) {
      const pagoDateMX = new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      if (pagoDateMX !== todayMX) continue;
      pagosHoy++;

      // Supabase may return the FK join as object or array depending on schema direction
      const raw = p.registro as any;
      const registro = Array.isArray(raw) ? raw[0] : raw;
      if (!registro || !registro.evento_id) { pagosSinRegistro++; continue; }

      const eventoId: string = registro.evento_id;
      const eventoNombre: string = registro.evento?.nombre ?? eventoId;
      eventosDetectados.add(eventoId);

      if (!eventoMap.has(eventoId)) {
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

    // Count pagos per MX date to help diagnose which day transactions land on
    const pagosPorFecha: Record<string, number> = {};
    for (const p of pagos) {
      const d = new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      pagosPorFecha[d] = (pagosPorFecha[d] ?? 0) + 1;
    }

    return NextResponse.json({
      eventos: result,
      fecha: todayMX,
      debug: { pagosEncontrados: pagos.length, totalEnRango, pagosHoy, pagosSinRegistro, eventosDetectados: eventosDetectados.size, pagosPorFecha },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
