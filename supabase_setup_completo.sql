-- ============================================================
-- SETUP COMPLETO — Nuevo Munich CRM
-- Pegá esto en Supabase → SQL Editor → RUN
-- ============================================================

-- ── 1. Crear tabla de vendedores ──
CREATE TABLE IF NOT EXISTS public.vendedores (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     TEXT NOT NULL UNIQUE,
  email      TEXT,
  activo     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.vendedores (nombre, email) VALUES
  ('Cristian', 'cristian@nuevomunich.com.ar'),
  ('Boris',    'boris@nuevomunich.com.ar'),
  ('Luis',     'luis@nuevomunich.com.ar'),
  ('Marcelino','marcelino@nuevomunich.com.ar'),
  ('Pablo',    'pablo@nuevomunich.com.ar'),
  ('Sandra',   'sandra@nuevomunich.com.ar')
ON CONFLICT (nombre) DO NOTHING;

-- ── 2. Crear tabla de historial de clientes ──
CREATE TABLE IF NOT EXISTS public.historial_clientes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contacto_id UUID,
  vendedor    TEXT,
  accion      TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Confirmar emails + setear contraseña Munich2025! ──
UPDATE auth.users
SET
  encrypted_password  = crypt('Munich2025!', gen_salt('bf')),
  email_confirmed_at  = COALESCE(email_confirmed_at, NOW()),
  updated_at          = NOW()
WHERE email IN (
  'cristian@nuevomunich.com.ar',
  'boris@nuevomunich.com.ar',
  'luis@nuevomunich.com.ar',
  'marcelino@nuevomunich.com.ar',
  'pablo@nuevomunich.com.ar',
  'sandra@nuevomunich.com.ar'
);

-- ── 4. Verificación final ──
SELECT email, email_confirmed_at IS NOT NULL AS confirmado
FROM auth.users
WHERE email LIKE '%nuevomunich%'
ORDER BY email;
