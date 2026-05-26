import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });

    const supabase = createServerClient();
    const BUCKET = 'eventos';

    // Crear bucket si no existe
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET)) {
      const { error: bErr } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (bErr) throw bErr;
    }

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `flyers/${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
