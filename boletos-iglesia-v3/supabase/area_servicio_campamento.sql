-- ============================================================
-- Área de Servicio — registro de servidores en eventos de campamento
-- ------------------------------------------------------------
-- Permite registrar "servidores" (staff del campamento) sin asignarles
-- un escuadrón (equipos_evento), sino un área de servicio propia
-- (cocina, logística, alabanza, etc.), configurable por evento.
--
-- Ejecutar paso por paso en el SQL Editor de Supabase.
-- ============================================================

-- 1. Tabla de áreas de servicio, análoga a equipos_evento
CREATE TABLE IF NOT EXISTS areas_servicio_evento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#808080',
  responsable TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_areas_servicio_evento ON areas_servicio_evento(evento_id);

-- 2. Columna en registros para vincular al servidor con su área
ALTER TABLE registros ADD COLUMN IF NOT EXISTS area_servicio_id UUID REFERENCES areas_servicio_evento(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_registros_area_servicio ON registros(area_servicio_id);

-- 3. Flag por evento para mostrar la administración de áreas en EventManager
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS usa_areas_servicio BOOLEAN NOT NULL DEFAULT false;

-- 4. RLS — mismas políticas permisivas que el resto de tablas del sistema
ALTER TABLE areas_servicio_evento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for areas_servicio_evento" ON areas_servicio_evento FOR ALL USING (true) WITH CHECK (true);

-- 5. Habilitar la función en Campamento de Jóvenes
UPDATE eventos SET usa_areas_servicio = true WHERE slug = 'campamento-jovenes';

-- ------------------------------------------------------------
-- OPCIONAL — limpieza de datos legacy.
-- Los 105 registros existentes de campamento-jovenes tienen
-- tipo = 'Encuentrista' por un residuo del formulario (el selector de
-- Tipo nunca se mostraba para este evento, pero el estado por defecto sí
-- se guardaba). Si quieres limpiarlo para que no aparezcan con esa
-- etiqueta, descomenta y corre esto:
-- ------------------------------------------------------------
-- UPDATE registros SET tipo = NULL
-- WHERE evento_id = (SELECT id FROM eventos WHERE slug = 'campamento-jovenes')
--   AND tipo = 'Encuentrista';
