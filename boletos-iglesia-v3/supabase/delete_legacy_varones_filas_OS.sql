-- ============================================
-- Legacy Varones — eliminar filas O, P, Q, R, S
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================

-- 1. (Opcional) Revisa primero si alguna de esas filas tiene asientos OCUPADOS.
--    Si esta consulta devuelve filas, esos asientos NO se borrarán en el paso 2.
SELECT fila, columna, registro_id
FROM asientos
WHERE evento_id = (SELECT id FROM eventos WHERE slug = 'legacy-varones')
  AND fila IN ('O', 'P', 'Q', 'R', 'S')
  AND registro_id IS NOT NULL
ORDER BY fila, columna;

-- 2. Borra las filas O–S (solo asientos libres, para no perder registros asignados).
DELETE FROM asientos
WHERE evento_id = (SELECT id FROM eventos WHERE slug = 'legacy-varones')
  AND fila IN ('O', 'P', 'Q', 'R', 'S')
  AND registro_id IS NULL;
