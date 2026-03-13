// Colores de las naciones que coinciden con la Imagen 1
export const NACION_COLORS: Record<string, string> = {
  'Apóstoles González': '#d4a574',
  'Nación Aguilar': '#c8a02c',
  'Nación de León': '#7bc67b',
  'Nación Cruz': '#e87461',
  'Nación Guerrero': '#ffd700',
  'Nación Dueñas': '#c8c8c8',
  'Nación Javi y Sari Hernández': '#2d2d2d',
  'Nación Espinosa': '#e84530',
  'Nación Sandy Corrientes': '#f0a030',
  'Nación Jessica Flores': '#8db600',
  'Nación Rebeca Lopez de Nava': '#d4a76a',
  'Nación Karla Romero': '#a0a0a0',
  'Nación Rocio Tello': '#6e6e6e',
  'Nación Agustín y Belen': '#7ec8e3',
  'RN Foranea': '#cc0000',
  'Iglesia Foranea': '#95c8e8',
  'TiendUp': '#e8145a',
  'Wenwen': '#50d050',
};

export const PRECIO_BOLETO_DEFAULT = 400;

export const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'transferencia', label: 'Transferencia', icon: '🏦' },
  { value: 'tarjeta', label: 'Tarjeta', icon: '💳' },
  { value: 'otro', label: 'Otro', icon: '📋' },
] as const;

// Seat layout matching Image 2
export const SEAT_LAYOUT = {
  // Top section: rows A-D
  topLeft: { rows: ['A', 'B', 'C', 'D'], cols: Array.from({ length: 10 }, (_, i) => i + 1) },
  topRight: { rows: ['A', 'B', 'C', 'D'], cols: Array.from({ length: 10 }, (_, i) => i + 11) },
  // Middle section: rows E-N
  midLeft: { rows: ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'], cols: Array.from({ length: 10 }, (_, i) => i + 1) },
  midRight: { rows: ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'], cols: Array.from({ length: 10 }, (_, i) => i + 11) },
  // Bottom section: rows O-S (only right side)
  bottom: { rows: ['O', 'P', 'Q', 'R', 'S'], cols: Array.from({ length: 10 }, (_, i) => i + 11) },
};
