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
  whatsapp: string | null;
  edad: number | null;
  nacion_id: string | null;
  equipo_id: string | null;
  area_servicio_id: string | null;
  status: 'pendiente' | 'abono' | 'liquidado' | 'reembolsado';
  monto_total: number;
  monto_pagado: number;
  precio_boleto: number;
  notas: string | null;
  evento_id: string | null;
  tipo: string | null;
  rol: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  checked_in_2: boolean;
  checked_in_2_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  nacion?: Nacion;
  equipo?: EquipoEvento;
  area_servicio?: AreaServicioEvento;
  asientos?: Asiento[];
  pagos?: Pago[];
}

export interface EquipoEvento {
  id: string;
  evento_id: string;
  nombre: string;
  color: string;
  genero?: string | null;
  lider?: string | null;
  consejero?: string | null;
}

export interface AreaServicioEvento {
  id: string;
  evento_id: string;
  nombre: string;
  color: string;
  responsable?: string | null;
}

export interface Asiento {
  id: string;
  fila: string;
  columna: number;
  seccion: 'izquierda' | 'derecha' | 'centro' | 'conferencistas';
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
  reembolsado: boolean;
  monto_reembolsado: number;
  reembolsado_at: string | null;
  motivo_reembolso: string | null;
}

export type MetodoPago = Pago['metodo_pago'];

export interface MerchProducto {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagen_url: string | null;
  categoria: string | null;
  activo: boolean;
  created_at: string;
  variantes?: MerchVariante[];
}

export interface MerchVariante {
  id: string;
  producto_id: string;
  modelo: string | null;
  talla: string | null;
  sku: string | null;
  created_at: string;
  inventario?: { cantidad: number }[];
  stock?: number;
}

export interface MerchVenta {
  id: string;
  folio: number;
  evento_id: string | null;
  servidor_id: string;
  servidor_nombre: string;
  cliente_nombre: string | null;
  cliente_correo: string | null;
  total: number;
  estado: 'pagado' | 'abonado';
  created_at: string;
  detalle?: MerchVentaDetalle[];
  pagos?: MerchPagoVenta[];
}

export interface MerchVentaDetalle {
  id: string;
  venta_id: string;
  variante_id: string;
  producto_nombre: string;
  variante_descripcion: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface MerchPagoVenta {
  id: string;
  venta_id: string;
  monto: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';
  referencia: string | null;
}

export interface GastoEvento {
  id: string;
  evento_id: string;
  concepto: string;
  monto: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';
  fecha: string | null;
  notas: string | null;
  created_at: string;
}

export interface IngresoEvento {
  id: string;
  evento_id: string;
  concepto: string;
  monto: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';
  fecha: string | null;
  notas: string | null;
  created_at: string;
}

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
