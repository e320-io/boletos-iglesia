import { supabase } from '@/lib/supabase';

export type ActionType =
  | 'registro_creado'
  | 'registro_editado'
  | 'registro_eliminado'
  | 'pago_registrado'
  | 'pago_grupo_liquidado'
  | 'asiento_asignado'
  | 'checkin_dia1'
  | 'checkin_dia2'
  | 'usuario_creado'
  | 'usuario_editado'
  | 'login';

const ACTION_LABELS: Record<ActionType, string> = {
  registro_creado: 'Registro creado',
  registro_editado: 'Registro editado',
  registro_eliminado: 'Registro eliminado',
  pago_registrado: 'Pago registrado',
  pago_grupo_liquidado: 'Grupo liquidado',
  asiento_asignado: 'Asiento asignado',
  checkin_dia1: 'Check-in Día 1',
  checkin_dia2: 'Check-in Día 2',
  usuario_creado: 'Usuario creado',
  usuario_editado: 'Usuario editado',
  login: 'Inicio de sesión',
};

export async function logActivity(params: {
  userId: string;
  userName: string;
  action: ActionType;
  detail?: string;
  eventoId?: string;
  registroId?: string;
}) {
  try {
    await supabase.from('activity_log').insert({
      usuario_id: params.userId,
      usuario_nombre: params.userName,
      accion: params.action,
      detalle: params.detail || null,
      evento_id: params.eventoId || null,
      registro_id: params.registroId || null,
    });
  } catch (e) {
    console.error('Error logging activity:', e);
  }
}

export { ACTION_LABELS };
