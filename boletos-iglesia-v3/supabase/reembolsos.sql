-- Reembolsos de boletos.
-- El dinero se devuelve fuera del sistema (efectivo o tarjeta); aquí solo se
-- registra el reembolso para restarlo de lo recaudado. No se borra ninguna
-- fila, se marca, para conservar el historial/auditoría.

-- 1) Reembolso de un pago individual (el boleto sigue activo)
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS reembolsado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS monto_reembolsado NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS reembolsado_at TIMESTAMPTZ;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS motivo_reembolso TEXT;

-- 2) Reembolso del boleto completo (cancelación) — nuevo estado en registros.
-- Antes de correr esto, revisa el nombre real del constraint con:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'registros'::regclass AND contype = 'c';
-- Si el nombre no es 'registros_status_check', ajusta el DROP CONSTRAINT abajo.
ALTER TABLE registros DROP CONSTRAINT IF EXISTS registros_status_check;
ALTER TABLE registros ADD CONSTRAINT registros_status_check
  CHECK (status IN ('pendiente', 'abono', 'liquidado', 'reembolsado'));
