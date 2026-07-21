import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generarSiguienteCodigo } from '@/lib/productCode';

export const dynamic = 'force-dynamic';

// Código de error de Postgres para violación de restricción UNIQUE.
const UNIQUE_VIOLATION = '23505';
const MAX_INTENTOS_CODIGO = 5;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Faltan variables de entorno de Supabase');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function obtenerPrefijo(
  supabaseAdmin: SupabaseClient,
  moduloId: string,
  subcategoriaId: string | null | undefined
): Promise<string | null> {
  const { data: modulo } = await supabaseAdmin
    .from('modulos')
    .select('prefijo_codigo')
    .eq('id', moduloId)
    .single();

  if (!modulo) return null;

  let prefijo = modulo.prefijo_codigo;

  if (subcategoriaId) {
    const { data: subcategoria } = await supabaseAdmin
      .from('subcategorias')
      .select('prefijo_codigo')
      .eq('id', subcategoriaId)
      .single();

    if (subcategoria?.prefijo_codigo) {
      prefijo = prefijo + subcategoria.prefijo_codigo;
    }
  }

  return prefijo;
}

async function regenerarCodigo(supabaseAdmin: SupabaseClient, prefijo: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('productos')
    .select('codigo')
    .like('codigo', `${prefijo}%`);

  const codigosExistentes = (data || []).map((p: { codigo: string }) => p.codigo);
  return generarSiguienteCodigo(codigosExistentes, prefijo);
}

export async function GET(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const filterAgotados = searchParams.get('agotados') === 'true';
    const filterModulo = searchParams.get('modulo') || '';
    const filterSubcategoria = searchParams.get('subcategoria') || '';
    const busqueda = searchParams.get('busqueda') || '';

    // Búsqueda por ID específico
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('productos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ producto: data });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('productos')
      .select('*', { count: 'exact' })
      .order('modulo_id', { ascending: true })
      .order('codigo', { ascending: true })
      .range(from, to);

    if (filterAgotados) {
      query = query.eq('stock', 0);
    }
    if (filterModulo) {
      query = query.eq('modulo_id', filterModulo);
    }
    if (filterSubcategoria) {
      query = query.eq('subcategoria_id', filterSubcategoria);
    }
    if (busqueda) {
      query = query.ilike('codigo', `%${busqueda}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ productos: data, total: count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    
    // Detectar si es bulk insert (array) o insert individual (object)
    const isBulk = Array.isArray(body);
    
    if (isBulk) {
      // Bulk insert para importación CSV
      const { data, error } = await supabaseAdmin
        .from('productos')
        .insert(body)
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, productos: data, count: data?.length || 0 });
    } else {
      // Insert individual, con reintento si el código ya fue tomado
      // por otra petición concurrente (requiere restricción UNIQUE en
      // productos.codigo; ver supabase/migrations/003_add_unique_constraint_codigo.sql).
      let intento = 0;

      while (true) {
        const { data, error } = await supabaseAdmin
          .from('productos')
          .insert(body)
          .select()
          .single();

        if (!error) {
          return NextResponse.json({ success: true, producto: data });
        }

        const esConflictoDeCodigo = error.code === UNIQUE_VIOLATION && /codigo/i.test(error.message || '');
        intento++;

        if (!esConflictoDeCodigo || intento >= MAX_INTENTOS_CODIGO) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const prefijo = await obtenerPrefijo(supabaseAdmin, body.modulo_id, body.subcategoria_id);
        if (!prefijo) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        body.codigo = await regenerarCodigo(supabaseAdmin, prefijo);
      }
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { id, ...data } = await request.json();

    const { error } = await supabaseAdmin
      .from('productos')
      .update(data)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}