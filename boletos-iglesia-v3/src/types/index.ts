export interface Nacion {
  id: string;
  nombre: string;
  color: string;
  created_at: string;
}

export interface Registro {
  id: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  nacion_id: string | null;
  status: 'pendiente' | 'abono' | 'liquidado';
  monto_total: number;
  monto_pagado: number;
  precio_boleto: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  nacion?: Nacion;
  asientos?: Asiento[];
  pagos?: Pago[];
}

export interface Asiento {
  id: string;
  fila: string;
  columna: number;
  seccion: 'izquierda' | 'derecha' | 'centro';
  estado: 'disponible' | 'ocupado' | 'no_disponible' | 'reservado';
  registro_id: string | null;
  created_at: string;
}

export interface Pago {
  id: string;
  registro_id: string;
  monto: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';
  referencia: string | null;
  notas: string | null;
  created_at: string;
}

export type MetodoPago = Pago['metodo_pago'];

export interface RegistroFormData {
  nombre: string;
  telefono: string;
  correo: string;
  nacion_id: string;
  asientos_ids: string[];
  monto_pago: number;
  metodo_pago: MetodoPago;
  precio_boleto: number;
}
