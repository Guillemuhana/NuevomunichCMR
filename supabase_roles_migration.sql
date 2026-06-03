-- ============================================================
-- MIGRACIÓN: Roles, Vendedores dinámicos e Historial de clientes
-- Nuevo Munich CRM — ejecutar en Supabase SQL Editor
-- ============================================================

-- ── 1. Tabla de vendedores (gestión dinámica desde el AdminPanel) ──
CREATE TABLE IF NOT EXISTS public.vendedores (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre    TEXT NOT NULL UNIQUE,
  email     TEXT,
  activo    BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar los vendedores existentes
INSERT INTO public.vendedores (nombre) VALUES
  ('Boris'), ('Cristian'), ('Luis'), ('Marcelino'), ('Pablo'), ('Sandra')
ON CONFLICT (nombre) DO NOTHING;

-- ── 2. Tabla de historial de acciones por cliente ──
CREATE TABLE IF NOT EXISTS public.historial_clientes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contacto_id UUID,   -- referencia a contactos.id (sin FK forzada para flexibilidad)
  vendedor    TEXT,
  accion      TEXT NOT NULL,  -- llamada | visita | seguimiento | nota | estado_cambio
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. RLS (Row Level Security) para vendedores ──
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer vendedores
CREATE POLICY "Leer vendedores" ON public.vendedores
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo admins pueden insertar/modificar (filtrar por email cristian@ en frontend)
CREATE POLICY "Escribir vendedores" ON public.vendedores
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ── 4. RLS para historial ──
ALTER TABLE public.historial_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leer historial" ON public.historial_clientes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insertar historial" ON public.historial_clientes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── 5. Verificación ──
SELECT 'vendedores' AS tabla, COUNT(*) AS registros FROM public.vendedores
UNION ALL
SELECT 'historial_clientes', COUNT(*) FROM public.historial_clientes;
