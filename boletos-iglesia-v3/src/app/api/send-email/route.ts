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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { registroId, grupoIds } = body;
    const supabase = createServerClient();

    // Fetch main registro
    const { data: registro, error } = await supabase
      .from('registros')
      .select(`
        *,
        nacion:naciones(nombre, color),
        asientos(id),
        pagos(monto, metodo_pago, created_at)
      `)
      .eq('id', registroId)
      .single();

    if (error) throw error;
    if (!registro.correo) {
      return NextResponse.json({ error: 'No hay correo registrado' }, { status: 400 });
    }

    // Fetch group boletos if grupoIds provided
    let grupoBoletos: any[] = [];
    if (grupoIds && grupoIds.length > 1) {
      const { data: grupoData } = await supabase
        .from('registros')
        .select('*, asientos(id), pagos(monto, metodo_pago, created_at)')
        .in('id', grupoIds)
        .order('created_at');
      grupoBoletos = grupoData || [];
    }

    // If no explicit grupoIds, try to detect grupo from notas
    if (grupoBoletos.length === 0 && registro.notas) {
      const match = registro.notas.match(/^Grupo de .+ \(\d+ boletos\)$/);
      if (match) {
        const { data: grupoData } = await supabase
          .from('registros')
          .select('*, asientos(id), pagos(monto, metodo_pago, created_at)')
          .eq('notas', registro.notas)
          .order('created_at');
        grupoBoletos = grupoData || [];
      }
    }

    const isGrupo = grupoBoletos.length > 1;

    const statusLabel: Record<string, string> = { pendiente: 'Pendiente', abono: 'Abono', liquidado: 'Liquidado' };
    const statusColor: Record<string, string> = { pendiente: '#ef4444', abono: '#f59e0b', liquidado: '#10b981' };
    const metodoPagoLabel: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };
    const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || 'Evento Iglesia 2026';

    // Calculate totals
    const totalPagado = isGrupo
      ? grupoBoletos.reduce((s: number, b: any) => s + Number(b.monto_pagado), 0)
      : Number(registro.monto_pagado);
    const totalBoletos = isGrupo
      ? grupoBoletos.reduce((s: number, b: any) => s + Number(b.monto_total), 0)
      : Number(registro.monto_total);
    const saldoFaltante = totalBoletos - totalPagado;

    const lastPago = registro.pagos?.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    // Build asientos display
    let asientosHtml = '';
    if (isGrupo) {
      asientosHtml = grupoBoletos.map((b: any) => {
        const seats = (b.asientos || []).map((a: any) => a.id);
        const seatBadge = seats.length > 0
          ? seats.map((s: string) => `<span style="display:inline-block;background:#00bcd4;color:#fff;padding:4px 12px;border-radius:20px;font-weight:700;font-size:13px;margin:2px 4px 2px 0;">${s}</span>`).join('')
          : '<span style="color:#999;">Pendiente</span>';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
          <span>${b.nombre}</span>
          <span>${seatBadge}</span>
        </div>`;
      }).join('');
    } else {
      asientosHtml = (registro.asientos || []).length > 0
        ? (registro.asientos || []).map((a: any) =>
          `<span style="display:inline-block;background:#00bcd4;color:#fff;padding:4px 12px;border-radius:20px;font-weight:700;font-size:13px;margin:2px 4px 2px 0;">${a.id}</span>`
        ).join('')
        : '<span style="color:#999;">General</span>';
    }

    const allLiquidado = isGrupo ? grupoBoletos.every((b: any) => b.status === 'liquidado') : registro.status === 'liquidado';
    const overallStatus = allLiquidado ? 'liquidado' : saldoFaltante < totalBoletos ? 'abono' : 'pendiente';

    const htmlEmail = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);padding:32px;text-align:left;">
      <h1 style="color:#ffffff;font-size:24px;margin:0 0 8px 0;font-weight:700;">Comprobante de Boleto</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0;">Gracias por tu registro. Aquí están los detalles.</p>
    </div>
    <div style="padding:32px;">
      <p style="font-size:18px;color:#333;margin:0 0 24px 0;">
        Hola <strong>${registro.nombre}</strong>,
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;width:40%;">
            ${isGrupo ? `Boletos (${grupoBoletos.length})` : 'Asientos'}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-size:14px;">
            ${isGrupo ? `<div style="font-size:13px;">${asientosHtml}</div>` : asientosHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;">Status</td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-size:14px;">
            <span style="color:${statusColor[overallStatus]};font-weight:600;">${statusLabel[overallStatus]}</span>
          </td>
        </tr>
        ${lastPago ? `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;">Fecha de pago</td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-size:14px;">
            ${new Date(lastPago.created_at).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
          </td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;">Monto total recibido</td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-size:14px;font-weight:600;">
            $${totalPagado.toLocaleString()} ${lastPago ? `— ${metodoPagoLabel[lastPago.metodo_pago] || 'Otro'}` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;">Costo total</td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-size:14px;font-weight:600;">
            $${totalBoletos.toLocaleString()}${isGrupo ? ` (${grupoBoletos.length} boletos)` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;">Saldo faltante</td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-size:14px;font-weight:600;color:${saldoFaltante > 0 ? '#f59e0b' : '#10b981'};">
            $${saldoFaltante.toLocaleString()}
          </td>
        </tr>
        ${registro.nacion ? `
        <tr>
          <td style="padding:14px 0;color:#666;font-size:14px;">Mentor</td>
          <td style="padding:14px 0;font-size:14px;">${(registro.nacion as any).nombre}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    <div style="background:#f8f9fa;padding:16px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">Este correo fue generado automáticamente. Por favor no respondas.</p>
    </div>
  </div>
</body>
</html>`;

    const subject = isGrupo
      ? `Comprobante de ${grupoBoletos.length} boletos - ${registro.nombre}`
      : `Comprobante de boleto - ${registro.nombre}`;

    const info = await transporter.sendMail({
      from: `"${eventName}" <${process.env.GMAIL_USER || 'registrornmx@gmail.com'}>`,
      to: registro.correo,
      subject,
      html: htmlEmail,
    });

    return NextResponse.json({ status: 'ok', messageId: info.messageId });
  } catch (error: any) {
    console.error('Email error:', error);
    return NextResponse.json({ error: error.message || 'Error desconocido al enviar email' }, { status: 500 });
  }
}
