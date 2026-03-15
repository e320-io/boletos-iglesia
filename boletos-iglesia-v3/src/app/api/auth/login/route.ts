import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Call verify_login function
    const { data, error } = await supabase.rpc('verify_login', {
      p_username: username.toLowerCase().trim(),
      p_password: password,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const user = data[0];

    // Update last login
    await supabase.from('usuarios').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    // Create a simple session token (in production, use JWT)
    const sessionToken = Buffer.from(JSON.stringify({
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      rol: user.rol,
      exp: Date.now() + (24 * 60 * 60 * 1000), // 24h
    })).toString('base64');

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol },
    });

    // Set session cookie
    response.cookies.set('session', sessionToken, {
      httpOnly: false, // Need JS access for client-side role checks
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24h
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Error de autenticación' }, { status: 500 });
  }
}
