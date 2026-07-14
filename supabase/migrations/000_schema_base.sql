-- +migrate up
-- Documenta el esquema base tal como existe hoy en el proyecto de Supabase
-- (las tablas ya fueron creadas manualmente desde el dashboard, nunca habían
-- quedado registradas en migraciones). Usa CREATE TABLE IF NOT EXISTS, por lo
-- que ejecutar este archivo contra la base actual no debería alterar nada
-- existente: es documentación, no una migración destructiva.
--
-- Columnas y tipos verificados contra el esquema real vía el endpoint
-- OpenAPI de PostgREST (GET /rest/v1/ con la service_role key), no inferidos
-- a ciegas del código de la app.

CREATE TABLE IF NOT EXISTS modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  prefijo_codigo text NOT NULL,
  imagen_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subcategorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid REFERENCES modulos(id),
  nombre text NOT NULL,
  prefijo_codigo varchar(4),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nombre text NOT NULL,
  modulo_id uuid REFERENCES modulos(id),
  subcategoria_id uuid REFERENCES subcategorias(id),
  precio numeric NOT NULL,
  precio_descuento numeric,
  stock integer DEFAULT 0,
  imagen_url text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nombre text NOT NULL,
  cliente_celular text NOT NULL,
  cliente_departamento text,
  cliente_provincia text,
  cliente_notas text,
  productos jsonb NOT NULL,
  estado text DEFAULT 'PENDIENTE',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_admin boolean DEFAULT true
);

-- Nota: las FK de arriba no tienen ON DELETE CASCADE a nivel de base de
-- datos. Hoy el borrado en cascada (ej. subcategorias al borrar un modulo)
-- lo hace la app manualmente en app/api/admin/modulos/route.ts. Esta
-- migracion documenta el comportamiento actual tal cual, sin cambiarlo.

-- +migrate down
-- No se incluye "down" porque estas tablas ya existian antes de esta
-- migracion (es documentacion retroactiva) — borrarlas aqui seria
-- destructivo para datos reales. Si en el futuro se necesita revertir,
-- hacerlo manualmente y con respaldo previo.
