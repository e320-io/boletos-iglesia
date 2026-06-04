import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();

  const [ventasRes, pagosRes, detalleRes] = await Promise.all([
    supabase.from('merch_ventas').select('total, created_at').order('created_at', { ascending: false }),
    supabase.from('merch_pagos').select('monto, metodo_pago'),
    supabase.from('merch_ventas_detalle').select('producto_nombre, cantidad, subtotal'),
  ]);

  const ventas = ventasRes.data || [];
  const pagos = pagosRes.data || [];
  const detalle = detalleRes.data || [];

  const totalVentas = ventas.length;
  const totalIngresos = ventas.reduce((s, v) => s + Number(v.total), 0);

  const byMethod = pagos.reduce((acc: Record<string, number>, p) => {
    acc[p.metodo_pago] = (acc[p.metodo_pago] || 0) + Number(p.monto);
    return acc;
  }, {});

  const byProduct = detalle.reduce((acc: Record<string, { cantidad: number; total: number }>, d) => {
    if (!acc[d.producto_nombre]) acc[d.producto_nombre] = { cantidad: 0, total: 0 };
    acc[d.producto_nombre].cantidad += d.cantidad;
    acc[d.producto_nombre].total += Number(d.subtotal);
    return acc;
  }, {});

  const topProductos = Object.entries(byProduct)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([nombre, stats]) => ({ nombre, ...stats }));

  // Sales by day (last 30 days)
  const byDay = ventas.reduce((acc: Record<string, number>, v) => {
    const day = v.created_at.slice(0, 10);
    acc[day] = (acc[day] || 0) + Number(v.total);
    return acc;
  }, {});

  return NextResponse.json({ totalVentas, totalIngresos, byMethod, topProductos, byDay });
}
