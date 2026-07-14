'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase, Modulo, Subcategoria, generateProductCode } from '@/lib/supabase';
import { AdminProtected } from '@/components/admin-protected';
import { ImageCropModal } from '@/components/ImageCropModal';

export default function NuevoProductoPage() {
  const router = useRouter();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    modulo_id: '',
    subcategoria_id: '',
    precio: '',
    precio_descuento: '',
    stock: '0',
    imagen_url: '',
    en_liquidacion: false,
  });
  const [codigo, setCodigo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [modulosRes, subcategoriasRes] = await Promise.all([
      fetch('/api/admin/modulos?tipo=modulos'),
      fetch('/api/admin/modulos?tipo=subcategorias'),
    ]);
    if (!modulosRes.ok || !subcategoriasRes.ok) {
      console.error('Error al cargar módulos y subcategorías');
    }
    const modulosData = await modulosRes.json();
    const subcategoriasData = await subcategoriasRes.json();
    if (modulosData.data) setModulos(modulosData.data);
    if (subcategoriasData.data) setSubcategorias(subcategoriasData.data);
    setLoading(false);
  }

  const filteredSubcategorias = subcategorias.filter(s => s.modulo_id === form.modulo_id);

  useEffect(() => {
    if (form.modulo_id) {
      generateCodigo();
    }
  }, [form.modulo_id, form.subcategoria_id]);

  async function generateCodigo() {
    if (!form.modulo_id) return;
    try {
      const subcategoriaId = form.subcategoria_id || null;
      const nuevoCodigo = await generateProductCode(form.modulo_id, subcategoriaId);
      setCodigo(nuevoCodigo);
    } catch (err) {
      console.error('Error generando código:', err);
    }
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dmkxj8sls';

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setUploading(true);
    setShowCropModal(false);
    const file = new File([croppedBlob], 'product-image.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'joyeria_bella');
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        alert('Error: ' + data.error.message);
      } else {
        setForm(prev => ({ ...prev, imagen_url: data.secure_url }));
      }
    } catch (err) {
      alert('Error al subir imagen: ' + err);
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.modulo_id) {
      alert('Selecciona un módulo');
      return;
    }
    setGuardando(true);

    const precioNum = parseFloat(String(form.precio)) || 0;
    const precioDescuentoNum = form.en_liquidacion && form.precio_descuento ? parseFloat(String(form.precio_descuento)) : null;

    const productoData = {
      codigo,
      nombre: '',
      modulo_id: form.modulo_id,
      subcategoria_id: form.subcategoria_id || null,
      precio: precioNum,
      precio_descuento: precioDescuentoNum,
      stock: parseInt(String(form.stock)) || 0,
      imagen_url: form.imagen_url || null,
      activo: true,
    };

    try {
      const res = await fetch('/api/admin/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productoData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Error al guardar producto');
        setGuardando(false);
        return;
      }
      router.push('/admin/productos');
    } catch (err) {
      alert('Error al guardar producto');
    }
    setGuardando(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-cream flex items-center justify-center text-xl text-gold">Cargando...</div>;
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-cream">
        <header className="bg-charcoal text-gold py-4 px-4 sm:px-6 shadow-lg">
          <div className="max-w-2xl mx-auto flex justify-between items-center">
            <Link href="/admin/productos" className="flex items-center gap-2 text-gold hover:text-white transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Productos</span>
            </Link>
            <h1 className="text-lg sm:text-xl font-bold">Nuevo Producto</h1>
            <div className="w-10"></div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-3 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 bg-gray-100 rounded-xl overflow-hidden mb-3">
                {form.imagen_url ? (
                  <Image src={form.imagen_url} alt="Preview" fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              {uploading ? (
                <span className="text-gold text-sm">Subiendo...</span>
              ) : (
                <div className="flex gap-2">
                  <div>
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" id="camera-upload-nuevo" />
                    <label htmlFor="camera-upload-nuevo" className="cursor-pointer flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium">
                      📷 Foto
                    </label>
                  </div>
                  <div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="gallery-upload-nuevo" />
                    <label htmlFor="gallery-upload-nuevo" className="cursor-pointer flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium">
                      🖼️ Galería
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Módulo</label>
                <div className="flex gap-2">
                  <select
                    value={form.modulo_id}
                    onChange={(e) => setForm({ ...form, modulo_id: e.target.value, subcategoria_id: '' })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gold focus:border-gold"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {modulos.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcategoría</label>
                <select
                  value={form.subcategoria_id}
                  onChange={(e) => setForm({ ...form, subcategoria_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gold focus:border-gold"
                  disabled={!form.modulo_id}
                >
                  <option value="">Ninguna</option>
                  {filteredSubcategorias.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio (Bs)</label>
                <input
                  type="number"
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-gold focus:border-gold"
                  placeholder="9.50"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-gold focus:border-gold"
                  min="0"
                  required
                />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.en_liquidacion}
                  onChange={(e) => setForm({ ...form, en_liquidacion: e.target.checked, precio_descuento: '' })}
                  className="w-5 h-5 rounded text-gold focus:ring-gold"
                />
                <span className="font-medium text-gray-700">En Liquidación</span>
              </label>
              {form.en_liquidacion && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Precio de Liquidación (Bs)</label>
                  <input
                    type="number"
                    value={form.precio_descuento}
                    onChange={(e) => setForm({ ...form, precio_descuento: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-gold focus:border-gold"
                    placeholder="8.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Código:</span>
                <span className="font-bold text-gold text-lg">{codigo || 'Selecciona un módulo'}</span>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Link href="/admin/productos" className="flex-1 border border-gray-300 py-3 rounded-lg hover:bg-gray-100 font-medium text-center">
                Cancelar
              </Link>
              <button type="submit" disabled={guardando} className="flex-1 bg-gold text-white py-3 rounded-lg hover:bg-gold-dark font-medium disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Crear Producto'}
              </button>
            </div>
          </form>
        </main>

        {showCropModal && imageToCrop && (
          <ImageCropModal
            imageSrc={imageToCrop}
            onClose={() => { setShowCropModal(false); setImageToCrop(null); }}
            onCropComplete={handleCropComplete}
          />
        )}
      </div>
    </AdminProtected>
  );
}