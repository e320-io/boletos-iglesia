-- Campo "Rol" (instrumento) para Encuentro de Adoradores.
-- Se activa por evento (usa_rol_instrumento) en vez de por slug para evitar
-- que otros eventos con "encuentro" en el slug lo hereden por error, como ya
-- pasó con usa_areas_servicio (ver area_servicio_campamento.sql).

ALTER TABLE registros ADD COLUMN IF NOT EXISTS rol TEXT;

ALTER TABLE eventos ADD COLUMN IF NOT EXISTS usa_rol_instrumento BOOLEAN NOT NULL DEFAULT false;

UPDATE eventos SET usa_rol_instrumento = true WHERE slug = 'encuentro-adoradores';
