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
    const { registroId, grupoIds, isCortesia } = body;
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
    let eventoFecha = '';
    let eventoDescripcion = '';
    if (registro.evento_id) {
      const { data: evento } = await supabase.from('eventos').select('slug, nombre, fecha, descripcion').eq('id', registro.evento_id).single();
      if (evento) {
        eventoSlug = evento.slug;
        eventoNombre = evento.nombre;
        eventoFecha = evento.fecha || '';
        eventoDescripcion = evento.descripcion || '';
      }
    }

    // Cortesía ticket — physical ticket design (table-based for email client compatibility)
    if (isCortesia) {
      const seat = (registro.asientos || [])[0];
      const seatNum = seat ? (seat.fila === 'RE' ? `RE-${seat.columna}` : `${seat.fila}${seat.columna}`) : '—';

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://boletos-iglesia-seven.vercel.app';
      const logoUrl = `${baseUrl}/logo-rn.png`;

      // Format date for display — event runs 2 days (start + 1)
      let fechaLabel = '';
      let diaLabel = '';
      let mesLabel = '';
      if (eventoFecha) {
        const d = new Date(eventoFecha + 'T12:00:00');
        const d2 = new Date(d.getTime() + 86400000);
        const dia1 = d.getDate();
        const dia2 = d2.getDate();
        const mes = d.toLocaleDateString('es-MX', { month: 'long' });
        const year = d.getFullYear();
        fechaLabel = `${dia1} y ${dia2} de ${mes} de ${year}`;
        diaLabel = `${dia1}&amp;${dia2}`;
        mesLabel = mes.toUpperCase();
      }

      const ticketHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width:480px) {
      .ticket { width:100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:20px 0;background:#f2ede6;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2ede6">
  <tr><td align="center" style="padding:20px 16px;">

    <!-- Ticket card — max 480px, no fixed pixel width so it shrinks on mobile -->
    <table class="ticket" cellpadding="0" cellspacing="0" border="0"
      style="width:480px;max-width:100%;background:#faf7f2;border:1px solid #ddd6c8;border-radius:14px;overflow:hidden;">

      <!-- Header -->
      <tr>
        <td bgcolor="#2e2218" style="padding:20px 24px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
            <tr>
              <td style="vertical-align:middle;padding-right:12px;">
                <p style="margin:0;color:#e8dfc8;font-size:18px;font-weight:700;letter-spacing:2px;font-family:Georgia,serif;text-transform:uppercase;">${eventoNombre}</p>
                <p style="margin:4px 0 0;color:#9a8a6a;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;">Congreso de Mujeres &middot; Zona Especial</p>
              </td>
              <td width="64" style="vertical-align:middle;text-align:right;">
                <img src="${logoUrl}" width="56" height="56" alt="RN México" style="display:block;margin-left:auto;" />
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td bgcolor="#faf7f2" style="padding:22px 24px 16px;">

          <!-- Event title -->
          <p style="margin:0 0 4px;font-size:26px;font-style:italic;font-weight:700;color:#1a1510;font-family:Georgia,serif;">${eventoNombre}</p>
          <p style="margin:0 0 16px;font-size:9px;color:#8a6f4a;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">${eventoNombre.toUpperCase()} 2026 &middot; CUPO LIMITADO</p>

          <!-- Quote -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
            <tr>
              <td width="3" bgcolor="#c9a55a" style="font-size:0;line-height:0;">&nbsp;</td>
              <td bgcolor="#f5efe4" style="padding:10px 14px;border-radius:0 6px 6px 0;">
                <p style="margin:0;font-size:12px;color:#6b5030;font-style:italic;line-height:1.6;font-family:Georgia,serif;">&ldquo;Nos honra poder contar con su presencia en ${eventoNombre} 2026.&rdquo;</p>
              </td>
            </tr>
          </table>

          <!-- Name box -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
            <tr>
              <td bgcolor="#f0e8d8" style="padding:12px 16px;border-radius:8px;">
                <p style="margin:0 0 3px;font-size:9px;color:#9a8a6a;text-transform:uppercase;letter-spacing:1.5px;font-family:Arial,sans-serif;">&#9679; &nbsp;Nombre del titular</p>
                <p style="margin:0;font-size:16px;font-weight:700;color:#1a1510;font-family:Georgia,serif;">${registro.nombre}</p>
              </td>
            </tr>
          </table>

          <!-- Info grid -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
            <tr>
              <td width="50%" style="padding:0 12px 12px 0;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:9px;color:#9a8a6a;text-transform:uppercase;letter-spacing:1.5px;font-family:Arial,sans-serif;">Fecha</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#1a1510;font-family:Arial,sans-serif;">${fechaLabel || 'Por confirmar'}</p>
              </td>
              <td width="50%" style="padding:0 0 12px 12px;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:9px;color:#9a8a6a;text-transform:uppercase;letter-spacing:1.5px;font-family:Arial,sans-serif;">Sede</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#1a1510;font-family:Arial,sans-serif;">Auditorio RN M&eacute;xico</p>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding:0 12px 4px 0;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:9px;color:#9a8a6a;text-transform:uppercase;letter-spacing:1.5px;font-family:Arial,sans-serif;">Acceso</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#1a1510;font-family:Arial,sans-serif;">Pase VIP</p>
              </td>
              <td width="50%" style="padding:0 0 4px 12px;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:9px;color:#9a8a6a;text-transform:uppercase;letter-spacing:1.5px;font-family:Arial,sans-serif;">Zona</p>
                <p style="margin:0;font-size:13px;font-weight:600;color:#1a1510;font-family:Arial,sans-serif;">Especial &middot; Conferencistas</p>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- Dashed divider row -->
      <tr>
        <td bgcolor="#faf7f2" style="padding:0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-top:1.5px dashed #ddd6c8;font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>
        </td>
      </tr>

      <!-- Footer / Seat -->
      <tr>
        <td bgcolor="#faf7f2" style="padding:16px 24px 22px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
            <tr>
              <td style="vertical-align:bottom;">
                <p style="margin:0 0 6px;font-size:9px;color:#9a8a6a;text-transform:uppercase;letter-spacing:1.5px;font-family:Arial,sans-serif;">Asiento reservado</p>
                <p style="margin:0;font-size:32px;font-style:italic;font-weight:700;color:#1a1510;font-family:Georgia,serif;line-height:1;">${seatNum}</p>
                <p style="margin:4px 0 0;font-size:9px;color:#8a6f4a;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">Secci&oacute;n Conferencistas</p>
              </td>
              ${diaLabel ? `<td width="80" style="vertical-align:bottom;text-align:right;">
                <p style="margin:0;font-size:32px;font-style:italic;font-weight:700;color:#1a1510;font-family:Georgia,serif;line-height:1;">${diaLabel}</p>
                <p style="margin:4px 0 0;font-size:9px;color:#8a6f4a;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">${mesLabel}</p>
              </td>` : ''}
            </tr>
          </table>
        </td>
      </tr>

    </table>

    <p style="font-size:11px;color:#9a8a6a;margin-top:14px;font-family:Arial,sans-serif;text-align:center;">Este correo fue generado autom&aacute;ticamente. Por favor no respondas.</p>

  </td></tr>
</table>
</body>
</html>`;

      const info = await transporter.sendMail({
        from: `"${eventoNombre}" <${process.env.GMAIL_USER || 'registrornmx@gmail.com'}>`,
        to: registro.correo,
        subject: `${eventoNombre} — Tu lugar confirmado: ${seatNum}`,
        html: ticketHtml,
      });
      return NextResponse.json({ status: 'ok', messageId: info.messageId });
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
    const getSeatLabel = (a: any) => { if (!a.fila || a.columna == null) return a.id; if (a.fila === 'RE') return `RE-${a.columna}`; return `${a.fila}${a.columna}`; };

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
