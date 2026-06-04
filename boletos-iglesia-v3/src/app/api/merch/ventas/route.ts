import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'registrornmx@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const evento_id = searchParams.get('evento_id');

  let query = supabase
    .from('merch_ventas')
    .select(`*, detalle:merch_ventas_detalle(*), pagos:merch_pagos(*)`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (evento_id) query = query.eq('evento_id', evento_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();
  const { servidor_id, servidor_nombre, cliente_nombre, cliente_correo, evento_id, items, pagos, total } = body;

  const { data: venta, error: ve } = await supabase
    .from('merch_ventas')
    .insert({ servidor_id, servidor_nombre, cliente_nombre, cliente_correo, evento_id: evento_id || null, total })
    .select()
    .single();

  if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });

  const detalleRows = items.map((item: any) => ({
    venta_id: venta.id,
    variante_id: item.variante_id,
    producto_nombre: item.producto_nombre,
    variante_descripcion: item.variante_descripcion || null,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    subtotal: item.cantidad * item.precio_unitario,
  }));

  const { error: de } = await supabase.from('merch_ventas_detalle').insert(detalleRows);
  if (de) return NextResponse.json({ error: de.message }, { status: 500 });

  const pagoRows = pagos.map((p: any) => ({
    venta_id: venta.id,
    monto: p.monto,
    metodo_pago: p.metodo_pago,
    referencia: p.referencia || null,
  }));

  const { error: pe } = await supabase.from('merch_pagos').insert(pagoRows);
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });

  // Decrement inventory for each item sold
  for (const item of items) {
    const { data: inv } = await supabase
      .from('merch_inventario')
      .select('cantidad')
      .eq('variante_id', item.variante_id)
      .single();

    if (inv) {
      await supabase
        .from('merch_inventario')
        .update({ cantidad: Math.max(0, inv.cantidad - item.cantidad), updated_at: new Date().toISOString() })
        .eq('variante_id', item.variante_id);
    }
  }

  if (cliente_correo) {
    try {
      const metodoPagoLabel: Record<string, string> = {
        efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro',
      };

      const itemsHtml = detalleRows.map((d: any) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#333;">
            ${d.producto_nombre}${d.variante_descripcion ? ` <span style="color:#999;">— ${d.variante_descripcion}</span>` : ''}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;text-align:center;color:#333;">×${d.cantidad}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;font-weight:600;color:#333;">$${Number(d.subtotal).toLocaleString('es-MX')}</td>
        </tr>`).join('');

      const pagosHtml = pagoRows.map((p: any) => `
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#666;">${metodoPagoLabel[p.metodo_pago] || p.metodo_pago}</td>
          <td style="padding:5px 0;font-size:13px;text-align:right;color:#666;">$${Number(p.monto).toLocaleString('es-MX')}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:520px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);padding:28px 32px;">
      <h1 style="color:#fff;font-size:20px;margin:0 0 4px 0;">RN México — Tienda Merch</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">Comprobante de compra · Folio #${venta.folio}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:16px;color:#333;margin:0 0 22px 0;">
        ${cliente_nombre ? `Hola <strong>${cliente_nombre}</strong>, gracias por tu compra.` : 'Gracias por tu compra.'}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 0;border-bottom:2px solid #eee;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Producto</th>
            <th style="text-align:center;padding:8px 0;border-bottom:2px solid #eee;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Cant.</th>
            <th style="text-align:right;padding:8px 0;border-bottom:2px solid #eee;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;">
        ${pagosHtml}
        <tr>
          <td style="padding:12px 0 4px;font-size:16px;font-weight:700;border-top:2px solid #eee;color:#1e3a5f;">Total</td>
          <td style="padding:12px 0 4px;font-size:16px;font-weight:700;border-top:2px solid #eee;text-align:right;color:#1e3a5f;">$${Number(total).toLocaleString('es-MX')}</td>
        </tr>
      </table>
    </div>
    <div style="background:#f8f9fa;padding:14px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">Folio: <strong>#${venta.folio}</strong> · Este correo fue generado automáticamente. Por favor no respondas.</p>
    </div>
  </div>
</body></html>`;

      await transporter.sendMail({
        from: `"RN México Merch" <${process.env.GMAIL_USER || 'registrornmx@gmail.com'}>`,
        to: cliente_correo,
        subject: `Comprobante Merch — Folio #${venta.folio}`,
        html,
      });
    } catch (emailErr) {
      console.error('Error sending merch email:', emailErr);
    }
  }

  return NextResponse.json({ ok: true, venta });
}
