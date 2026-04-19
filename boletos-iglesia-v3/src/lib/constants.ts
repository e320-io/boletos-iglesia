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
  { value: 'stripe', label: 'Stripe', icon: '🔵' },
  { value: 'otro', label: 'Otro', icon: '📋' },
] as const;

// Seat layout matching Image 2
export const SEAT_LAYOUT = {
  // Top section: rows A-D
  topLeft: { rows: ['A', 'B', 'C', 'D'], cols: Array.from({ length: 10 }, (_, i) => i + 1) },
  topRight: { rows: ['A', 'B', 'C', 'D'], cols: Array.from({ length: 10 }, (_, i) => i + 11) },
  // Middle section: rows E-T (extended with O-T)
  midLeft: { rows: ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'], cols: Array.from({ length: 10 }, (_, i) => i + 1) },
  midRight: { rows: ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'], cols: Array.from({ length: 10 }, (_, i) => i + 11) },
  // Bottom center block: rows U-Z, separate physical section at the back
  bottom: { rows: ['U', 'V', 'W', 'X', 'Y', 'Z'], cols: Array.from({ length: 10 }, (_, i) => i + 11) },
};

// Conferencistas zone: RE-1 to RE-40, 2 rows × 20 seats (10 left + 10 right), admin-only
export const CONF_SEATS_TOTAL = 40;
export const CONF_SEAT_ROWS: { left: number[]; right: number[] }[] = [
  { left: [1,2,3,4,5,6,7,8,9,10],   right: [11,12,13,14,15,16,17,18,19,20]  },
  { left: [21,22,23,24,25,26,27,28,29,30], right: [31,32,33,34,35,36,37,38,39,40] },
];
