import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { username, evento_ids } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'username requerido' }, { status: 400 });
    }

    // Verify the caller is an admin via session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());
    if (session.rol !== 'admin' || session.exp < Date.now()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Use service role key — bypasses RLS and updates only the target user
    const supabase = createServerClient();
    const { error } = await supabase
      .from('usuarios')
      .update({ evento_ids: evento_ids?.length > 0 ? evento_ids : null })
      .eq('username', username);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
