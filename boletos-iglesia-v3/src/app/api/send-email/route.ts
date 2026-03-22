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
        asientos(id, fila, columna),
        pagos(monto, metodo_pago, created_at)
      `)
      .eq('id', registroId)
      .single();

    if (error) throw error;
    if (!registro.correo) {
      return NextResponse.json({ error: 'No hay correo registrado' }, { status: 400 });
    }

    // Detect event for theming
    let eventoSlug = 'default';
    let eventoNombre = 'Evento';
    if (registro.evento_id) {
      const { data: evento } = await supabase.from('eventos').select('slug, nombre').eq('id', registro.evento_id).single();
      if (evento) {
        eventoSlug = evento.slug;
        eventoNombre = evento.nombre;
      }
    }

    // Theme colors for email
    const isLegacy = eventoSlug === 'legacy-women';
    const emailColors = isLegacy ? {
      headerBg: 'linear-gradient(135deg, #6b4c3b, #4a3428)',
      accent: '#6b4c3b',
      bodyBg: '#faf7f4',
      cardBg: '#ffffff',
      textPrimary: '#2c1f16',
      textSecondary: '#8c7b6b',
      borderColor: '#e0d5c7',
      fontFamily: "'Georgia', 'Playfair Display', serif",
    } : {
      headerBg: 'linear-gradient(135deg, #1e3a5f, #0a1628)',
      accent: '#00bcd4',
      bodyBg: '#f5f5f5',
      cardBg: '#ffffff',
      textPrimary: '#333333',
      textSecondary: '#666666',
      borderColor: '#eeeeee',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    };

    // Fetch group boletos if grupoIds provided
    let grupoBoletos: any[] = [];
    if (grupoIds && grupoIds.length > 1) {
      const { data: grupoData } = await supabase
        .from('registros')
        .select('*, asientos(id, fila, columna), pagos(monto, metodo_pago, created_at)')
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
          .select('*, asientos(id, fila, columna), pagos(monto, metodo_pago, created_at)')
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

    // Helper to get seat label (fila+columna or id if legacy format)
    const getSeatLabel = (a: any) => a.fila && a.columna ? `${a.fila}${a.columna}` : a.id;

    // Build asientos display
    let asientosHtml = '';
    if (isGrupo) {
      asientosHtml = grupoBoletos.map((b: any) => {
        const seats = (b.asientos || []).map((a: any) => getSeatLabel(a));
        const seatBadge = seats.length > 0
          ? seats.map((s: string) => `<span style="display:inline-block;background:${emailColors.accent};color:#fff;padding:4px 12px;border-radius:20px;font-weight:700;font-size:13px;margin:2px 4px 2px 0;">${s}</span>`).join('')
          : '<span style="color:#999;">Pendiente</span>';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${emailColors.borderColor};">
          <span>${b.nombre}</span>
          <span>${seatBadge}</span>
        </div>`;
      }).join('');
    } else {
      asientosHtml = (registro.asientos || []).length > 0
        ? (registro.asientos || []).map((a: any) =>
          `<span style="display:inline-block;background:${emailColors.accent};color:#fff;padding:4px 12px;border-radius:20px;font-weight:700;font-size:13px;margin:2px 4px 2px 0;">${getSeatLabel(a)}</span>`
        ).join('')
        : '<span style="color:#999;">General</span>';
    }

    const allLiquidado = isGrupo ? grupoBoletos.every((b: any) => b.status === 'liquidado') : registro.status === 'liquidado';
    const overallStatus = allLiquidado ? 'liquidado' : saldoFaltante < totalBoletos ? 'abono' : 'pendiente';

    const htmlEmail = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${emailColors.bodyBg};font-family:${emailColors.fontFamily};">
  <div style="max-width:600px;margin:0 auto;background:${emailColors.cardBg};border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <div style="background:${emailColors.headerBg};padding:32px;text-align:left;">
      <h1 style="color:#ffffff;font-size:24px;margin:0 0 8px 0;font-weight:700;">
        ${eventoNombre}
      </h1>
      <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;">
        Comprobante de Boleto
      </p>
    </div>
    <div style="padding:32px;">
      <p style="font-size:18px;color:${emailColors.textPrimary};margin:0 0 24px 0;">
        Hola <strong>${registro.nombre}</strong>,
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};color:${emailColors.textSecondary};font-size:14px;width:40%;">
            ${isGrupo ? `Boletos (${grupoBoletos.length})` : 'Asientos'}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};font-size:14px;">
            ${isGrupo ? `<div style="font-size:13px;">${asientosHtml}</div>` : asientosHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};color:${emailColors.textSecondary};font-size:14px;">Status</td>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};font-size:14px;">
            <span style="color:${statusColor[overallStatus]};font-weight:600;">${statusLabel[overallStatus]}</span>
          </td>
        </tr>
        ${lastPago ? `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};color:${emailColors.textSecondary};font-size:14px;">Fecha de pago</td>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};font-size:14px;color:${emailColors.textPrimary};">
            ${new Date(lastPago.created_at).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
          </td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};color:${emailColors.textSecondary};font-size:14px;">Monto total recibido</td>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};font-size:14px;font-weight:600;color:${emailColors.textPrimary};">
            $${totalPagado.toLocaleString()} ${lastPago ? `— ${metodoPagoLabel[lastPago.metodo_pago] || 'Otro'}` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};color:${emailColors.textSecondary};font-size:14px;">Costo total</td>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};font-size:14px;font-weight:600;color:${emailColors.textPrimary};">
            $${totalBoletos.toLocaleString()}${isGrupo ? ` (${grupoBoletos.length} boletos)` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};color:${emailColors.textSecondary};font-size:14px;">Saldo faltante</td>
          <td style="padding:14px 0;border-bottom:1px solid ${emailColors.borderColor};font-size:14px;font-weight:600;color:${saldoFaltante > 0 ? '#c49a4a' : '#6b8f5e'};">
            $${saldoFaltante.toLocaleString()}
          </td>
        </tr>
        ${registro.nacion ? `
        <tr>
          <td style="padding:14px 0;color:${emailColors.textSecondary};font-size:14px;">Mentor</td>
          <td style="padding:14px 0;font-size:14px;color:${emailColors.textPrimary};">${(registro.nacion as any).nombre}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    <div style="background:${isLegacy ? '#f0ebe4' : '#f8f9fa'};padding:16px 32px;text-align:center;border-top:1px solid ${emailColors.borderColor};">
      <p style="color:${emailColors.textSecondary};font-size:12px;margin:0;">Este correo fue generado automáticamente. Por favor no respondas.</p>
    </div>
  </div>
</body>
</html>`;

    const subject = isGrupo
      ? `${eventoNombre} — Comprobante de ${grupoBoletos.length} boletos - ${registro.nombre}`
      : `${eventoNombre} — Comprobante de boleto - ${registro.nombre}`;

    const info = await transporter.sendMail({
      from: `"${eventoNombre}" <${process.env.GMAIL_USER || 'registrornmx@gmail.com'}>`,
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
