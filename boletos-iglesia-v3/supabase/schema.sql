-- ============================================
-- SISTEMA DE BOLETOS - ESQUEMA DE BASE DE DATOS
-- Ejecutar este SQL en el SQL Editor de Supabase
-- ============================================

-- 1. TABLA: Naciones (grupos/equipos)
CREATE TABLE IF NOT EXISTS naciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#808080',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA: Registros (personas que compran boletos)
CREATE TABLE IF NOT EXISTS registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT,
  correo TEXT,
  nacion_id UUID REFERENCES naciones(id),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'abono', 'liquidado')),
  monto_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  monto_pagado NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_boleto NUMERIC(10,2) NOT NULL DEFAULT 400,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLA: Asientos
CREATE TABLE IF NOT EXISTS asientos (
  id TEXT PRIMARY KEY, -- Ej: 'A1', 'B5', 'C10'
  fila TEXT NOT NULL,
  columna INTEGER NOT NULL,
  seccion TEXT NOT NULL DEFAULT 'general', -- 'izquierda', 'derecha', 'centro'
  estado TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible', 'ocupado', 'no_disponible', 'reservado')),
  registro_id UUID REFERENCES registros(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA: Pagos (historial de abonos)
CREATE TABLE IF NOT EXISTS pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  registro_id UUID NOT NULL REFERENCES registros(id) ON DELETE CASCADE,
  monto NUMERIC(10,2) NOT NULL,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  referencia TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ÍNDICES
CREATE INDEX idx_registros_nacion ON registros(nacion_id);
CREATE INDEX idx_registros_status ON registros(status);
CREATE INDEX idx_asientos_estado ON asientos(estado);
CREATE INDEX idx_asientos_registro ON asientos(registro_id);
CREATE INDEX idx_pagos_registro ON pagos(registro_id);

-- 6. FUNCIÓN: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_registros_updated
  BEFORE UPDATE ON registros
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. INSERTAR NACIONES (de tu imagen)
INSERT INTO naciones (nombre, color) VALUES
  ('Apóstoles González', '#e0a060'),
  ('Nación Aguilar', '#d4a017'),
  ('Nación de León', '#90ee90'),
  ('Nación Cruz', '#ff8c69'),
  ('Nación Guerrero', '#ffd700'),
  ('Nación Dueñas', '#d3d3d3'),
  ('Nación Javi y Sari Hernández', '#333333'),
  ('Nación Espinosa', '#ff6347'),
  ('Nación Sandy Corrientes', '#ffa500'),
  ('Nación Jessica Flores', '#9acd32'),
  ('Nación Rebeca Lopez de Nava', '#deb887'),
  ('Nación Karla Romero', '#c0c0c0'),
  ('Nación Rocio Tello', '#808080'),
  ('Nación Agustín y Belen', '#87ceeb'),
  ('RN Foranea', '#ff0000'),
  ('Iglesia Foranea', '#add8e6'),
  ('TiendUp', '#ff1493'),
  ('Wenwen', '#7fff00')
ON CONFLICT (nombre) DO NOTHING;

-- 8. GENERAR ASIENTOS
-- Sección izquierda: Filas A-D, Columnas 1-10
DO $$
DECLARE
  fila_letra TEXT;
  col INT;
BEGIN
  FOREACH fila_letra IN ARRAY ARRAY['A','B','C','D'] LOOP
    FOR col IN 1..10 LOOP
      INSERT INTO asientos (id, fila, columna, seccion, estado)
      VALUES (fila_letra || col, fila_letra, col, 'izquierda', 'disponible')
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Sección derecha: Filas A-D, Columnas 11-20
DO $$
DECLARE
  fila_letra TEXT;
  col INT;
BEGIN
  FOREACH fila_letra IN ARRAY ARRAY['A','B','C','D'] LOOP
    FOR col IN 11..20 LOOP
      INSERT INTO asientos (id, fila, columna, seccion, estado)
      VALUES (fila_letra || col, fila_letra, col, 'derecha', 'disponible')
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Sección izquierda: Filas E-N, Columnas 1-10
DO $$
DECLARE
  fila_letra TEXT;
  col INT;
BEGIN
  FOREACH fila_letra IN ARRAY ARRAY['E','F','G','H','I','J','K','L','M','N'] LOOP
    FOR col IN 1..10 LOOP
      INSERT INTO asientos (id, fila, columna, seccion, estado)
      VALUES (fila_letra || col, fila_letra, col, 'izquierda', 'disponible')
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Sección derecha: Filas E-N, Columnas 11-20
DO $$
DECLARE
  fila_letra TEXT;
  col INT;
BEGIN
  FOREACH fila_letra IN ARRAY ARRAY['E','F','G','H','I','J','K','L','M','N'] LOOP
    FOR col IN 11..20 LOOP
      INSERT INTO asientos (id, fila, columna, seccion, estado)
      VALUES (fila_letra || col, fila_letra, col, 'derecha', 'disponible')
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Sección centro inferior: Filas O-S, Columnas 11-20
DO $$
DECLARE
  fila_letra TEXT;
  col INT;
BEGIN
  FOREACH fila_letra IN ARRAY ARRAY['O','P','Q','R','S'] LOOP
    FOR col IN 11..20 LOOP
      INSERT INTO asientos (id, fila, columna, seccion, estado)
      VALUES (fila_letra || col, fila_letra, col, 'centro', 'disponible')
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Marcar asientos no disponibles según tu imagen (los rojos)
-- E19, E20 no existen en el layout normal, los marco como no_disponible
UPDATE asientos SET estado = 'no_disponible' WHERE id IN ('C20', 'D20', 'L20');

-- 9. HABILITAR ROW LEVEL SECURITY (opcional pero recomendado)
ALTER TABLE naciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE asientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para uso interno (ajustar según necesidad)
CREATE POLICY "Allow all for naciones" ON naciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for registros" ON registros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for asientos" ON asientos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pagos" ON pagos FOR ALL USING (true) WITH CHECK (true);
