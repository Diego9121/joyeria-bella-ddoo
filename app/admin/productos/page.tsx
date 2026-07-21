'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase, Producto, Modulo, Subcategoria } from '@/lib/supabase';
import { formatCurrency } from '@/lib/constants';
import { AdminProtected } from '@/components/admin-protected';
import { ImportProductsModal } from '@/components/ImportProductsModal';

function ProductosAdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [filterAgotados, setFilterAgotados] = useState(false);
  const [showNuevoModuloModal, setShowNuevoModuloModal] = useState(false);
  const [showNuevaSubcategoriaModal, setShowNuevaSubcategoriaModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const filterModulo = searchParams.get('modulo') || '';
  const filterSubcategoria = searchParams.get('subcategoria') || '';
  const filterBusqueda = searchParams.get('busqueda') || '';
  const [busquedaCodigo, setBusquedaCodigo] = useState(filterBusqueda);
  const productsPerPage = 30;

  // Si la URL cambia por fuera (ej. al volver de editar un producto),
  // refleja ese valor en el campo de texto.
  useEffect(() => {
    setBusquedaCodigo(filterBusqueda);
  }, [filterBusqueda]);

  // Espera a que el admin deje de escribir antes de reflejar la búsqueda
  // en la URL, para no disparar una consulta por cada letra tecleada.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const texto = busquedaCodigo.trim();
      if (texto !== filterBusqueda) {
        actualizarFiltrosURL(filterModulo, filterSubcategoria, texto);
      }
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaCodigo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterModulo, filterSubcategoria]);

  useEffect(() => {
    loadTotalCount();
    loadModulosYSubcategorias();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterAgotados, filterModulo, filterSubcategoria, filterBusqueda]);

  useEffect(() => {
    loadTotalCount();
  }, [filterModulo, filterSubcategoria, filterAgotados, filterBusqueda]);

  useEffect(() => {
    loadProductsPage(currentPage);
  }, [currentPage, filterAgotados, filterModulo, filterSubcategoria, filterBusqueda]);

  async function loadTotalCount() {
    const params = new URLSearchParams();
    params.set('limit', '1');
    if (filterAgotados) params.set('agotados', 'true');
    if (filterModulo) params.set('modulo', filterModulo);
    if (filterSubcategoria) params.set('subcategoria', filterSubcategoria);
    if (filterBusqueda) params.set('busqueda', filterBusqueda);

    const res = await fetch(`/api/admin/productos?${params}`);
    if (!res.ok) {
      console.error('Error al cargar el total de productos');
      return;
    }
    const data = await res.json();
    setTotalProducts(data.total || 0);
  }

  async function loadProductsPage(page: number) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', productsPerPage.toString());
    if (filterAgotados) params.set('agotados', 'true');
    if (filterModulo) params.set('modulo', filterModulo);
    if (filterSubcategoria) params.set('subcategoria', filterSubcategoria);
    if (filterBusqueda) params.set('busqueda', filterBusqueda);

    const res = await fetch(`/api/admin/productos?${params}`);
    if (!res.ok) {
      console.error('Error al cargar productos');
      setLoading(false);
      setInitialLoad(false);
      return;
    }
    const data = await res.json();
    if (data.productos) setProductos(data.productos);
    setLoading(false);
    setInitialLoad(false);
  }

  async function loadModulosYSubcategorias() {
    const [modulosRes, subcategoriasRes] = await Promise.all([
      fetch('/api/admin/modulos?tipo=modulos'),
      fetch('/api/admin/modulos?tipo=subcategorias'),
    ]);
    if (!modulosRes.ok || !subcategoriasRes.ok) {
      console.error('Error al cargar módulos y subcategorías');
      return;
    }
    const modulosData = await modulosRes.json();
    const subcategoriasData = await subcategoriasRes.json();
    if (modulosData.data) setModulos(modulosData.data);
    if (subcategoriasData.data) setSubcategorias(subcategoriasData.data);
  }

  const getModuloNombre = (id: string) => modulos.find(m => m.id === id)?.nombre || '';
  const getSubcategoriaNombre = (id: string | null) => id ? subcategorias.find(s => s.id === id)?.nombre || '' : '';

  const totalPages = Math.ceil(totalProducts / productsPerPage);
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    const res = await fetch(`/api/admin/productos?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('No se pudo eliminar el producto. Intenta de nuevo.');
      return;
    }
    loadTotalCount();
    loadProductsPage(currentPage);
  };

  const toggleActivo = async (product: Producto) => {
    const res = await fetch('/api/admin/productos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: product.id, activo: !product.activo }),
    });
    if (!res.ok) {
      alert('No se pudo actualizar el producto. Intenta de nuevo.');
      return;
    }
    loadProductsPage(currentPage);
  };

  const actualizarFiltrosURL = useCallback((modulo: string, subcategoria: string, busqueda: string) => {
    const params = new URLSearchParams();
    if (modulo) params.set('modulo', modulo);
    if (subcategoria) params.set('subcategoria', subcategoria);
    if (busqueda) params.set('busqueda', busqueda);
    router.replace(`/admin/productos?${params.toString()}`);
  }, [router]);

  const handleModuloChange = (value: string) => {
    actualizarFiltrosURL(value, '', filterBusqueda);
  };

  const handleSubcategoriaChange = (value: string) => {
    actualizarFiltrosURL(filterModulo, value, filterBusqueda);
  };

  const handleModuloCreado = (nuevoModulo: Modulo) => {
    setModulos(prev => [...prev, nuevoModulo]);
    setShowNuevoModuloModal(false);
  };

  const handleSubcategoriaCreada = (nuevaSubcategoria: Subcategoria) => {
    setSubcategorias(prev => [...prev, nuevaSubcategoria]);
    setShowNuevaSubcategoriaModal(false);
  };

  if (initialLoad && loading) {
    return <div className="min-h-screen bg-cream flex items-center justify-center text-xl text-gold">Cargando...</div>;
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-cream">
      <header className="bg-charcoal text-gold py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold">Gestionar Productos</h1>
          <div className="flex gap-2">
            <Link href="/admin/dashboard" className="px-3 py-1.5 rounded-lg border border-gold text-gold hover:bg-gold hover:text-white transition text-sm">
              ← Dashboard
            </Link>
            <Link href="/admin/modulos" className="px-3 py-1.5 rounded-lg border border-gold text-gold hover:bg-gold hover:text-white transition text-sm">
              Módulos
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <input
              type="text"
              placeholder="Buscar por código..."
              value={busquedaCodigo}
              onChange={(e) => setBusquedaCodigo(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-gold bg-white"
            />
            <select
              value={filterModulo}
              onChange={(e) => handleModuloChange(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-gold bg-white"
            >
              <option value="">Todos los módulos</option>
              {modulos.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
            <select
              value={filterSubcategoria}
              onChange={(e) => handleSubcategoriaChange(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-gold bg-white"
              disabled={!filterModulo}
            >
              <option value="">Todas las subcategorías</option>
              {subcategorias
                .filter(s => s.modulo_id === filterModulo)
                .map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))
              }
            </select>
          </div>
          <Link
            href="/admin/productos/nuevo"
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition text-sm font-semibold shadow-md"
          >
            + Nuevo Producto
          </Link>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 rounded-lg bg-white border-2 border-black text-black hover:bg-gray-100 transition text-sm font-semibold"
          >
            📥 Importar CSV
          </button>
          <button
            onClick={() => setFilterAgotados(!filterAgotados)}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${
              filterAgotados
                ? 'bg-red-500 text-white border-red-500'
                : 'border-red-500 text-red-500 bg-white hover:bg-red-500 hover:text-white'
            }`}
          >
            {filterAgotados ? 'Ver todos' : 'Solo Agotados'}
          </button>
        </div>

        <div className={`bg-white rounded-xl shadow-md overflow-x-auto transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <table className="w-full min-w-[600px]">
            <thead className="bg-gold text-white">
              <tr>
                <th className="px-4 py-3 text-left w-24">Imagen</th>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Módulo</th>
                <th className="px-4 py-3 text-left">Subcategoría</th>
                <th className="px-4 py-3 text-center">Precio</th>
                <th className="px-4 py-3 text-center">Stock</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(product => (
                <tr key={product.id} className={`border-b hover:bg-gray-50 ${!product.activo ? 'bg-gray-100 opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    {product.imagen_url ? (
                      <div className="w-16 h-16 relative rounded-lg overflow-hidden">
                        <Image src={product.imagen_url} alt={product.nombre} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-gray-400 text-xs">{product.codigo.substring(0, 2)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gold">{product.codigo}</td>
                  <td className="px-4 py-3">{getModuloNombre(product.modulo_id)}</td>
                  <td className="px-4 py-3">{getSubcategoriaNombre(product.subcategoria_id)}</td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {product.precio_descuento ? (
                      <div>
                        <span className="text-gray-400 line-through text-sm mr-1">{formatCurrency(product.precio)}</span>
                        <span className="text-red-500">{formatCurrency(product.precio_descuento)}</span>
                      </div>
                    ) : (
                      formatCurrency(product.precio)
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${product.stock === 0 ? 'text-red-500' : product.stock <= 3 ? 'text-yellow-500' : 'text-green-600'}`}>
                      {product.stock}
                    </span>
                    {product.stock === 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">AGOTADO</span>
                    )}
                    {product.stock > 0 && product.stock <= 3 && (
                      <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">Stock bajo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link href={`/admin/productos/${product.id}?modulo=${filterModulo}&subcategoria=${filterSubcategoria}&busqueda=${encodeURIComponent(filterBusqueda)}`} className="text-blue-500 hover:text-blue-700 mr-2">Editar</Link>
                    <button onClick={() => toggleActivo(product)} className="text-yellow-500 hover:text-yellow-700 mr-2">
                      {product.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => deleteProduct(product.id)} className="text-red-500 hover:text-red-700">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Anterior
            </button>
            
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-blue-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Siguiente
            </button>
          </div>
        )}

        {totalPages > 0 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Mostrando {indexOfFirstProduct + 1} - {Math.min(indexOfLastProduct, totalProducts)} de {totalProducts} productos
          </p>
        )}
      </main>

      {showNuevoModuloModal && (
        <NuevoModuloModal
          onClose={() => setShowNuevoModuloModal(false)}
          onSave={handleModuloCreado}
        />
      )}

      {showNuevaSubcategoriaModal && (
        <NuevaSubcategoriaModal
          modulos={modulos}
          onClose={() => setShowNuevaSubcategoriaModal(false)}
          onSave={handleSubcategoriaCreada}
        />
      )}

      {showImportModal && (
        <ImportProductsModal
          modulos={modulos}
          subcategorias={subcategorias}
          onClose={() => setShowImportModal(false)}
          onComplete={() => { loadTotalCount(); loadProductsPage(currentPage); }}
        />
      )}
    </div>
    </AdminProtected>
  );
}

interface NuevoModuloModalProps {
  onClose: () => void;
  onSave: (modulo: Modulo) => void;
}

function NuevoModuloModal({ onClose, onSave }: NuevoModuloModalProps) {
  const [nombre, setNombre] = useState('');
  const [prefijo, setPrefijo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !prefijo) return;
    setGuardando(true);
    try {
      const res = await fetch('/api/admin/modulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'modulo', nombre, prefijo_codigo: prefijo }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSave(data.data);
      } else {
        alert(data.error || 'Error al crear módulo');
      }
    } catch (err) {
      alert('Error al crear módulo');
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-charcoal mb-4">Nuevo Módulo</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Módulo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-gold focus:border-gold"
              placeholder="Ej: Anillos"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo de Código</label>
            <input
              type="text"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-gold focus:border-gold"
              placeholder="Ej: AN"
              maxLength={3}
              required
            />
          </div>
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 py-2.5 rounded-lg hover:bg-gray-100">Cancelar</button>
            <button type="submit" disabled={guardando} className="flex-1 btn-gold py-2.5 disabled:opacity-50">
              {guardando ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface NuevaSubcategoriaModalProps {
  modulos: Modulo[];
  onClose: () => void;
  onSave: (subcategoria: Subcategoria) => void;
}

function NuevaSubcategoriaModal({ modulos, onClose, onSave }: NuevaSubcategoriaModalProps) {
  const [nombre, setNombre] = useState('');
  const [moduloId, setModuloId] = useState(modulos[0]?.id || '');
  const [prefijo, setPrefijo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !moduloId) return;
    setGuardando(true);
    try {
      const res = await fetch('/api/admin/modulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'subcategoria', nombre, modulo_id: moduloId, prefijo_codigo: prefijo || null }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSave(data.data);
      } else {
        alert(data.error || 'Error al crear subcategoría');
      }
    } catch (err) {
      alert('Error al crear subcategoría');
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-charcoal mb-4">Nueva Subcategoría</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Subcategoría</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-gold focus:border-gold"
              placeholder="Ej: Compromiso"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Módulo</label>
            <select
              value={moduloId}
              onChange={(e) => setModuloId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-gold focus:border-gold"
              required
            >
              {modulos.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo de Código (opcional)</label>
            <input
              type="text"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-gold focus:border-gold"
              placeholder="Ej: C"
              maxLength={3}
            />
          </div>
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 py-2.5 rounded-lg hover:bg-gray-100">Cancelar</button>
            <button type="submit" disabled={guardando} className="flex-1 btn-gold py-2.5 disabled:opacity-50">
              {guardando ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProductosAdmin() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center text-xl text-gold">Cargando...</div>}>
      <ProductosAdminContent />
    </Suspense>
  );
}
