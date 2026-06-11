import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { producto_id, talla, modelo, sku, cantidad } = await req.json();

  const { data: variante, error: ve } = await supabase
    .from('merch_variantes')
    .insert({ producto_id, talla, modelo, sku })
    .select()
    .single();

  if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });

  const { error: ie } = await supabase
    .from('merch_inventario')
    .insert({ variante_id: variante.id, cantidad: cantidad || 0 });

  if (ie) return NextResponse.json({ error: ie.message }, { status: 500 });
  return NextResponse.json(variante);
}

export async function PUT(req: NextRequest) {
  const supabase = createServerClient();
  const { variante_id, cantidad } = await req.json();

  const { data, error } = await supabase
    .from('merch_inventario')
    .upsert({ variante_id, cantidad, updated_at: new Date().toISOString() }, { onConflict: 'variante_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const { error } = await supabase
    .from('merch_variantes')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
