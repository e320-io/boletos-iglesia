-- Ingresos adicionales por evento (ofrendas, venta de merch, etc.)
-- Independiente de los pagos de boletos (tabla `pagos`).
CREATE TABLE IF NOT EXISTS ingresos_evento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID NOT NULL,
  concepto TEXT NOT NULL,
  monto NUMERIC(10,2) NOT NULL,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  fecha DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingresos_evento ON ingresos_evento(evento_id);
