'use client';

import { useEffect, useState } from 'react';
import { Modulo } from '@/lib/supabase';
import { getModulosCacheados } from '@/lib/catalogCache';
import { Header } from '@/components/header';
import { TikTokBanner } from '@/components/tiktok-banner';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { HeroCategories } from '@/components/hero-categories';
import { Footer } from '@/components/footer';
import { useCart } from '@/components/cart-context';
import dynamic from 'next/dynamic';

const WhatsAppButtonLazy = dynamic(() => import('@/components/whatsapp-button').then(mod => ({ default: mod.WhatsAppButton })), {
  ssr: false,
  loading: () => null,
});

export default function Home() {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const { totalItems } = useCart();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const data = await getModulosCacheados();
    setModulos(data);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <TikTokBanner />
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gold animate-pulse" />
            <p className="text-gray-500">Cargando...</p>
          </div>
        </main>
        <WhatsAppButtonLazy />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <TikTokBanner />
      <Header />
      
      <main className="flex-1">
        <HeroCategories modulos={modulos} />
      </main>

      <Footer />
      <WhatsAppButtonLazy />
    </div>
  );
}