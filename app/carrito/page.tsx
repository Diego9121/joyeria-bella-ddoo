'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, Producto, Modulo, Subcategoria } from '@/lib/supabase';
import { formatCurrency, WHATSAPP_ADMIN, DEPARTAMENTOS_BOLIVIA } from '@/lib/constants';
import { useCart } from '@/components/cart-context';
import {
  UMBRAL_COTIZACION_EXTENSA,
  construirMensajeCotizacion,
  construirUrlWhatsApp,
  abrirOEnviarAVentana,
  roundToTwoDecimals,
  roundTotalGeneral,
} from '@/lib/cotizacionMensaje';

export default function CarritoPage() {
  const router = useRouter();
  const { items, updateQuantity, removeFromCart, clearCart, totalItems } = useCart();
  const [productos, setProductos] = useState<(Producto & { cantidad?: number; modulo_nombre?: string; subcategoria_nombre?: string })[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    celular: '',
    departamento: '',
    provincia: '',
    notas: '',
  });

  useEffect(() => {
    loadProductos();
  }, [items.length]);

  async function loadProductos() {
    if (items.length === 0) {
      setProductos([]);
      setModulos([]);
      setSubcategorias([]);
      setLoading(false);
      return;
    }

    const productoIds = items.map(item => item.productoId);
    
    const productosRes = await supabase
      .from('productos')
      .select('*')
      .in('id', productoIds)
      .eq('activo', true);

    if (!productosRes.data || productosRes.data.length === 0) {
      setLoading(false);
      return;
    }

    const moduloIds = [...new Set(productosRes.data.map(p => p.modulo_id))];
    const subcategoriaIds = [...new Set(
      productosRes.data
        .filter(p => p.subcategoria_id)
        .map(p => p.subcategoria_id as string)
    )];

    const [modulosRes, subcategoriasRes] = await Promise.all([
      supabase.from('modulos').select('*').in('id', moduloIds),
      subcategoriaIds.length > 0
        ? supabase.from('subcategorias').select('*').in('id', subcategoriaIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (modulosRes.data && subcategoriasRes.data) {
      const productosConCantidad = productosRes.data.map(p => {
        const item = items.find(i => i.productoId === p.id);
        const cantidadOriginal = item?.cantidad || 0;
        const cantidadAjustada = Math.min(cantidadOriginal, p.stock);
        
        if (cantidadAjustada < cantidadOriginal) {
          updateQuantity(p.id, cantidadAjustada);
        }
        
        const modulo = modulosRes.data.find(m => m.id === p.modulo_id);
        const subcategoria = subcategoriasRes.data.find(s => s.id === p.subcategoria_id);
        
        return { 
          ...p, 
          cantidad: cantidadAjustada,
          modulo_nombre: modulo?.nombre || '',
          subcategoria_nombre: subcategoria?.nombre || '',
        };
      });
      setProductos(productosConCantidad);
      setModulos(modulosRes.data);
      setSubcategorias(subcategoriasRes.data);
    }
    setLoading(false);
  }

  const updateItemQuantity = (productId: string, delta: number) => {
    const item = items.find(i => i.productoId === productId);
    if (item) {
      updateQuantity(productId, item.cantidad + delta);
    }
  };

  const getTotalOriginal = () => {
      return productos.reduce((sum, p) => {
        const cantidad = items.find(i => i.productoId === p.id)?.cantidad || 0;
        const precio = p.precio_descuento || p.precio;
        return sum + (precio * cantidad);
      }, 0);
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Se abre la pestaña de inmediato (todavía en blanco) para que el navegador
    // la reconozca como resultado directo del click y no la bloquee más adelante,
    // sin importar cuánto tarde el proceso de guardado.
    const whatsappWindow = window.open('', '_blank');

    const productosCotizacion = productos.map(p => ({
      producto_id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      precio: p.precio_descuento || p.precio,
      cantidad: items.find(i => i.productoId === p.id)?.cantidad || 0,
      modulo_id: p.modulo_id,
      subcategoria_id: p.subcategoria_id,
    }));

    const productoIds = productosCotizacion.map(p => p.producto_id);

    // Una sola consulta para el stock de todos los productos, en vez de una
    // consulta por producto (esto es lo que hacía tan lento un pedido grande).
    const { data: stocksData } = await supabase
      .from('productos')
      .select('id, stock')
      .in('id', productoIds);

    const stockPorProducto = new Map((stocksData || []).map(p => [p.id, p.stock as number]));

    for (const prod of productosCotizacion) {
      const stockDisponible = stockPorProducto.get(prod.producto_id) ?? 0;
      if (stockDisponible < prod.cantidad) {
        if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
        alert(`Stock insuficiente para ${prod.codigo}. Stock disponible: ${stockDisponible}`);
        setSubmitting(false);
        return;
      }
    }

    try {
      // Los descuentos de stock salen todos en paralelo (antes iban uno por
      // uno, en fila). Cada producto es una fila distinta, así que no hay
      // conflicto entre ellos.
      await Promise.all(productosCotizacion.map(prod => {
        const stockActual = stockPorProducto.get(prod.producto_id) ?? 0;
        return supabase
          .from('productos')
          .update({ stock: stockActual - prod.cantidad })
          .eq('id', prod.producto_id);
      }));

      const { error } = await supabase.from('cotizaciones').insert({
        cliente_nombre: formData.nombre,
        cliente_celular: formData.celular,
        cliente_departamento: formData.departamento,
        cliente_provincia: formData.provincia,
        cliente_notas: formData.notas,
        productos: productosCotizacion,
        estado: 'PENDIENTE',
      });

      if (error) throw error;
    } catch (error) {
      await Promise.all(productosCotizacion.map(prod => {
        const stockOriginal = stockPorProducto.get(prod.producto_id) ?? 0;
        return supabase
          .from('productos')
          .update({ stock: stockOriginal })
          .eq('id', prod.producto_id);
      }));
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
      alert('Error al guardar cotización. Stock revertido.');
      setSubmitting(false);
      return;
    }

    const mensajeTexto = construirMensajeCotizacion(
      {
        cliente_nombre: formData.nombre,
        cliente_celular: formData.celular,
        cliente_departamento: formData.departamento,
        cliente_provincia: formData.provincia,
      },
      productosCotizacion,
      modulos,
      subcategorias
    );

    const esCotizacionExtensa = productosCotizacion.length > UMBRAL_COTIZACION_EXTENSA;

    if (esCotizacionExtensa) {
      let copiadoAlPortapapeles = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(mensajeTexto);
          copiadoAlPortapapeles = true;
        }
      } catch {
        copiadoAlPortapapeles = false;
      }

      if (copiadoAlPortapapeles) {
        // Con muchos productos el texto es muy largo para ir en la URL
        // (WhatsApp puede fallar en abrir o llegar con el texto cortado).
        // Se copia completo al portapapeles y se abre el chat vacío.
        alert('Tu cotización se copió. Pégala (mantén presionado y "Pegar") en el chat de WhatsApp que se va a abrir.');
        abrirOEnviarAVentana(whatsappWindow, construirUrlWhatsApp(WHATSAPP_ADMIN));
      } else {
        // Si el portapapeles no está disponible, se mantiene el
        // comportamiento de siempre (texto en la URL) como respaldo.
        abrirOEnviarAVentana(whatsappWindow, construirUrlWhatsApp(WHATSAPP_ADMIN, mensajeTexto));
      }
    } else {
      abrirOEnviarAVentana(whatsappWindow, construirUrlWhatsApp(WHATSAPP_ADMIN, mensajeTexto));
    }

    clearCart();
    setSubmitted(true);
  };

  const scrollToForm = () => {
    setShowForm(true);
    setTimeout(() => {
      const formElement = document.getElementById('form-cotizacion');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const provincias = formData.departamento
    ? DEPARTAMENTOS_BOLIVIA.find(d => d.nombre === formData.departamento)?.provincias || []
    : [];

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-charcoal">Cargando carrito...</div>;
  }

  if (productos.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-charcoal mb-3">Tu carrito está vacío</h1>
        <p className="text-gray-500 mb-8 text-center">Explora nuestras categorías para agregar productos</p>
        <Link href="/" className="px-8 py-3 bg-gold text-white rounded-full font-semibold hover:bg-gold-dark transition">
          Explorar categorías
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="w-24 h-24 mb-6 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-charcoal mb-3">¡Cotización Enviada!</h1>
        <p className="text-gray-500 mb-2 text-center">Tu mensaje se ha abierto en WhatsApp</p>
        <p className="text-gray-400 text-sm mb-8 text-center">Envía el mensaje para completar tu solicitud</p>
        <Link href="/" className="px-8 py-3 bg-gold text-white rounded-full font-semibold hover:bg-gold-dark transition">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 flex justify-between items-center">
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold uppercase rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Continuar Comprando</span>
          </Link>
          <span className="bg-gold text-white px-4 py-2 rounded-full font-semibold text-sm">
            {totalItems} producto{totalItems !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-charcoal">Carrito de Compras</h1>
          <button onClick={clearCart} className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors">
            Vaciar carrito
          </button>
        </div>

        <div className="space-y-4 mb-8">
          {productos.map(producto => {
            const cantidad = items.find(i => i.productoId === producto.id)?.cantidad || 0;
            const precio = producto.precio_descuento || producto.precio;
            const subtotal = roundToTwoDecimals(precio * cantidad);

            return (
              <div key={producto.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <span className="text-charcoal font-semibold text-sm uppercase">{producto.modulo_nombre}{producto.subcategoria_nombre ? ` (${producto.subcategoria_nombre})` : ''}</span>
                  <span className="text-gold font-bold text-sm block mt-1">{producto.codigo}</span>
                  <div className="flex items-center gap-3 mt-2">
                    {producto.precio_descuento ? (
                      <>
                        <span className="text-gray-400 line-through text-sm">{formatCurrency(producto.precio)}</span>
                        <span className="text-gold font-bold">{formatCurrency(producto.precio_descuento)}</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-charcoal">{formatCurrency(producto.precio)}</span>
                    )}
                    <span className="text-gray-400 text-sm">c/u</span>
                  </div>
                </div>
                <span className="font-bold text-xl text-charcoal">x{cantidad}</span>
                <div className="text-right min-w-[100px]">
                  <span className="text-xl font-bold text-charcoal">{formatCurrency(subtotal)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-charcoal">Total:</span>
            <span className="text-3xl font-bold text-charcoal">{formatCurrency(roundTotalGeneral(getTotalOriginal()))}</span>
          </div>
        </div>

        {!showForm ? (
          <button
            onClick={scrollToForm}
            disabled={productos.length === 0}
            className="w-full py-4 text-lg font-semibold rounded-xl transition shadow-lg disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed bg-gold hover:bg-gold-dark text-white"
          >
            {productos.length === 0 ? 'Agrega productos al carrito' : 'Completar Cotización'}
          </button>
        ) : (
          <form id="form-cotizacion" onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-center">
                <span className="text-red-600 font-bold uppercase">IMPORTANTE:</span>
                <span className="text-black font-semibold uppercase"> (PARA ASEGURAR EL APARTADO DEBE REALIZAR UN ADELANTO MINIMO DE 50BS)</span>
              </p>
            </div>

            <h2 className="text-xl font-bold text-charcoal mb-6">Datos de Envío</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Nombre completo *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-gold focus:border-gold transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Celular (WhatsApp) *</label>
                <input
                  type="tel"
                  value={formData.celular}
                  onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-gold focus:border-gold transition"
                  placeholder="Ej: 71123456"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">Departamento *</label>
                  <select
                    value={formData.departamento}
                    onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-gold focus:border-gold transition"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {DEPARTAMENTOS_BOLIVIA.map(d => (
                      <option key={d.id} value={d.nombre}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">Destino *</label>
                  <input
                    type="text"
                    value={formData.provincia}
                    onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-gold focus:border-gold transition"
                    placeholder="Ej: Ciudad, Zona, Barrio..."
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Notas (opcional)</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 h-24 focus:ring-2 focus:ring-gold focus:border-gold transition"
                  placeholder="Indica la dirección exacta o cualquier otra indicación..."
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-xl font-semibold bg-green-500 hover:bg-green-600 text-white transition shadow-lg disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Enviar Cotización por WhatsApp'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-full border border-gray-200 py-3 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
