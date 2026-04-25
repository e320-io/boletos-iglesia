import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const evento_id = searchParams.get('evento_id');

    if (!evento_id) {
      return NextResponse.json({ error: 'evento_id requerido' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('gastos_evento')
      .select('*')
      .eq('evento_id', evento_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ gastos: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { evento_id, concepto, monto, metodo_pago, fecha, notas } = body;

    if (!evento_id || !concepto || !monto || monto <= 0 || !metodo_pago) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('gastos_evento')
      .insert({ evento_id, concepto, monto, metodo_pago, fecha: fecha || null, notas: notas || null })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ gasto: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase.from('gastos_evento').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
