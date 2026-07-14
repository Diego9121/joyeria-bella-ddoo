import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generarSiguienteCodigo } from './productCode';

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
}

export function getSupabase() {
  return createSupabaseClient();
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return createSupabaseClient()[prop];
  }
});

export async function generateProductCode(moduloId: string, subcategoriaId?: string | null): Promise<string> {
  const { data: modulo } = await supabase
    .from('modulos')
    .select('prefijo_codigo')
    .eq('id', moduloId)
    .single();
  
  if (!modulo) throw new Error('Módulo no encontrado');
  
  let prefijo = modulo.prefijo_codigo;
  
  if (subcategoriaId) {
    const { data: subcategoria } = await supabase
      .from('subcategorias')
      .select('prefijo_codigo')
      .eq('id', subcategoriaId)
      .single();
    
    if (subcategoria?.prefijo_codigo) {
      prefijo = prefijo + subcategoria.prefijo_codigo;
    }
  }
  
  const { data: productosExistentes } = await supabase
    .from('productos')
    .select('codigo')
    .like('codigo', `${prefijo}%`);

  const codigosExistentes = (productosExistentes || []).map(p => p.codigo);
  return generarSiguienteCodigo(codigosExistentes, prefijo);
}

export async function updateProductCodesByModulo(moduloId: string, oldPrefijo: string, newPrefijo: string): Promise<void> {
  if (oldPrefijo === newPrefijo) return;
  
  const { data: productos } = await supabase
    .from('productos')
    .select('id, codigo')
    .eq('modulo_id', moduloId)
    .is('subcategoria_id', null);
  
  if (productos && productos.length > 0) {
    const updates = productos.map(p => ({
      id: p.id,
      codigo: newPrefijo + p.codigo.substring(oldPrefijo.length)
    }));
    
    for (const update of updates) {
      await supabase
        .from('productos')
        .update({ codigo: update.codigo })
        .eq('id', update.id);
    }
  }
}

export async function updateProductCodesBySubcategoria(subcategoriaId: string, oldPrefijo: string, newPrefijo: string, moduloPrefijo: string): Promise<void> {
  if (oldPrefijo === newPrefijo) return;
  
  const { data: subcategoria } = await supabase
    .from('subcategorias')
    .select('modulo_id')
    .eq('id', subcategoriaId)
    .single();
  
  if (!subcategoria) return;
  
  const { data: modulo } = await supabase
    .from('modulos')
    .select('prefijo_codigo')
    .eq('id', subcategoria.modulo_id)
    .single();
  
  const oldFullPrefijo = moduloPrefijo + oldPrefijo;
  const newFullPrefijo = moduloPrefijo + newPrefijo;
  
  const { data: productos } = await supabase
    .from('productos')
    .select('id, codigo')
    .eq('subcategoria_id', subcategoriaId);
  
  if (productos && productos.length > 0) {
    for (const p of productos) {
      if (p.codigo.startsWith(oldFullPrefijo)) {
        const newCodigo = newFullPrefijo + p.codigo.substring(oldFullPrefijo.length);
        await supabase
          .from('productos')
          .update({ codigo: newCodigo })
          .eq('id', p.id);
      }
    }
  }
}

export async function createModulo(nombre: string, prefijo_codigo: string): Promise<Modulo> {
  const { data, error } = await supabase
    .from('modulos')
    .insert({ nombre, prefijo_codigo: prefijo_codigo.toUpperCase() })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createSubcategoria(nombre: string, modulo_id: string, prefijo_codigo?: string): Promise<Subcategoria> {
  const { data, error } = await supabase
    .from('subcategorias')
    .insert({ nombre, modulo_id, prefijo_codigo: prefijo_codigo?.toUpperCase() || null })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export interface Modulo {
  id: string;
  nombre: string;
  prefijo_codigo: string;
  imagen_url?: string | null;
  created_at: string;
}

export interface Subcategoria {
  id: string;
  modulo_id: string;
  nombre: string;
  prefijo_codigo?: string | null;
  created_at: string;
}

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  modulo_id: string;
  subcategoria_id: string | null;
  precio: number;
  precio_descuento: number | null;
  stock: number;
  imagen_url: string | null;
  activo: boolean;
  created_at: string;
}

export interface Cotizacion {
  id: string;
  cliente_nombre: string;
  cliente_celular: string;
  cliente_departamento: string;
  cliente_provincia: string;
  cliente_notas: string;
  productos: CotizacionProducto[];
  estado: 'PENDIENTE' | 'PAGADO' | 'APROBADO' | 'RECHAZADO';
  created_at: string;
  updated_at: string;
}

export interface CotizacionProducto {
  producto_id: string;
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: number;
  modulo_id?: string;
  subcategoria_id?: string | null;
}

export interface AdminUser {
  id: string;
  nombre: string;
  password_hash: string;
}