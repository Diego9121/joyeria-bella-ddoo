-- +migrate up
-- Evita que dos productos terminen con el mismo código (ej. por dos
-- inserciones casi simultáneas generando el mismo código sugerido).
-- Sin esta restricción, el reintento agregado en
-- app/api/admin/productos/route.ts (POST) nunca se activa porque el
-- INSERT duplicado no falla, simplemente crea una fila con codigo repetido.
--
-- IMPORTANTE: no aplicar esta migración sin antes verificar que no existan
-- códigos duplicados en la tabla `productos` (según el contexto de este
-- cambio, ya se corrigieron manualmente). Verificar con:
--   SELECT codigo, COUNT(*) FROM productos GROUP BY codigo HAVING COUNT(*) > 1;
ALTER TABLE productos ADD CONSTRAINT productos_codigo_key UNIQUE (codigo);

-- +migrate down
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_codigo_key;
