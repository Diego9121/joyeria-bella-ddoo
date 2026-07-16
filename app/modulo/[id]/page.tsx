'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useSearchParams } from 'next/navigation';
import { Modulo, Subcategoria } from '@/lib/supabase';
import { getModulosCacheados, getSubcategoriasCacheadas } from '@/lib/catalogCache';
import { TikTokBanner } from '@/components/tiktok-banner';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { ProductGrid } from '@/components/ProductGrid';
import { useCart } from '@/components/cart-context';

const WhatsAppButtonLazy = dynamic(() => import('@/components/whatsapp-button').then(mod => ({ default: mod.WhatsAppButton })), {
  ssr: false,
  loading: () => null,
});

export default function SubcategoriaPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { items, totalItems, cartAnimation } = useCart();
  const moduloId = params.id as string;
  const subcategoriaId = searchParams.get('subcategoria');
  
  const [modulo, setModulo] = useState<Modulo | null>(null);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);

  useEffect(() => {
    setModulo(null);
    setSubcategorias([]);
    loadData();
  }, [moduloId]);

  async function loadData() {
    // Módulo y subcategorías salen en paralelo, y ProductGrid (más abajo)
    // ya no espera a que esto termine para empezar a pedir los productos:
    // antes estaban encadenados uno detrás del otro.
    const [modulos, subcats] = await Promise.all([
      getModulosCacheados(),
      getSubcategoriasCacheadas(moduloId),
    ]);
    setModulo(modulos.find(m => m.id === moduloId) || null);
    setSubcategorias(subcats);
  }

  const selectedSubcategoria = subcategorias.find(s => s.id === subcategoriaId);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TikTokBanner />
      
      <header className="bg-white border-b border-gray-100 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-charcoal hover:text-gold transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Volver</span>
          </Link>
          <Link href="/carrito" className="relative flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-white font-semibold uppercase shadow-md">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            <span>MI PEDIDO</span>
            {totalItems > 0 && (
              <span className={`absolute -top-2 -right-2 bg-white text-red-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                cartAnimation ? 'scale-150 bg-green-500 text-white' : ''
              }`}>
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="relative bg-charcoal py-14 md:py-20">
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-gray-900 to-charcoal" />
          <div className="relative max-w-7xl mx-auto px-4 text-center">
            <p className="text-gold text-sm uppercase tracking-[0.3em] mb-3">{modulo?.nombre}</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-4">
              {selectedSubcategoria ? selectedSubcategoria.nombre.toUpperCase() : 'VER TODO'}
            </h1>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <Link
              href={`/modulo/${moduloId}`}
              className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                !subcategoriaId
                  ? 'bg-gold text-white shadow-lg'
                  : 'bg-white text-charcoal hover:bg-gray-100 border border-gray-200'
              }`}
            >
              Ver todo
            </Link>
            {subcategorias.map((sub) => (
              <Link
                key={sub.id}
                href={`/modulo/${moduloId}?subcategoria=${sub.id}`}
                className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                  subcategoriaId === sub.id
                    ? 'bg-gold text-white shadow-lg'
                    : 'bg-white text-charcoal hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {sub.nombre}
              </Link>
            ))}
          </div>

          <ProductGrid 
            moduloId={moduloId} 
            subcategoriaId={subcategoriaId}
            subcategorias={subcategorias}
          />
        </div>
      </main>

      <footer className="bg-charcoal text-white py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg">
            <span className="text-white text-xl font-bold">JB</span>
          </div>
          <p className="font-bold text-xl text-white tracking-wider" style={{ fontFamily: 'var(--font-logo), Montserrat, sans-serif' }}>Joyería Bella</p>
          <p className="text-gray-400 mt-2">Belleza que brilla, calidad que perdura</p>
        </div>
      </footer>

      <WhatsAppButtonLazy />
    </div>
  );
}
