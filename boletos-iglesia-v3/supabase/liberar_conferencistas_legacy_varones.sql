-- ============================================================
-- Legacy Varones — dejar TODOS los asientos DISPONIBLES (todo blanco)
-- Libera los apartados (estado 'reservado', los amber) sin borrar nada.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- PASO 1 ▸ Ver el estado actual de todos los asientos del evento.
SELECT estado,
       count(*)            AS cantidad,
       count(registro_id)  AS asignados
FROM asientos
WHERE evento_id = (SELECT id FROM eventos WHERE slug = 'legacy-varones')
GROUP BY estado
ORDER BY estado;

-- PASO 2 ▸ Liberar todo lo que NO esté disponible y NO tenga a nadie
-- asignado (reservado, no_disponible, etc. → disponible). Seguro: no le
-- quita el lugar a nadie con registro.
UPDATE asientos
SET estado = 'disponible'
WHERE evento_id = (SELECT id FROM eventos WHERE slug = 'legacy-varones')
  AND estado <> 'disponible'
  AND registro_id IS NULL;

-- PASO 3 (OPCIONAL) ▸ Solo si quieres TODO blanco incluso quitando
-- asientos que tengan a alguien asignado (ocupados). Descomenta:
-- UPDATE asientos
-- SET estado = 'disponible', registro_id = NULL
-- WHERE evento_id = (SELECT id FROM eventos WHERE slug = 'legacy-varones');

-- PASO 4 ▸ Verificación: deberían quedar todos en 'disponible'.
SELECT estado, count(*) AS cantidad
FROM asientos
WHERE evento_id = (SELECT id FROM eventos WHERE slug = 'legacy-varones')
GROUP BY estado
ORDER BY estado;
