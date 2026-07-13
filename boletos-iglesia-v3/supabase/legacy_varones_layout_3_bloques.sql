-- ============================================================
-- Legacy Varones — NUEVO LAYOUT: 3 bloques lado a lado
-- ------------------------------------------------------------
--   Bloque IZQUIERDA : 6 columnas | CENTRO: 4 | DERECHA: 6  → 16 por fila
--   13 filas físicas → 208 asientos = 2 filas APARTADAS + 11 filas PÚBLICO.
--
--   APARTADOS (2 primeras filas físicas): serie propia RE-1 … RE-32,
--   estado 'reservado'. Son para conferencistas / invitados especiales:
--   no se venden online, solo el admin las asigna desde el panel. NO
--   consumen la numeración del público.
--     Fila 1: RE-1  RE-2 .. RE-6 | RE-7 .. RE-10 | RE-11 .. RE-16
--     Fila 2: RE-17 .. RE-22     | RE-23 .. RE-26| RE-27 .. RE-32
--
--   PÚBLICO (11 filas, 176 asientos): NUMERACIÓN CORRIDA que arranca limpia
--   en A1, de izquierda a derecha cruzando los 3 bloques y bajando por filas;
--   la LETRA cambia cada 20 asientos (A=1..20, …, hasta I). Esa etiqueta
--   (fila+columna) es el nombre OFICIAL del asiento en todo el sistema.
--     Fila 3: A1  A2  A3  A4  A5  A6 | A7  A8  A9  A10 | A11 A12 A13 A14 A15 A16
--     Fila 4: A17 A18 A19 A20 B1  B2 | B3  B4  B5  B6  | B7  B8  B9  B10 B11 B12
--     …
--     Fila 13: I1 .. I6           | I7 .. I10      | I11 .. I16
--
-- Ejecutar paso por paso en el SQL Editor de Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- PASO 1  ▸  GUARDA ESTE REPORTE antes de continuar.
-- Lista los asientos OCUPADOS actuales con su registro. El esquema de
-- columnas cambia por completo, así que estos registros NO se pueden
-- remapear automáticamente: tras regenerar el mapa tendrás que reasignarles
-- asiento manualmente desde el panel (RegistroDetail).
-- ------------------------------------------------------------
SELECT a.seccion, a.fila, a.columna,
       r.id AS registro_id, r.nombre, r.telefono, r.status
FROM asientos a
JOIN registros r ON r.id = a.registro_id
WHERE a.evento_id = (SELECT id FROM eventos WHERE slug = 'legacy-varones')
  AND a.registro_id IS NOT NULL
ORDER BY a.seccion, a.fila, a.columna;

-- ------------------------------------------------------------
-- PASO 2  ▸  Borrar TODOS los asientos actuales de legacy-varones.
-- Los registros NO se borran; solo se desvincula su asiento (queda sin lugar
-- asignado hasta que lo reasignes en el panel).
-- ------------------------------------------------------------
DELETE FROM asientos
WHERE evento_id = (SELECT id FROM eventos WHERE slug = 'legacy-varones');

-- ------------------------------------------------------------
-- PASO 3  ▸  Generar el nuevo layout.
-- (3a) APARTADOS: RE-1..RE-32, estado 'reservado', en las 2 primeras filas.
--      col en fila = i % 16  →  0-5 izq, 6-9 centro, 10-15 derecha.
-- (3b) PÚBLICO: A1..I16, estado 'disponible', 11 filas debajo.
--      letra = chr(65 + j/20), numero = j%20 + 1, col = j%16.
-- ------------------------------------------------------------
DO $$
DECLARE
  ev UUID;
  i INT;
  j INT;
  col_in_row INT;
  seccion_seat TEXT;
  fila_letra TEXT;
  num_seat INT;
BEGIN
  SELECT id INTO ev FROM eventos WHERE slug = 'legacy-varones';
  IF ev IS NULL THEN
    RAISE EXCEPTION 'No existe el evento con slug legacy-varones';
  END IF;

  -- (3a) Apartados: RE-1 .. RE-32
  FOR i IN 0..31 LOOP
    col_in_row := i % 16;
    seccion_seat := CASE
      WHEN col_in_row < 6  THEN 'izquierda'
      WHEN col_in_row < 10 THEN 'centro'
      ELSE 'derecha'
    END;
    INSERT INTO asientos (fila, columna, seccion, estado, evento_id)
    VALUES ('RE', i + 1, seccion_seat, 'reservado', ev);
  END LOOP;

  -- (3b) Público: A1 .. I16  (176 asientos)
  FOR j IN 0..175 LOOP
    fila_letra := chr(65 + (j / 20));   -- 65 = 'A'  →  A..I
    num_seat   := (j % 20) + 1;
    col_in_row := j % 16;
    seccion_seat := CASE
      WHEN col_in_row < 6  THEN 'izquierda'
      WHEN col_in_row < 10 THEN 'centro'
      ELSE 'derecha'
    END;
    INSERT INTO asientos (fila, columna, seccion, estado, evento_id)
    VALUES (fila_letra, num_seat, seccion_seat, 'disponible', ev);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- PASO 4  ▸  Verificación.
-- (a) Totales esperados: 208 asientos, 32 reservados (RE), 176 disponibles.
-- ------------------------------------------------------------
SELECT count(*)                                       AS total,
       count(*) FILTER (WHERE estado = 'reservado')   AS apartados_RE,
       count(*) FILTER (WHERE estado = 'disponible')  AS publico
FROM asientos
WHERE evento_id = (SELECT id FROM eventos WHERE slug = 'legacy-varones');

-- (b) Apartados: deben ser RE-1 .. RE-32, todos 'reservado'.
SELECT fila, columna, seccion, estado
FROM asientos
WHERE evento_id = (SELECT id FROM eventos WHERE slug = 'legacy-varones')
  AND fila = 'RE'
ORDER BY columna;
