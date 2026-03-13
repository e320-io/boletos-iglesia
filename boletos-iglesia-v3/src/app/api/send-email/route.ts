import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { registroId } = await request.json();
    const supabase = createServerClient();

    // Fetch complete registro data
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

    const statusLabel: Record<string, string> = {
      pendiente: 'Pendiente',
      abono: 'Abono',
      liquidado: 'Liquidado',
    };

    const statusColor: Record<string, string> = {
      pendiente: '#ef4444',
      abono: '#f59e0b',
      liquidado: '#10b981',
    };

    const saldo = Number(registro.monto_total) - Number(registro.monto_pagado);
    const asientosStr = (registro.asientos || []).map((a: any) => a.id).sort().join(', ');
    const lastPago = registro.pagos?.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    const metodoPagoLabel: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      tarjeta: 'Tarjeta',
      otro: 'Otro',
    };

    const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || 'Evento Iglesia 2026';

    // Build HTML email (styled like Image 3)
    const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f,#0a1628);padding:32px;text-align:left;">
      <h1 style="color:#ffffff;font-size:24px;margin:0 0 8px 0;font-weight:700;">
        Comprobante de Boleto
      </h1>
      <p style="color:#94a3b8;font-size:14px;margin:0;">
        Gracias por tu registro. Aquí están los detalles.
      </p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="font-size:18px;color:#333;margin:0 0 24px 0;">
        Hola <strong>${registro.nombre}</strong>,
      </p>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;width:40%;">Asientos</td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-size:14px;">
            ${(registro.asientos || []).map((a: any) => 
              `<span style="display:inline-block;background:#00bcd4;color:#fff;padding:4px 12px;border-radius:20px;font-weight:700;font-size:13px;margin:2px 4px 2px 0;">${a.id}</span>`
            ).join('')}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;">Status</td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-size:14px;">
            <span style="color:${statusColor[registro.status]};font-weight:600;">
              ${statusLabel[registro.status]}
            </span>
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
            $${Number(registro.monto_pagado).toLocaleString()} ${lastPago ? `— ${metodoPagoLabel[lastPago.metodo_pago] || 'Otro'}` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;">Saldo total</td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-size:14px;font-weight:600;">
            $${Number(registro.monto_total).toLocaleString()}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;color:#666;font-size:14px;">Saldo faltante</td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;font-size:14px;font-weight:600;color:${saldo > 0 ? '#f59e0b' : '#10b981'};">
            $${saldo.toLocaleString()}
          </td>
        </tr>
        ${registro.nacion ? `
        <tr>
          <td style="padding:14px 0;color:#666;font-size:14px;">Mentor</td>
          <td style="padding:14px 0;font-size:14px;">
            ${(registro.nacion as any).nombre}
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:16px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">
        Este correo fue generado automáticamente. Por favor no respondas.
      </p>
    </div>
  </div>
</body>
</html>`;

    // Send via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${eventName} <onboarding@resend.dev>`,
      to: [registro.correo],
      subject: `Comprobante de boleto - ${registro.nombre}`,
      html: htmlEmail,
    });

    if (emailError) throw emailError;

    return NextResponse.json({ status: 'ok', emailId: emailData?.id });
  } catch (error: any) {
    console.error('Email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
