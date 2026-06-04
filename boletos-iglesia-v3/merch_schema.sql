-- ============================================================
-- MERCH MODULE — Ejecutar en Supabase SQL Editor
-- ============================================================

-- Productos
CREATE TABLE IF NOT EXISTS merch_productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  imagen_url TEXT,
  categoria TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Variantes por producto (modelo/color + talla)
CREATE TABLE IF NOT EXISTS merch_variantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES merch_productos(id) ON DELETE CASCADE,
  modelo TEXT,   -- ej: "Negro", "Blanco", "Azul"
  talla TEXT,    -- ej: "S", "M", "L", "XL", "Única"
  sku TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inventario (existencias por variante)
CREATE TABLE IF NOT EXISTS merch_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variante_id UUID NOT NULL REFERENCES merch_variantes(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(variante_id)
);

-- Ventas (encabezado)
CREATE TABLE IF NOT EXISTS merch_ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio INTEGER GENERATED ALWAYS AS IDENTITY,
  evento_id UUID REFERENCES eventos(id) ON DELETE SET NULL,
  servidor_id TEXT NOT NULL,
  servidor_nombre TEXT NOT NULL,
  cliente_nombre TEXT,
  cliente_correo TEXT,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detalle de venta (líneas)
CREATE TABLE IF NOT EXISTS merch_ventas_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES merch_ventas(id) ON DELETE CASCADE,
  variante_id UUID NOT NULL REFERENCES merch_variantes(id),
  producto_nombre TEXT NOT NULL,
  variante_descripcion TEXT,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pagos por venta
CREATE TABLE IF NOT EXISTS merch_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES merch_ventas(id) ON DELETE CASCADE,
  monto DECIMAL(10,2) NOT NULL,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  referencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROLES: Agrega los nuevos roles al CHECK constraint de usuarios
-- Descomentar la opción que aplique a tu tabla:
-- ============================================================

-- Opción A: si el rol es un TEXT con CHECK constraint
-- ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
-- ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
--   CHECK (rol IN ('admin', 'registro', 'dueno', 'evento', 'merch_admin', 'servidor_merch'));

-- Opción B: si el rol es un ENUM type llamado "rol_tipo" o similar
-- ALTER TYPE rol_tipo ADD VALUE IF NOT EXISTS 'merch_admin';
-- ALTER TYPE rol_tipo ADD VALUE IF NOT EXISTS 'servidor_merch';

-- ============================================================
-- Row Level Security (recomendado)
-- ============================================================
ALTER TABLE merch_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_ventas_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_pagos ENABLE ROW LEVEL SECURITY;

-- Acceso total para service_role (lo usan las API routes)
CREATE POLICY "service_role_merch_productos" ON merch_productos TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_merch_variantes" ON merch_variantes TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_merch_inventario" ON merch_inventario TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_merch_ventas" ON merch_ventas TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_merch_ventas_detalle" ON merch_ventas_detalle TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_merch_pagos" ON merch_pagos TO service_role USING (true) WITH CHECK (true);
