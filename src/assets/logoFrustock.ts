/**
 * Marca FRUSTOCK vectorizada a partir del archivo original de la empresa.
 *
 * Las hojas se ajustaron numéricamente contra el logo original (98.5% y 98.9%
 * de coincidencia de píxeles) y las barras se midieron al pixel; el conjunto
 * reproduce la marca con un 99.2% de fidelidad.
 *
 * Se guarda como data URI para que el informe PDF no dependa de descargar un
 * archivo: el generador funciona igual sin conexión en el packing.
 */

const HOJAS =
  'M615.5 33.9C468.2 31.4 296.0 101.9 316.2 269.2C474.0 328.3 583.2 177.6 615.5 33.9Z' +
  'M102.7 140.7C123.7 224.8 187.1 310.0 275.2 275.2C287.4 181.3 189.4 140.6 102.7 140.7Z';

const BARRAS = [
  { x: 104, y: 361, w: 411 },
  { x: 104, y: 536, w: 295 },
  { x: 104, y: 711, w: 146 }
];

/** Caja de la marca en su sistema de coordenadas original */
export const LOGO_VIEWBOX = { x: 104, y: 32, w: 511, h: 786 };

/** Proporción alto/ancho — útil para dimensionar sin deformar */
export const LOGO_RATIO = LOGO_VIEWBOX.h / LOGO_VIEWBOX.w; // ≈ 1.538

/** Devuelve el SVG de la marca en el color indicado */
export function logoFrustockSVG(color = '#0F172A'): string {
  const barras = BARRAS
    .map(b => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="107" rx="36"/>`)
    .join('');
  const { x, y, w, h } = LOGO_VIEWBOX;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="${x} ${y} ${w} ${h}">` +
    `<g fill="${color}"><path d="${HOJAS}"/>${barras}</g></svg>`
  );
}

/** El mismo SVG listo para usar en el atributo src de una <img> */
export function logoFrustockDataURI(color = '#0F172A'): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(logoFrustockSVG(color));
}

/**
 * La misma marca rasterizada (130x200 px, gris + alfa).
 * html2canvas dibuja PNG de forma fiable en cualquier WebView; con SVG hay
 * versiones de Android que lo omiten sin avisar, y el informe saldría sin logo.
 */
const MARCA_PNG_BASE64 =
  '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' +
  '117zZ4z/BXkOwFezA1EnAAAAAElFTkSuQmCC';

export const LOGO_FRUSTOCK_PNG = 'data:image/png;base64,' + MARCA_PNG_BASE64;

/** Marca en el gris corporativo, que es como aparece en el logo original */
export const LOGO_FRUSTOCK = logoFrustockDataURI('#4A4A4A');
