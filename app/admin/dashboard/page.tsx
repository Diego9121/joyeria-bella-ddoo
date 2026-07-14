'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AdminProtected } from '@/components/admin-protected';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProductos: 0,
    productosAgotados: 0,
    productosStockBajo: 0,
    cotizacionesPendientes: 0,
  });
  const [productosAlerta, setProductosAlerta] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const [productosResRaw, cotizacionesResRaw] = await Promise.all([
      fetch('/api/admin/productos?limit=1000'),
      fetch('/api/admin/cotizaciones'),
    ]);

    if (!productosResRaw.ok || !cotizacionesResRaw.ok) {
      console.error('Error al cargar las estadísticas del dashboard');
    }

    const productosRes = await productosResRaw.json();
    const cotizacionesRes = await cotizacionesResRaw.json();

    if (productosRes.productos) {
      const productos = productosRes.productos;
      const agotados = productos.filter(p => p.stock === 0).length;
      const stockBajo = productos.filter(p => p.stock > 0 && p.stock <= 3).length;
      
      setStats(s => ({
        ...s,
        totalProductos: productosRes.total || productos.length,
        productosAgotados: agotados,
        productosStockBajo: stockBajo,
      }));

      const productosEnAlerta = productos
        .filter(p => p.stock <= 3)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 10);
      setProductosAlerta(productosEnAlerta);
    }

    if (cotizacionesRes.cotizaciones) {
      setStats(s => ({
        ...s,
        cotizacionesPendientes: cotizacionesRes.cotizaciones.filter((c: any) => c.estado === 'PENDIENTE').length,
      }));
    }
  }

  const logout = () => {
    sessionStorage.removeItem('admin_session');
    router.push('/admin');
  };

  return (
    <AdminProtected>
      <div className="min-h-screen" style={{ backgroundColor: '#FFF8E7' }}>
      <header className="bg-charcoal text-gold py-3 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-md">
              <span className="text-white text-base font-bold">JB</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Panel Admin</h1>
              <p className="text-xs text-gold/70 tracking-widest uppercase">Joyería Bella</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gold-light hover:text-white transition text-sm text-center font-medium">
              Ver Catálogo
            </Link>
            <button onClick={logout} className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition text-sm text-center font-medium">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link href="/admin/productos" className="bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition-all group border-b-4 border-gold">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total</span>
            </div>
            <div className="text-3xl font-bold text-charcoal mb-1">{stats.totalProductos}</div>
            <div className="text-sm text-gold font-medium">Productos</div>
          </Link>

          <Link href="/admin/productos?filter=agotados" className="bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition-all group border-b-4 border-red-500">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Alerta</span>
            </div>
            <div className="text-3xl font-bold text-red-500 mb-1">{stats.productosAgotados}</div>
            <div className="text-sm text-red-400 font-medium">Agotados</div>
          </Link>

          <Link href="/admin/productos" className="bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition-all group border-b-4 border-yellow-400">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Stock</span>
            </div>
            <div className="text-3xl font-bold text-yellow-500 mb-1">{stats.productosStockBajo}</div>
            <div className="text-sm text-yellow-500 font-medium">Stock Bajo</div>
          </Link>

          <Link href="/admin/cotizaciones" className="bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition-all group border-b-4 border-blue-500 relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Pendientes</span>
            </div>
            <div className="text-3xl font-bold text-blue-500 mb-1">{stats.cotizacionesPendientes}</div>
            <div className="text-sm text-blue-400 font-medium">Cotizaciones</div>
            {stats.cotizacionesPendientes > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                {stats.cotizacionesPendientes > 99 ? '99+' : stats.cotizacionesPendientes}
              </span>
            )}
          </Link>
        </div>

        {productosAlerta.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6 mb-8 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-yellow-800 text-lg">Productos con Stock Bajo</h3>
                <p className="text-sm text-yellow-600">Productos que necesitan reposición</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {productosAlerta.map(producto => (
                <div key={producto.id} className={`bg-white rounded-lg p-3 shadow-sm ${producto.stock === 0 ? 'border-2 border-red-300' : 'border border-yellow-200'}`}>
                  <p className="text-xs text-gold font-bold">{producto.codigo}</p>
                  <p className={`text-lg font-bold mt-1 ${producto.stock === 0 ? 'text-red-500' : 'text-yellow-600'}`}>
                    {producto.stock === 0 ? 'AGOTADO' : `Stock: ${producto.stock}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-bold text-charcoal mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Gestión Rápida
            </h2>
            <div className="space-y-3">
              <Link href="/admin/productos" className="flex items-center gap-4 bg-gradient-to-r from-gold to-gold-dark text-white p-4 rounded-xl hover:shadow-lg transition-all group">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-lg">Gestionar Productos</p>
                  <p className="text-sm text-white/80">Agregar, editar o eliminar productos</p>
                </div>
              </Link>
              <Link href="/admin/modulos" className="flex items-center gap-4 bg-gradient-to-r from-charcoal to-gray-800 text-white p-4 rounded-xl hover:shadow-lg transition-all group">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-lg">Módulos y Subcategorías</p>
                  <p className="text-sm text-white/80">Organizar categorías de productos</p>
                </div>
              </Link>
              <Link href="/admin/cotizaciones" className="flex items-center gap-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white p-4 rounded-xl hover:shadow-lg transition-all group relative">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-lg">Cotizaciones</p>
                  <p className="text-sm text-white/80">Ver y aprobar cotizaciones</p>
                </div>
                {stats.cotizacionesPendientes > 0 && (
                  <span className="absolute right-2 top-2 bg-red-500 text-white text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-bold shadow-md">
                    ({stats.cotizacionesPendientes > 99 ? '99+' : stats.cotizacionesPendientes}) pend
                  </span>
                )}
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md">
            <h2 className="text-lg font-bold text-charcoal mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Últimas Cotizaciones
            </h2>
            <CotizacionesRecientes />
          </div>
        </div>
      </main>
    </div>
    </AdminProtected>
  );
}

function CotizacionesRecientes() {
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);

  useEffect(() => {
    loadCotizaciones();
  }, []);

  async function loadCotizaciones() {
    const res = await fetch('/api/admin/cotizaciones');
    if (!res.ok) {
      console.error('Error al cargar las cotizaciones recientes');
      return;
    }
    const data = await res.json();
    if (data.cotizaciones) setCotizaciones(data.cotizaciones.slice(0, 5));
  }

  if (cotizaciones.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-400 font-medium">No hay cotizaciones recientes</p>
      </div>
    );
  }

  const getTotal = (productos: any[]) => {
    return productos.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-3">
      {cotizaciones.map(c => (
        <div key={c.id} className="border border-gray-100 rounded-xl p-4 hover:border-gold/30 hover:bg-gold/5 transition-all">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold text-charcoal">{c.cliente_nombre}</p>
              <p className="text-sm text-gray-400">{formatDate(c.created_at)}</p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              c.estado === 'PENDIENTE' ? 'bg-yellow-100 text-yellow-700' :
              c.estado === 'APROBADO' ? 'bg-green-100 text-green-700' :
              'bg-red-100 text-red-700'
            }`}>
              {c.estado}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{c.cliente_celular}</p>
            <p className="font-bold text-gold">{getTotal(c.productos || []).toFixed(2)} Bs</p>
          </div>
        </div>
      ))}
    </div>
  );
}