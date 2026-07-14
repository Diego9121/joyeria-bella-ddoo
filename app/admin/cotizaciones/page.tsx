'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, Cotizacion, CotizacionProducto, Modulo, Subcategoria } from '@/lib/supabase';
import { formatCurrency, WHATSAPP_ADMIN } from '@/lib/constants';
import { AdminProtected } from '@/components/admin-protected';

interface ProductoStock {
  id: string;
  codigo: string;
  nombre: string;
  stock: number;
}

interface GrupoProductosCotizacion {
  key: string;
  moduloNombre: string;
  subcategoriaNombre: string | null;
  productos: CotizacionProducto[];
  subtotal: number;
}

export default function CotizacionesAdmin() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [productosStock, setProductosStock] = useState<ProductoStock[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [cotizacionesRes, productosRes, modulosRes, subcategoriasRes] = await Promise.all([
      fetch('/api/admin/cotizaciones'),
      fetch('/api/admin/productos').then(r => r.json()),
      fetch('/api/admin/modulos?tipo=modulos').then(r => r.json()),
      fetch('/api/admin/modulos?tipo=subcategorias').then(r => r.json()),
    ]);
    const cotizacionesData = await cotizacionesRes.json();
    if (cotizacionesData.cotizaciones) setCotizaciones(cotizacionesData.cotizaciones);
    if (productosRes.productos) setProductosStock(productosRes.productos);
    if (modulosRes.data) setModulos(modulosRes.data);
    if (subcategoriasRes.data) setSubcategorias(subcategoriasRes.data);
    setLoading(false);
  }

  // Agrupa los productos de una cotización por módulo y subcategoría,
  // en el mismo orden en que aparece cada grupo por primera vez
  // (igual criterio que usa el mensaje de WhatsApp en el carrito).
  const agruparPorModulo = (productos: CotizacionProducto[]): GrupoProductosCotizacion[] => {
    const grupos = new Map<string, GrupoProductosCotizacion>();

    for (const prod of productos) {
      const moduloId = prod.modulo_id || '';
      const subcategoriaId = prod.subcategoria_id || '';
      const key = `${moduloId}|${subcategoriaId}`;

      if (!grupos.has(key)) {
        const modulo = modulos.find(m => m.id === moduloId);
        const subcategoria = subcategoriaId ? subcategorias.find(s => s.id === subcategoriaId) : null;
        grupos.set(key, {
          key,
          moduloNombre: modulo?.nombre || 'Sin módulo',
          subcategoriaNombre: subcategoria?.nombre || null,
          productos: [],
          subtotal: 0,
        });
      }

      const grupo = grupos.get(key)!;
      grupo.productos.push(prod);
      grupo.subtotal += prod.precio * prod.cantidad;
    }

    return Array.from(grupos.values());
  };

  const filteredCotizaciones = cotizaciones.filter(c => {
    const matchesEstado = !filterEstado || c.estado === filterEstado;
    const matchesSearch = c.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.cliente_celular.includes(searchTerm);
    return matchesEstado && matchesSearch;
  });

  const getStockProducto = (productoId: string): number => {
    const producto = productosStock.find(p => p.id === productoId);
    return producto?.stock || 0;
  };

  const tieneStockInsuficiente = (productos: CotizacionProducto[]): boolean => {
    return productos.some(p => p.cantidad > getStockProducto(p.producto_id));
  };

  const updateEstado = async (id: string, nuevoEstado: string) => {
    const cotizacion = cotizaciones.find(c => c.id === id);
    if (!cotizacion) return;

    await fetch('/api/admin/cotizaciones', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado: nuevoEstado, productos: cotizacion.productos }),
    });

    const productosRes = await fetch('/api/admin/productos').then(r => r.json());
    if (productosRes.productos) setProductosStock(productosRes.productos);
    loadData();
  };

  const deleteCotizacion = async (id: string) => {
    if (!confirm('¿Eliminar esta cotización?')) return;

    await fetch(`/api/admin/cotizaciones?id=${id}`, { method: 'DELETE' });

    const productosRes = await fetch('/api/admin/productos').then(r => r.json());
    if (productosRes.productos) setProductosStock(productosRes.productos);
    loadData();
  };

  const getTotal = (productos: CotizacionProducto[]) => {
    return productos.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const contactByWhatsApp = (celular: string) => {
    const link = document.createElement('a');
    link.href = `https://wa.me/${celular.replace(/\s/g, '')}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="min-h-screen bg-cream flex items-center justify-center text-xl text-gold">Cargando...</div>;
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-cream">
      <header className="bg-charcoal text-gold py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold">Cotizaciones en Curso</h1>
          <div className="flex gap-2">
            <Link href="/admin/dashboard" className="px-3 py-1.5 rounded-lg border border-gold text-gold hover:bg-gold hover:text-white transition text-sm">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Buscar por nombre o celular..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded-lg px-4 py-2 flex-1 min-w-[200px]"
          />
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="APROBADO">Aprobado</option>
            <option value="RECHAZADO">Rechazado</option>
          </select>
        </div>

        <div className="space-y-4">
          {filteredCotizaciones.map(cotizacion => {
            const productos = cotizacion.productos;
            const total = getTotal(productos);
            const stockInsuficiente = tieneStockInsuficiente(productos);
            const estadoBadgeColor = cotizacion.estado === 'PENDIENTE' ? 'bg-yellow-100 text-yellow-700' :
                                   cotizacion.estado === 'PAGADO' ? 'bg-blue-100 text-blue-700' :
                                   cotizacion.estado === 'APROBADO' ? 'bg-green-100 text-green-700' :
                                   'bg-red-100 text-red-700';

            return (
              <div key={cotizacion.id} className={`bg-white rounded-xl shadow-md overflow-hidden ${stockInsuficiente && (cotizacion.estado === 'PENDIENTE' || cotizacion.estado === 'PAGADO') ? 'ring-2 ring-red-400' : ''}`}>
                <div className="bg-gray-50 p-4 flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-charcoal">{cotizacion.cliente_nombre}</h3>
                    <p className="text-gray-600">{cotizacion.cliente_celular}</p>
                    <p className="text-sm text-gray-500">
                      {cotizacion.cliente_departamento} - {cotizacion.cliente_provincia}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${estadoBadgeColor}`}>
                      {cotizacion.estado}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(cotizacion.created_at)}</p>
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="font-semibold text-charcoal mb-3">Productos:</h4>
                  <div className="space-y-4">
                    {agruparPorModulo(productos).map(grupo => {
                      const encabezado = grupo.subcategoriaNombre
                        ? `${grupo.moduloNombre} (${grupo.subcategoriaNombre})`
                        : grupo.moduloNombre;
                      return (
                        <div key={grupo.key}>
                          <p className="text-xs font-bold text-gold uppercase tracking-wide mb-2">{encabezado}</p>
                          <div className="space-y-2">
                            {grupo.productos.map((prod, idx) => {
                              const stockDisp = getStockProducto(prod.producto_id);
                              const sinStock = prod.cantidad > stockDisp;
                              return (
                                <div key={idx} className={`flex justify-between items-center border-b border-gray-100 pb-2 ${sinStock ? 'bg-red-50 px-2 py-1 rounded' : ''}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gold">{prod.codigo}</span>
                                    <span className="text-gray-600">{prod.nombre}</span>
                                    {sinStock && (
                                      <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                                        Stock: {stockDisp}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <span className="text-sm text-gray-500">x{prod.cantidad}</span>
                                    <span className="ml-4 font-semibold">{formatCurrency(prod.precio * prod.cantidad)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-end mt-1.5">
                            <span className="text-sm text-gray-500">
                              ▸ Subtotal {encabezado}: <span className="font-semibold text-charcoal">{formatCurrency(grupo.subtotal)}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-4 border-t-2 border-gold flex justify-between items-center">
                    <span className="text-lg font-bold text-charcoal">Total:</span>
                    <span className="text-2xl font-bold text-gold">{formatCurrency(total)}</span>
                  </div>

                  {cotizacion.cliente_notas && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">{cotizacion.cliente_notas}</span>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-3 sm:p-4">
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:gap-2 sm:justify-end">
                    <button
                      onClick={() => contactByWhatsApp(cotizacion.cliente_celular)}
                      className="bg-green-500 text-white px-2 py-2 rounded-lg hover:bg-green-600 transition text-xs sm:text-sm sm:px-4 sm:py-2 text-center"
                    >
                      Contactar
                    </button>

                    {cotizacion.estado === 'PENDIENTE' && (
                      <>
                        <button
                          onClick={() => updateEstado(cotizacion.id, 'APROBADO')}
                          className="bg-blue-500 text-white px-2 py-2 rounded-lg hover:bg-blue-600 transition text-xs sm:text-sm sm:px-4 sm:py-2 text-center"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => updateEstado(cotizacion.id, 'RECHAZADO')}
                          className="bg-red-500 text-white px-2 py-2 rounded-lg hover:bg-red-600 transition text-xs sm:text-sm sm:px-4 sm:py-2 text-center"
                        >
                          Rechazar
                        </button>
                      </>
                    )}

                    {(cotizacion.estado === 'APROBADO' || cotizacion.estado === 'RECHAZADO') && (
                      <button
                        onClick={() => deleteCotizacion(cotizacion.id)}
                        className="border border-red-500 text-red-500 bg-white px-2 py-2 rounded-lg hover:bg-red-50 transition text-xs sm:text-sm sm:px-4 sm:py-2 text-center"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredCotizaciones.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay cotizaciones que mostrar
            </div>
          )}
        </div>
      </main>
    </div>
    </AdminProtected>
  );
}
