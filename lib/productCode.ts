/**
 * Lógica pura (sin I/O) para calcular el siguiente código de producto.
 * Separada de lib/supabase.ts para poder probarla sin depender de la base de datos.
 */

export const CODIGO_PADDING = 3;

/**
 * Extrae la parte numérica de un código si (y solo si) empieza exactamente
 * con `prefijo` y el resto son únicamente dígitos. Devuelve null en cualquier
 * otro caso (evita confundir prefijos parecidos, ej. "C018" no debe contar
 * para el prefijo "CM", ni "CM018" debe contar para el prefijo "C").
 */
export function extraerNumeroCodigo(codigo: string, prefijo: string): number | null {
  if (!codigo.startsWith(prefijo)) return null;
  const resto = codigo.slice(prefijo.length);
  if (!/^\d+$/.test(resto)) return null;
  return parseInt(resto, 10);
}

/**
 * Calcula el siguiente número a usar como MAX(numero existente) + 1,
 * en vez de contar cuántos productos existen (COUNT(*) + 1), que rompe
 * la numeración cuando hay huecos por productos eliminados.
 */
export function calcularSiguienteNumero(codigosExistentes: string[], prefijo: string): number {
  let maxNumero = 0;
  for (const codigo of codigosExistentes) {
    const numero = extraerNumeroCodigo(codigo, prefijo);
    if (numero !== null && numero > maxNumero) {
      maxNumero = numero;
    }
  }
  return maxNumero + 1;
}

export function construirCodigo(prefijo: string, numero: number, padding: number = CODIGO_PADDING): string {
  return `${prefijo}${String(numero).padStart(padding, '0')}`;
}

/**
 * Punto de entrada único: dado el listado de códigos existentes que
 * comparten prefijo (o candidatos a compartirlo) y el prefijo exacto,
 * devuelve el siguiente código a asignar.
 */
export function generarSiguienteCodigo(
  codigosExistentes: string[],
  prefijo: string,
  padding: number = CODIGO_PADDING
): string {
  const numero = calcularSiguienteNumero(codigosExistentes, prefijo);
  return construirCodigo(prefijo, numero, padding);
}
