import { Modulo, Subcategoria, CotizacionProducto } from './supabase';

/**
 * Lógica compartida para armar el mensaje de WhatsApp de una cotización.
 * La usan tanto el carrito (cuando el cliente cotiza) como el panel admin
 * (cuando el admin reenvía la misma cotización), para que el texto sea
 * siempre idéntico sin importar quién lo envía.
 */

// A partir de esta cantidad de productos, el mensaje se copia al
// portapapeles en vez de ir embebido en la URL de WhatsApp (que tiene un
// límite práctico de longitud y puede fallar en pedidos grandes). El
// detalle completo del pedido nunca se resume, solo cambia cómo se entrega.
export const UMBRAL_COTIZACION_EXTENSA = 40;

// Celulares bolivianos: 8 dígitos exactos, empiezan con 5, 6 o 7
// (incluye los rangos nuevos que arrancan con 5).
const PATRON_CELULAR_BOLIVIANO = /^[567]\d{7}$/;

export function esCelularBoliviano(numero: string): boolean {
  const numeroLimpio = numero.replace(/\s/g, '');
  return PATRON_CELULAR_BOLIVIANO.test(numeroLimpio);
}

export interface GrupoProductosCotizacion {
  key: string;
  moduloNombre: string;
  subcategoriaNombre: string | null;
  productos: CotizacionProducto[];
  subtotal: number;
}

/**
 * Agrupa los productos por módulo y subcategoría juntos (no confunde
 * subcategorías distintas de un mismo módulo), en el orden en que
 * aparece cada grupo por primera vez.
 */
export function agruparPorModulo(
  productos: CotizacionProducto[],
  modulos: Modulo[],
  subcategorias: Subcategoria[]
): GrupoProductosCotizacion[] {
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
}

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundTotalGeneral(total: number): number {
  const cents = Math.round((total * 100) % 100);
  const validCents = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

  let rounded: number;
  if (validCents.includes(cents)) {
    rounded = total;
  } else {
    rounded = Math.ceil(total * 10) / 10;
  }

  return roundToTwoDecimals(rounded);
}

interface DatosClienteCotizacion {
  cliente_nombre: string;
  cliente_celular: string;
  cliente_departamento: string;
  cliente_provincia: string;
}

/**
 * Arma el texto plano completo de la cotización (mismo formato que recibe
 * el cliente al cotizar, y el que se reenvía desde el panel admin).
 */
export function construirMensajeCotizacion(
  datosCliente: DatosClienteCotizacion,
  productos: CotizacionProducto[],
  modulos: Modulo[],
  subcategorias: Subcategoria[]
): string {
  const grupos = agruparPorModulo(productos, modulos, subcategorias);
  const formatPrecio = (precio: number) => `${precio.toFixed(2)} Bs`;

  let mensaje = `────────────────────
JOYERÍA BELLA - COTIZACIÓN
────────────────────
DATOS DEL CLIENTE
────────────────────
Nombre:    ${datosCliente.cliente_nombre}
Celular:   ${datosCliente.cliente_celular}
Ubicación: ${datosCliente.cliente_departamento} - ${datosCliente.cliente_provincia}
Notas:
────────────────────
PRODUCTOS
────────────────────`;

  let totalOriginal = 0;

  grupos.forEach((grupo) => {
    const encabezado = grupo.subcategoriaNombre
      ? `${grupo.moduloNombre.toUpperCase()} (${grupo.subcategoriaNombre})`
      : grupo.moduloNombre.toUpperCase();

    mensaje += `\n📿 ${encabezado}`;

    let subtotalGrupo = 0;
    grupo.productos.forEach((p) => {
      const subtotalProducto = roundToTwoDecimals(p.precio * p.cantidad);
      subtotalGrupo += subtotalProducto;
      totalOriginal += p.precio * p.cantidad;
      mensaje += `\n     ${p.codigo}    x${p.cantidad}    ${formatPrecio(subtotalProducto)}`;
    });

    mensaje += `\n     ▸ Subtotal: ${formatPrecio(roundToTwoDecimals(subtotalGrupo))}`;
  });

  const totalRounded = roundTotalGeneral(totalOriginal);

  mensaje += `\n────────────────────
        💰 TOTAL: ${formatPrecio(totalRounded)}
────────────────────
⏰ AVISO IMPORTANTE:
📌 Apertura de reserva: Abre tu cajita con 50 Bs.
⏱️ Tiempo límite: 30 minutos para inicio de reserva.
🔄 Liberación: Pasado el tiempo, se rechaza el pedido y los productos vuelven al catálogo.
────────────────────`;

  return mensaje;
}

/**
 * Arma la URL de WhatsApp para un número dado, con o sin texto pre-cargado.
 * Usa el formato de enlace más confiable según sea celular o escritorio.
 */
export function construirUrlWhatsApp(numero: string, texto?: string): string {
  const numeroLimpio = numero.replace(/\s/g, '');
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const base = isMobile
    ? `https://api.whatsapp.com/send?phone=${numeroLimpio}`
    : `https://wa.me/${numeroLimpio}`;

  if (!texto) return base;

  const separador = isMobile ? '&text=' : '?text=';
  return `${base}${separador}${encodeURIComponent(texto)}`;
}

/**
 * Navega una ventana ya abierta a la URL indicada (evita que el navegador
 * bloquee la apertura si pasó tiempo desde el click original); si no hay
 * ventana disponible, cae de respaldo a crear y hacer click en un link.
 */
export function abrirOEnviarAVentana(ventana: Window | null, url: string) {
  if (ventana && !ventana.closed) {
    ventana.location.href = url;
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
