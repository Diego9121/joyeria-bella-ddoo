import { supabase, Modulo, Subcategoria } from './supabase';

/**
 * Caché en memoria para módulos y subcategorías (datos que casi nunca
 * cambian) durante la sesión de navegación del cliente. Evita volver a
 * pedirlos a Supabase cada vez que el usuario navega entre el home y
 * los módulos. Se reinicia solo si se recarga la página por completo.
 *
 * También deduplica pedidos concurrentes: si dos componentes piden lo
 * mismo casi al mismo tiempo, comparten la misma promesa en vez de
 * disparar dos consultas.
 */

let modulosCache: Modulo[] | null = null;
let modulosCachePromise: Promise<Modulo[]> | null = null;

export function getModulosCacheados(): Promise<Modulo[]> {
  if (modulosCache) return Promise.resolve(modulosCache);
  if (!modulosCachePromise) {
    modulosCachePromise = (async () => {
      const { data } = await supabase.from('modulos').select('*').order('nombre');
      modulosCache = data || [];
      return modulosCache;
    })();
  }
  return modulosCachePromise;
}

const subcategoriasCache = new Map<string, Subcategoria[]>();
const subcategoriasCachePromises = new Map<string, Promise<Subcategoria[]>>();

export function getSubcategoriasCacheadas(moduloId: string): Promise<Subcategoria[]> {
  const cached = subcategoriasCache.get(moduloId);
  if (cached) return Promise.resolve(cached);

  let promise = subcategoriasCachePromises.get(moduloId);
  if (!promise) {
    promise = (async () => {
      const { data } = await supabase.from('subcategorias').select('*').eq('modulo_id', moduloId).order('nombre');
      const result = data || [];
      subcategoriasCache.set(moduloId, result);
      return result;
    })();
    subcategoriasCachePromises.set(moduloId, promise);
  }
  return promise;
}
