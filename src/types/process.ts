export type DefectSeverity = 'grave' | 'medio' | 'leve';
export type DefectCategoryType = 'calidad' | 'condicion' | 'plagas';
export type BoxStatus = 'APROBADA' | 'OBJETADA';
export type Species = 'Naranja' | 'Mandarina' | 'Limón' | 'Palta';

/**
 * Categorías de embalaje. Cada especie usa su propio subconjunto.
 * - Naranja:   EXTRA-FANCY | FANCY
 * - Mandarina: EF-SEM10 (Extra-Fancy) | F-SEM10 (Cat 1) | F-SEM20 (Fancy) | F-SEM30 (Fancy Latam)
 * - Limón:     CHOICE-USA | FANCY-USA-J | E-FANCY-J
 * - Palta:     PALTA-STD (tabla única)
 */
export type ExportCategory =
  | 'EXTRA-FANCY' | 'FANCY'
  | 'EF-SEM10' | 'F-SEM10' | 'F-SEM20' | 'F-SEM30'
  | 'CHOICE-USA' | 'FANCY-USA-J' | 'E-FANCY-J'
  | 'PALTA-STD';

/** Programa/tabla de calibres. Varía por especie y mercado. */
export type CaliberProgram = 'NORMAL' | 'COSTCO' | 'USA' | 'EUROPA';

export interface DefectItem {
  id: string;
  name: string;
  category: DefectSeverity;
  type: DefectCategoryType;
  /** Porcentaje sobre el total de frutos de la caja. Es el valor que evalúan las tolerancias. */
  countOrPercentage: number;
  unit: '%' | 'unidades';
  tolerance: number;          // tolerancia aplicable en la categoría del proceso
  excludeFromTotal?: boolean; // ej. Descalibre en limón no suma al total de la caja
  /** Frutos con el defecto que contó el inspector (queda para poder auditar el %) */
  unidades?: number;
  /** Total de frutos contra el que se calculó el porcentaje */
  totalFrutos?: number;
  /** El defecto no tiene techo propio: solo aporta al total de la caja */
  sinTopeIndividual?: boolean;
}

/** Medición de madurez registrada en el proceso (Brix, acidez, materia seca…) */
export interface MaturityReading {
  key: string;
  label: string;
  value: number;
  unit: string;
  ok: boolean;
}

/** Veredicto del lote completo, definido por el inspector */
export type ProcessVerdict = 'PENDIENTE' | 'ACEPTADO' | 'OBJETADO';

/**
 * Un bloque de pesos de la planilla del packing: una fila de calibre.
 * La planilla anota los pesos agrupados por calibre y por línea de embalaje,
 * y es ahí donde se ve si una línea viene descalibrada. Un promedio global lo
 * esconde: en la planilla del 3-07-2026 el calibre 64 iba 253 g sobre el 72.
 */
export interface WeightGroup {
  id: string;
  caliber: string;      // "72", "105", "1X"…
  line?: string;        // marca de línea de embalaje (la "x" de la planilla)
  weights: number[];    // pesos BRUTOS en kg, tal como los anota el pesador
}

/** Control de peso de cajas (registro independiente del muestreo) */
export interface WeightControl {
  formatLabel: string;   // ej. "Caja 10 kg palta"
  minKg: number;
  maxKg: number;
  weights: number[];     // lista plana: se mantiene por compatibilidad
  updatedAt: string;
  /** Pesos agrupados por calibre y línea (formato nuevo) */
  grupos?: WeightGroup[];
  /** Neto que debe tener la caja al embalar: etiqueta + margen de merma */
  netoObjetivoKg?: number;
  /** Peso de la caja vacía; el pesador anota el bruto */
  taraKg?: number;
}

/** Neto objetivo por defecto: 15,2 kg de etiqueta + 100 g de merma en tránsito */
export const NETO_OBJETIVO_DEFECTO = 15.300;
/** Tara por defecto de la caja de cartón de cítricos */
export const TARA_DEFECTO = 0.850;

/**
 * Peso máximo de un fruto del calibre, en kg, leído de la tabla de calibres.
 * "188 - 230" → 0.230
 */
export function pesoFrutoMaxKg(species: Species, caliber: string, program: CaliberProgram = 'NORMAL'): number | null {
  const objetivo = String(caliber).replace(/calibre/i, '').trim().toUpperCase();
  const tabla = getCalibers(species, program);
  const spec = tabla.find(c => c.caliber.toUpperCase() === objetivo)
            ?? tabla.find(c => (c.costcoLabel ?? '').toUpperCase() === objetivo);
  if (!spec) return null;
  const nums = String(spec.weightGr).match(/\d+/g);
  if (!nums || nums.length === 0) return null;
  return parseInt(nums[nums.length - 1], 10) / 1000;
}

/**
 * Rango de peso BRUTO aceptable para un calibre.
 *
 * El mínimo es igual para todos: el neto que debe salir del packing más la tara.
 * El máximo sube según el calibre porque el llenado no se puede afinar más que
 * de a un fruto: en calibre 40 un fruto pesa 418 g y en calibre 113 solo 120 g,
 * así que exigirles la misma ventana sería imposible de cumplir en los grandes.
 */
export function rangoPesoCalibre(
  species: Species,
  caliber: string,
  netoObjetivoKg = NETO_OBJETIVO_DEFECTO,
  taraKg = TARA_DEFECTO,
  program: CaliberProgram = 'NORMAL'
): { min: number; max: number; pesoFruto: number | null } {
  const min = netoObjetivoKg + taraKg;
  const fruto = pesoFrutoMaxKg(species, caliber, program);
  // Sin dato del calibre se usa una ventana de 250 g, que es lo típico en cítricos
  return { min, max: min + (fruto ?? 0.250), pesoFruto: fruto };
}

/** Formato de caja con su rango de peso aceptable */
export interface BoxFormat {
  id: string;
  label: string;
  minKg: number;
  maxKg: number;
  species?: Species;
}

/** Formatos precargados desde las normas (editables por el usuario) */
export const BOX_FORMATS: BoxFormat[] = [
  { id: 'palta-4', label: 'Palta · caja 4 kg', minKg: 4.150, maxKg: 4.300, species: 'Palta' },
  { id: 'palta-10', label: 'Palta · caja 10 kg', minKg: 10.150, maxKg: 10.300, species: 'Palta' },
  { id: 'citrus-15', label: 'Cítricos · caja 15 kg', minKg: 15.000, maxKg: 15.500 },
  { id: 'citrus-17', label: 'Cítricos · caja 17 kg', minKg: 17.000, maxKg: 17.500 },
  { id: 'custom', label: 'Otro formato (definir rango)', minKg: 0, maxKg: 0 }
];

/** Estadísticas calculadas del control de pesos */
export interface WeightStats {
  total: number;
  promedio: number;
  min: number;
  max: number;
  bajoRango: number;
  sobreRango: number;
  enRango: number;
  pctConforme: number;
}

/** Estadísticas de un bloque de calibre, contra su propio rango */
export interface WeightGroupStats extends WeightStats {
  caliber: string;
  line?: string;
  rangoMin: number;
  rangoMax: number;
  pesoFruto: number | null;
}

export function calcularEstadisticasGrupo(
  g: WeightGroup,
  species: Species,
  netoObjetivoKg = NETO_OBJETIVO_DEFECTO,
  taraKg = TARA_DEFECTO
): WeightGroupStats {
  const { min, max, pesoFruto } = rangoPesoCalibre(species, g.caliber, netoObjetivoKg, taraKg);
  const base = calcularEstadisticasPeso({
    formatLabel: '', minKg: min, maxKg: max, weights: g.weights, updatedAt: ''
  });
  return { ...base, caliber: g.caliber, line: g.line, rangoMin: min, rangoMax: max, pesoFruto };
}

/**
 * Promedio de grados Brix de las cajas que sí tienen medición.
 * Devuelve null cuando no se midió en ninguna, para poder mostrar un guion
 * en vez de un cero que se leería como "Brix 0".
 */
export function promedioBrix(boxes: BoxSampling[] | undefined): { promedio: number; medidas: number } | null {
  const valores = (boxes ?? [])
    .map(b => b.brix)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (valores.length === 0) return null;
  const suma = valores.reduce((a, b) => a + b, 0);
  return { promedio: Math.round((suma / valores.length) * 10) / 10, medidas: valores.length };
}

/** Formatea un Brix para mostrarlo; guion cuando no hay medición */
export function formatearBrix(v: number | null | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v.toFixed(1) : '—';
}

/** Todos los pesos de todos los grupos, en una sola lista */
export function pesosPlanos(grupos: WeightGroup[] | undefined): number[] {
  return (grupos ?? []).flatMap(g => g.weights);
}

export function calcularEstadisticasPeso(w: WeightControl): WeightStats {
  const pesos = w.weights.filter(p => Number.isFinite(p) && p > 0);
  const total = pesos.length;
  if (total === 0) {
    return { total: 0, promedio: 0, min: 0, max: 0, bajoRango: 0, sobreRango: 0, enRango: 0, pctConforme: 0 };
  }
  const suma = pesos.reduce((a, b) => a + b, 0);
  const bajoRango = pesos.filter(p => p < w.minKg).length;
  const sobreRango = pesos.filter(p => p > w.maxKg).length;
  const enRango = total - bajoRango - sobreRango;
  return {
    total,
    promedio: suma / total,
    min: Math.min(...pesos),
    max: Math.max(...pesos),
    bajoRango,
    sobreRango,
    enRango,
    pctConforme: (enRango / total) * 100
  };
}

/**
 * Interpreta un bloque de texto con pesos (pegado desde una transcripción de IA).
 * Acepta separación por comas, espacios, saltos de línea, punto y coma o tabulaciones,
 * y tanto punto como coma decimal. Ignora texto que no sea numérico.
 */
export interface LecturaPesos {
  /** Pesos aceptados, en kilos */
  pesos: number[];
  /** Números que se descartaron por no poder ser el peso de una caja */
  descartados: number[];
}

/**
 * Quita la numeración y las etiquetas que agregan las transcripciones.
 *
 * Una IA transcribiendo la foto de la planilla casi siempre devuelve una lista
 * numerada ("1. 17,2") o rotulada ("Caja 1: 17,2"). Sin esto, el 1 y el 2
 * entraban como si fueran pesos.
 */
function limpiarMarcadoresDeLista(texto: string): string {
  return texto
    // Líneas de resumen con etiqueta en mayúsculas: "PESOS POR BLOQUE: 1, 6, 13…",
    // "TOTAL GENERAL: 127", "DUDOSOS: ninguno". Sin esto, los conteos por bloque
    // (12, 13, 14…) caen dentro del rango de una caja y entran como si fueran pesos.
    .replace(/^[ \t]*[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ]{2,}:.*$/gm, ' ')
    // Líneas de resumen que agrega una IA: "TOTAL: 24", "Promedio: 17,25".
    // Sin esto el 24 entraría como si fuera el peso de una caja.
    .replace(
      /\b(?:total(?:es)?|cantidad|conteo|suma|promedio|media|m[ií]nimo|m[áa]ximo|rango|n[°º]?\s*de\s*(?:cajas|pesos|datos|registros))\b\s*[:=]?\s*\d+(?:[.,]\d+)?/gi,
      ' '
    )
    // Encabezados de la planilla: "CALIBRE 48", "Línea 2", "Turno 1", "Fecha 3-07-2026".
    // Se pega un bloque por calibre, así que el título del bloque viene incluido.
    .replace(/\b(?:calibre|cal\.?|l[ií]nea|linea|turno|fecha|hora|variedad|productor|especie|categor[ií]a|calidad)\s*[:=]?\s*[\d\-\/]+/gi, ' ')
    // "Caja 12:", "caja 12 =", "N° 12 -", "Nro 12"
    .replace(/\b(?:caja|cajas|box|n[°ºo]|nro\.?|num\.?|item)\s*\d{1,4}\s*[:=\-.)]?/gi, ' ')
    // "1.", "2)", "3 -" al inicio de línea o tras un espacio, seguidos de un número
    .replace(/(^|[\n\r\s])\d{1,3}\s*[.)\-]\s+(?=\d)/g, '$1');
}

/**
 * Interpreta un bloque de texto con pesos de cajas, en kilos.
 *
 * FORMATO ACEPTADO
 *   · Separadores: espacio, salto de línea, coma, punto y coma, tabulación, pipe.
 *   · Decimales: punto o coma  →  17.2  ·  17,2  ·  17,200
 *   · Unidades pegadas o sueltas: "17,2 kg", "17.2kg"
 *   · Listas numeradas y rótulos de caja se ignoran.
 *
 * Los valores imposibles para el formato (la numeración de la lista, o un
 * decimal perdido que convierte 17,2 en 172) se descartan y se informan aparte.
 * Un peso legítimamente fuera de rango SÍ entra: es justamente lo que hay que ver.
 */
export function parsearPesosDetallado(
  texto: string,
  rango?: { minKg: number; maxKg: number }
): LecturaPesos {
  if (!texto) return { pesos: [], descartados: [] };

  const numeros = limpiarMarcadoresDeLista(texto)
    .replace(/,(\d{1,3})(?!\d)/g, '.$1')       // coma decimal → punto (17,2 → 17.2)
    .split(/[\s,;|]+/)
    .map(t => t.replace(/[^0-9.]/g, ''))        // limpiar unidades ("17.2kg" → "17.2")
    .filter(t => t !== '' && t !== '.')
    .map(t => parseFloat(t))
    .filter(n => Number.isFinite(n) && n > 0);

  // Banda de lo posible: holgada respecto al rango, para no descartar un peso real
  const min = rango && rango.minKg > 0 ? rango.minKg * 0.6 : 1;
  const max = rango && rango.maxKg > 0 ? rango.maxKg * 1.4 : 40;

  const pesos: number[] = [];
  const descartados: number[] = [];
  for (const n of numeros) {
    if (n >= min && n <= max) pesos.push(n);
    else descartados.push(n);
  }
  return { pesos, descartados };
}

/** Versión simple: solo los pesos aceptados */
export function parsearPesos(texto: string, rango?: { minKg: number; maxKg: number }): number[] {
  return parsearPesosDetallado(texto, rango).pesos;
}

/**
 * Frutos por caja que sugiere un calibre.
 *
 * En naranja, limón y palta el calibre ES el conteo de frutos de la caja
 * (calibre 105 = 105 frutos), así que sirve como valor por defecto.
 * En mandarina los calibres son grados de tamaño (1XX, 1X, 1, 2, 3, 4, 5, 5B)
 * y no dicen nada del conteo: ahí devolvemos null y lo escribe el inspector.
 */
export function frutosSugeridosPorCalibre(
  caliber: string | undefined,
  species: Species
): number | null {
  // Mandarina va primero y sin excepciones: sus calibres 1, 2, 3, 4 y 5 son
  // dígitos puros y se colarían como "caja de 2 frutos", que daría 50% con un
  // solo fruto defectuoso.
  if (species === 'Mandarina') return null;
  if (!caliber) return null;
  const limpio = String(caliber).replace(/calibre/i, '').trim();
  // Solo dígitos: descarta cualquier etiqueta de tamaño (1XX, 2A, 5B…)
  if (!/^\d+$/.test(limpio)) return null;
  const n = parseInt(limpio, 10);
  // Un conteo por caja bajo 10 no existe en packing: es una etiqueta, no un total
  if (!Number.isFinite(n) || n < 10) return null;
  return n;
}

/**
 * Convierte unidades contadas a porcentaje sobre el total de la caja.
 * Redondea a un decimal, que es la precisión con la que se leen las tolerancias.
 */
export function porcentajeDesdeUnidades(unidades: number, totalFrutos: number): number {
  if (!Number.isFinite(unidades) || !Number.isFinite(totalFrutos) || totalFrutos <= 0) return 0;
  return Math.round((unidades / totalFrutos) * 1000) / 10;
}

export interface BoxSampling {
  id: string;
  boxNumber: number;
  inspector?: string;   // quién registró la caja
  editedAt?: string;    // marca de última edición
  program?: CaliberProgram;
  caliber: string;
  caliberLabel?: string;
  /** N° de serie impreso en la etiqueta de packing (campo ID del QR) */
  serie?: string;
  diameterMm?: string;
  weightGr?: string;
  colorGrade?: number | string;
  colorName?: string;
  /**
   * Grados Brix medidos en la caja. Es opcional: no se mide en todas las cajas,
   * y las que no tienen medición quedan fuera del promedio del informe.
   */
  brix?: number;
  /** Frutos evaluados en la caja: base del cálculo de porcentajes */
  totalFrutos?: number;
  status: BoxStatus;
  statusReasons?: string[];
  photos: string[];
  defects: DefectItem[];
  notes: string;
  timestamp: string;
  qrPayload?: Record<string, any>;
}

export interface ProcessData {
  id: string;
  folio?: string;               // folio correlativo del informe
  processNumber: string;
  species: Species;
  variety: string;
  exportCategory: ExportCategory;
  producerCode: string;
  producerName: string;
  csg: string;
  sdp: string;
  receptionDate: string;
  lot: string;
  totalKg: number;
  maturity?: MaturityReading[]; // parámetros de madurez del lote
  weightControl?: WeightControl; // control de peso de cajas del packing
  verdict?: ProcessVerdict;      // decisión del lote (la define el inspector)
  verdictNote?: string;          // justificación de la decisión
  inspector?: string;            // quién realizó la inspección
  createdAt: string;
  updatedAt: string;
  boxes: BoxSampling[];
}

// =============================================================
// CATEGORÍAS DISPONIBLES POR ESPECIE
// =============================================================
export interface CategoryOption {
  value: ExportCategory;
  label: string;
  hint?: string;
}

export const CATEGORIES_BY_SPECIES: Record<Species, CategoryOption[]> = {
  Naranja: [
    { value: 'EXTRA-FANCY', label: 'EXTRA-FANCY', hint: 'Total caja 10%' },
    { value: 'FANCY', label: 'FANCY', hint: 'Total caja 12%' }
  ],
  Mandarina: [
    { value: 'EF-SEM10', label: 'EXTRA-FANCY', hint: '0–10% semillas · total defectos 10%' },
    { value: 'F-SEM10', label: 'CAT 1', hint: '0–10% semillas · total defectos 11%' },
    { value: 'F-SEM20', label: 'FANCY', hint: '11–20% semillas · Canadá/Europa/UK/USA · total 12%' },
    { value: 'F-SEM30', label: 'FANCY LATAM', hint: '21–30% semillas · Latinoamérica · total 14%' }
  ],
  'Limón': [
    { value: 'CHOICE-USA', label: 'CHOICE USA Class N°1', hint: 'Condición total 8%' },
    { value: 'FANCY-USA-J', label: 'FANCY USA (J)', hint: 'Condición total 3%' },
    { value: 'E-FANCY-J', label: 'E-FANCY (J)', hint: 'Condición total 2%' }
  ],
  Palta: [
    { value: 'PALTA-STD', label: 'Estándar Hass', hint: 'Graves 5% · Leves 7% · Total 12%' }
  ]
};

export function getCategoriasDisponibles(species: Species): CategoryOption[] {
  return CATEGORIES_BY_SPECIES[species] || CATEGORIES_BY_SPECIES.Naranja;
}

/** Etiqueta legible de una categoría */
export function getCategoriaLabel(species: Species, cat: ExportCategory): string {
  const found = getCategoriasDisponibles(species).find(c => c.value === cat);
  return found ? found.label : String(cat);
}

// =============================================================
// CALIBRES
// =============================================================
export interface CaliberSpec {
  caliber: string;
  diameterMm: string;
  weightGr: string;
  costcoLabel?: string;
  isSpecialOrder?: boolean;
}

/** NARANJA — tabla 4.2.1 */
export const ORANGE_CALIBERS: CaliberSpec[] = [
  { caliber: '36', diameterMm: '95 - 98', weightGr: '418 - 445' },
  { caliber: '40', diameterMm: '88 - 95', weightGr: '356 - 418' },
  { caliber: '48', diameterMm: '84 - 88', weightGr: '296 - 356' },
  { caliber: '56', diameterMm: '80 - 84', weightGr: '252 - 296' },
  { caliber: '64', diameterMm: '76 - 80', weightGr: '230 - 252' },
  { caliber: '72', diameterMm: '72 - 76', weightGr: '188 - 230' },
  { caliber: '88', diameterMm: '69 - 72', weightGr: '156 - 188' },
  { caliber: '105', diameterMm: '65 - 68', weightGr: '120 - 156' },
  { caliber: '113', diameterMm: '59 - 65', weightGr: '108 - 120' },
  { caliber: '138', diameterMm: '52 - 58', weightGr: '78 - 107', isSpecialOrder: true }
];

/** MANDARINA — tabla estándar */
export const MANDARIN_CALIBERS: CaliberSpec[] = [
  { caliber: '1XX', diameterMm: '74 - 79', weightGr: '147 - 184' },
  { caliber: '1X', diameterMm: '68 - 74', weightGr: '130 - 147' },
  { caliber: '1', diameterMm: '64 - 68', weightGr: '116 - 130' },
  { caliber: '2', diameterMm: '58 - 64', weightGr: '92 - 116' },
  { caliber: '3', diameterMm: '55 - 58', weightGr: '74 - 92' },
  { caliber: '4', diameterMm: '49 - 55', weightGr: '59 - 74' },
  { caliber: '5', diameterMm: '47 - 49', weightGr: '48 - 59' },
  { caliber: '5B', diameterMm: '45 - 46.9', weightGr: '37 - 48', isSpecialOrder: true }
];

/** MANDARINA — programa COSTCO */
export const MANDARIN_COSTCO_CALIBERS: CaliberSpec[] = [
  { costcoLabel: '16', caliber: '1XX', diameterMm: '74 - 79', weightGr: '147 - 184' },
  { costcoLabel: '18', caliber: '1X', diameterMm: '68 - 74', weightGr: '130 - 147' },
  { costcoLabel: '20', caliber: '1', diameterMm: '64 - 68', weightGr: '116 - 130' },
  { costcoLabel: '24', caliber: '2A', diameterMm: '61 - 64', weightGr: '100 - 116' },
  { costcoLabel: '24', caliber: '2B', diameterMm: '59 - 61', weightGr: '92 - 100' },
  { costcoLabel: '32', caliber: '3', diameterMm: '55 - 58', weightGr: '74 - 92' },
  { costcoLabel: '36', caliber: '4A', diameterMm: '51 - 55', weightGr: '65 - 74' },
  { costcoLabel: '36', caliber: '4B', diameterMm: '49 - 51', weightGr: '59 - 65' },
  { costcoLabel: '40', caliber: '5', diameterMm: '47 - 49', weightGr: '48 - 59' },
  { costcoLabel: '6', caliber: '5B', diameterMm: '44 - 46.9', weightGr: '37 - 48', isSpecialOrder: true }
];

/**
 * LIMÓN — tabla de calibres y diámetro para exportación.
 * El peso es referencial: puede variar según el lote.
 * Los calibres 75 y 235 se embalan solo por indicación comercial.
 */
export const LEMON_CALIBERS: CaliberSpec[] = [
  { caliber: '75', diameterMm: '70 - 76', weightGr: '209 - 276', isSpecialOrder: true },
  { caliber: '95', diameterMm: '65 - 69', weightGr: '168 - 208' },
  { caliber: '115', diameterMm: '60 - 64', weightGr: '138 - 167' },
  { caliber: '140', diameterMm: '57 - 59', weightGr: '115 - 137' },
  { caliber: '165', diameterMm: '54 - 56', weightGr: '96 - 114' },
  { caliber: '200', diameterMm: '50 - 53', weightGr: '80 - 95' },
  { caliber: '235', diameterMm: '48 - 49', weightGr: '69 - 79', isSpecialOrder: true }
];

/** PALTA — calibres mercado USA (tabla A) */
export const AVOCADO_USA_CALIBERS: CaliberSpec[] = [
  { caliber: '32', diameterMm: '—', weightGr: '333 - 500' },
  { caliber: '36', diameterMm: '—', weightGr: '303 - 333' },
  { caliber: '40', diameterMm: '—', weightGr: '255 - 303' },
  { caliber: '50', diameterMm: '—', weightGr: '203 - 255' },
  { caliber: '60', diameterMm: '—', weightGr: '171 - 202' },
  { caliber: '70', diameterMm: '—', weightGr: '149 - 170' },
  { caliber: '84', diameterMm: '—', weightGr: '112 - 148' },
  { caliber: '111', diameterMm: '—', weightGr: '80 - 112' }
];

/** PALTA — calibres mercado EUROPA (tabla B) */
export const AVOCADO_EU_CALIBERS: CaliberSpec[] = [
  { caliber: '10', diameterMm: '—', weightGr: '364 - 500' },
  { caliber: '12', diameterMm: '—', weightGr: '309 - 363' },
  { caliber: '14', diameterMm: '—', weightGr: '266 - 308' },
  { caliber: '16', diameterMm: '—', weightGr: '236 - 265' },
  { caliber: '18', diameterMm: '—', weightGr: '211 - 235' },
  { caliber: '20', diameterMm: '—', weightGr: '191 - 210' },
  { caliber: '22', diameterMm: '—', weightGr: '171 - 190' },
  { caliber: '24', diameterMm: '—', weightGr: '156 - 170' },
  { caliber: '26', diameterMm: '—', weightGr: '148 - 155' },
  { caliber: '28', diameterMm: '—', weightGr: '138 - 147' },
  { caliber: '30', diameterMm: '—', weightGr: '128 - 137' },
  { caliber: '32', diameterMm: '—', weightGr: '84 - 127' }
];

/** Programas de calibre disponibles por especie */
export function getProgramasDisponibles(species: Species): { value: CaliberProgram; label: string }[] {
  if (species === 'Mandarina') {
    return [
      { value: 'NORMAL', label: 'Normal' },
      { value: 'COSTCO', label: 'Programa Costco' }
    ];
  }
  if (species === 'Palta') {
    return [
      { value: 'USA', label: 'Mercado USA' },
      { value: 'EUROPA', label: 'Mercado Europa' }
    ];
  }
  return [{ value: 'NORMAL', label: 'Normal' }];
}

export function getCalibers(species: Species, program: CaliberProgram = 'NORMAL'): CaliberSpec[] {
  if (species === 'Mandarina') return program === 'COSTCO' ? MANDARIN_COSTCO_CALIBERS : MANDARIN_CALIBERS;
  if (species === 'Limón') return LEMON_CALIBERS;
  if (species === 'Palta') return program === 'EUROPA' ? AVOCADO_EU_CALIBERS : AVOCADO_USA_CALIBERS;
  return ORANGE_CALIBERS;
}

// =============================================================
// ESCALAS DE COLOR
// =============================================================
export interface ColorGrade {
  grade: number | string;
  name: string;
  hex: string;
  rule: string;
  embalable: boolean;
  isDefect: boolean;
}

/** CÍTRICOS DULCES (naranja y mandarina) — escala 1 a 8 */
export const CITRUS_COLOR_SCALE: ColorGrade[] = [
  { grade: 1, name: 'Naranjo Intenso', hex: '#FF5722', rule: 'Full color', embalable: true, isDefect: false },
  { grade: 2, name: 'Naranjo sin intensidad', hex: '#FF9800', rule: 'Full color', embalable: true, isDefect: false },
  { grade: 3, name: 'Naranjo con visos verdes suaves', hex: '#FFC107', rule: 'Full color', embalable: true, isDefect: false },
  { grade: 4, name: 'Naranjo con visos verdes intensos', hex: '#CDDC39', rule: '20% visos verdes suaves; vira en viaje', embalable: true, isDefect: false },
  { grade: 5, name: 'Verde sin intensidad', hex: '#8BC34A', rule: 'Sobre 21% visos verdes: DEFECTO', embalable: false, isDefect: true },
  { grade: 6, name: 'Verde medianamente intenso', hex: '#4CAF50', rule: 'FRUTA NO EMBALABLE', embalable: false, isDefect: true },
  { grade: 7, name: 'Verde Intenso', hex: '#2E7D32', rule: 'FRUTA NO EMBALABLE', embalable: false, isDefect: true },
  { grade: 8, name: 'Verde Oscuro', hex: '#1B5E20', rule: 'FRUTA NO EMBALABLE', embalable: false, isDefect: true }
];

/** LIMÓN — escala 1 a 7 con subdivisiones; el 1 y el 7 son defecto */
export const LEMON_COLOR_SCALE: ColorGrade[] = [
  { grade: 1, name: 'Naranjo / amarillo anaranjado', hex: '#F5B041', rule: 'DEFECTO (sobremaduro)', embalable: false, isDefect: true },
  { grade: 2, name: 'Amarillo puro', hex: '#F1C40F', rule: 'Embalable', embalable: true, isDefect: false },
  { grade: 3, name: 'Amarillo', hex: '#F4D03F', rule: 'Embalable', embalable: true, isDefect: false },
  { grade: 4, name: 'Amarillo con puntas verdes', hex: '#D4AC0D', rule: 'Embalable', embalable: true, isDefect: false },
  { grade: '5A', name: 'Verde amarillento', hex: '#A2D149', rule: 'Embalable', embalable: true, isDefect: false },
  { grade: '5B', name: 'Verde claro con manchas', hex: '#7CB342', rule: 'Embalable', embalable: true, isDefect: false },
  { grade: '6A', name: 'Verde claro', hex: '#81C784', rule: 'Embalable', embalable: true, isDefect: false },
  { grade: '6B', name: 'Verde medio', hex: '#4CAF50', rule: 'Embalable', embalable: true, isDefect: false },
  { grade: '6C', name: 'Verde oscuro', hex: '#2E7D32', rule: 'Embalable', embalable: true, isDefect: false },
  { grade: 7, name: 'Verde muy oscuro', hex: '#1B5E20', rule: 'DEFECTO / descarte según tonalidad', embalable: false, isDefect: true }
];

/** PALTA — color de cubrimiento (Hass) */
export const AVOCADO_COLOR_SCALE: ColorGrade[] = [
  { grade: 1, name: 'Verde', hex: '#2ECC71', rule: 'Japón/China: 100% verde', embalable: true, isDefect: false },
  { grade: 2, name: 'Pintón', hex: '#27AE60', rule: 'Según indicación comercial', embalable: true, isDefect: false },
  { grade: 3, name: 'Bronceado', hex: '#1E8449', rule: 'Según indicación comercial', embalable: true, isDefect: false },
  { grade: 4, name: 'Negro morado', hex: '#2C3E50', rule: 'Máximo 90% color negro', embalable: true, isDefect: false },
  { grade: 5, name: 'Negro', hex: '#111111', rule: 'Sobre 90% negro: no embalable', embalable: false, isDefect: true }
];

export const ORANGE_COLOR_SCALE = CITRUS_COLOR_SCALE; // compatibilidad

export function getColorScale(species: Species): ColorGrade[] {
  if (species === 'Limón') return LEMON_COLOR_SCALE;
  if (species === 'Palta') return AVOCADO_COLOR_SCALE;
  return CITRUS_COLOR_SCALE;
}

// =============================================================
// DEFECTOS Y TOLERANCIAS
// =============================================================
export interface DefectDef {
  name: string;
  type: DefectCategoryType;
  category: DefectSeverity;
  unit: '%' | 'unidades';
  tolerances: Partial<Record<ExportCategory, number>>;
  /** Si es true, no se suma al total de la caja (ej. Descalibre en limón) */
  excludeFromTotal?: boolean;
  /**
   * El defecto no tiene techo propio: aporta al total de la caja y es ese total
   * el que decide el veredicto. Se usa en los defectos del listado de packing,
   * donde el criterio de rechazo es el volumen de fruta mala, no cada defecto.
   */
  sinTopeIndividual?: boolean;
}

/** Defecto que solo cuenta para el total de la caja */
function sinTope(name: string, type: DefectCategoryType, category: DefectSeverity): DefectDef {
  return { name, type, category, unit: '%', tolerances: {}, sinTopeIndividual: true };
}

/** NARANJA — tabla 4.3 */
export const ORANGE_DEFECTS_LIST: DefectDef[] = [
  { name: 'Categoría Superior', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'EXTRA-FANCY': 5, FANCY: 5 } },
  { name: 'Insectos (Escamas)', type: 'plagas', category: 'grave', unit: '%', tolerances: { 'EXTRA-FANCY': 0, FANCY: 0 } },
  { name: 'Desuniformidad de Color', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 6, FANCY: 10 } },
  { name: 'Fruta Verde', type: 'calidad', category: 'grave', unit: '%', tolerances: { 'EXTRA-FANCY': 5, FANCY: 6 } },
  { name: 'Descalibre', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 6, FANCY: 10 } },
  { name: 'Fumagina', type: 'calidad', category: 'grave', unit: '%', tolerances: { 'EXTRA-FANCY': 0, FANCY: 0 } },
  { name: 'Rugosidad', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 6, FANCY: 10 } },
  { name: 'Deforme', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 6, FANCY: 10 } },
  { name: 'Russet Áspero', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 6, FANCY: 10 } },
  { name: 'Ribbing', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 6, FANCY: 10 } },
  { name: 'Manchas', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 5, FANCY: 10 } },
  { name: 'Ombligo Abierto (> 1 cm²)', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 6, FANCY: 10 } },
  { name: 'Herida Cicatrizada', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'EXTRA-FANCY': 2, FANCY: 2 } },
  { name: 'Sin Pedúnculo', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'EXTRA-FANCY': 6, FANCY: 10 } },
  { name: 'Daño Caracol', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'EXTRA-FANCY': 2, FANCY: 2 } },
  { name: 'Golpe de Sol (20% del fruto)', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 6, FANCY: 10 } },
  { name: 'Pudrición', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EXTRA-FANCY': 0, FANCY: 0 } },
  { name: 'Ombligo Rasgado', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EXTRA-FANCY': 2, FANCY: 4 } },
  { name: 'Ombligo Expuesto', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EXTRA-FANCY': 0, FANCY: 0 } },
  { name: 'Creasing', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 2, FANCY: 4 } },
  { name: 'Partidura / Grietas', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EXTRA-FANCY': 2, FANCY: 2 } },
  { name: 'Pitting', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 2, FANCY: 2 } },
  { name: 'Fruto Blando', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 2, FANCY: 2 } },
  { name: 'Oleocelosis (1 cm²)', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 2, FANCY: 2 } },
  { name: 'Piquetes', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'EXTRA-FANCY': 2, FANCY: 2 } },
  { name: 'Daño Tijeras / Herida Abierta', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EXTRA-FANCY': 2, FANCY: 2 } },

  // --- Planilla de packing: sin tope propio, suman al total de la caja ---
  sinTope('Presencia de Conchuela', 'plagas', 'grave'),
  sinTope('Chanchito Blanco', 'plagas', 'grave'),
  sinTope('Mancha de Agua', 'condicion', 'medio'),
  sinTope('Residuo de Producto', 'calidad', 'leve'),
  sinTope('Mancha de Producto', 'calidad', 'leve'),
  sinTope('Pedúnculo Largo', 'calidad', 'leve'),
  sinTope('Herida de Pedúnculo', 'condicion', 'medio'),
  sinTope('Machucón', 'condicion', 'medio'),
  sinTope('Ombligo Negro', 'condicion', 'grave'),
  sinTope('Quemado de Sol', 'calidad', 'medio'),
  sinTope('Rugosidad Severa', 'calidad', 'medio'),
  sinTope('Quimera', 'calidad', 'leve'),
  sinTope('Daño por Helada', 'condicion', 'grave')
];

/** MANDARINA — 4 categorías según % de semillas */
export const MANDARIN_DEFECTS_LIST: DefectDef[] = [
  { name: 'Residuos Químicos', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EF-SEM10': 0, 'F-SEM10': 0, 'F-SEM20': 0, 'F-SEM30': 0 } },
  { name: 'Polvo / Tierra', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EF-SEM10': 0, 'F-SEM10': 0, 'F-SEM20': 0, 'F-SEM30': 0 } },
  { name: 'Insectos Cuarentenarios', type: 'plagas', category: 'grave', unit: '%', tolerances: { 'EF-SEM10': 0, 'F-SEM10': 0, 'F-SEM20': 0, 'F-SEM30': 0 } },
  { name: 'Ácaros / Insectos Acompañantes', type: 'plagas', category: 'grave', unit: '%', tolerances: { 'EF-SEM10': 0, 'F-SEM10': 0, 'F-SEM20': 0, 'F-SEM30': 0 } },
  { name: 'Pudrición', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EF-SEM10': 0, 'F-SEM10': 0, 'F-SEM20': 0, 'F-SEM30': 0 } },
  { name: 'Herida Abierta', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EF-SEM10': 0, 'F-SEM10': 0, 'F-SEM20': 0, 'F-SEM30': 0 } },
  { name: 'Deshidratación Severa', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EF-SEM10': 0, 'F-SEM10': 0, 'F-SEM20': 0, 'F-SEM30': 0 } },
  { name: 'Fruta Blanda', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EF-SEM10': 0, 'F-SEM10': 0, 'F-SEM20': 0, 'F-SEM30': 0 } },
  { name: 'Creasing Severo', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EF-SEM10': 0, 'F-SEM10': 0, 'F-SEM20': 0, 'F-SEM30': 0 } },
  { name: 'Bufado Severo', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'EF-SEM10': 0, 'F-SEM10': 0, 'F-SEM20': 0, 'F-SEM30': 0 } },
  { name: 'Pedúnculo Largo', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'EF-SEM10': 5, 'F-SEM10': 5, 'F-SEM20': 5, 'F-SEM30': 5 } },
  { name: 'Cuello de Botella', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EF-SEM10': 5, 'F-SEM10': 6, 'F-SEM20': 8, 'F-SEM30': 10 } },
  { name: 'Golpe de Sol', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EF-SEM10': 5, 'F-SEM10': 6, 'F-SEM20': 8, 'F-SEM30': 10 } },
  { name: 'Herida Cicatrizada Leve', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'EF-SEM10': 5, 'F-SEM10': 6, 'F-SEM20': 8, 'F-SEM30': 10 } },
  { name: 'Rugosidad', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EF-SEM10': 5, 'F-SEM10': 6, 'F-SEM20': 8, 'F-SEM30': 10 } },
  { name: 'Fumagina', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EF-SEM10': 5, 'F-SEM10': 6, 'F-SEM20': 8, 'F-SEM30': 10 } },
  { name: 'Descalibre', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EF-SEM10': 4, 'F-SEM10': 5, 'F-SEM20': 6, 'F-SEM30': 10 } },
  { name: 'Russet / Manchas (0,5 cm²)', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'EF-SEM10': 5, 'F-SEM10': 7, 'F-SEM20': 10, 'F-SEM30': 10 } },
  { name: 'Ausencia de Roseta', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'EF-SEM10': 5, 'F-SEM10': 5, 'F-SEM20': 5, 'F-SEM30': 5 } },
  { name: 'Oleocelosis Leve (0,5 cm²)', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'EF-SEM10': 3, 'F-SEM10': 5, 'F-SEM20': 8, 'F-SEM30': 8 } },
  { name: 'Bufado Leve', type: 'condicion', category: 'leve', unit: '%', tolerances: { 'EF-SEM10': 3, 'F-SEM10': 4, 'F-SEM20': 5, 'F-SEM30': 5 } },
  { name: 'Piquetes', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'EF-SEM10': 3, 'F-SEM10': 3, 'F-SEM20': 3, 'F-SEM30': 3 } },

  // --- Planilla de packing: sin tope propio, suman al total de la caja ---
  sinTope('Presencia de Escamas', 'plagas', 'grave'),
  sinTope('Presencia de Conchuela', 'plagas', 'grave'),
  sinTope('Chanchito Blanco', 'plagas', 'grave'),
  sinTope('Mancha de Agua', 'condicion', 'medio'),
  sinTope('Mancha de Producto', 'calidad', 'leve'),
  sinTope('Herida de Pedúnculo', 'condicion', 'medio'),
  sinTope('Herida de Tijera', 'condicion', 'grave'),
  sinTope('Ausencia de Pedúnculo', 'calidad', 'leve'),
  sinTope('Machucón', 'condicion', 'medio'),
  sinTope('Ombligo Rasgado', 'condicion', 'grave'),
  sinTope('Ombligo Abierto', 'calidad', 'medio'),
  sinTope('Ombligo Negro', 'condicion', 'grave'),
  sinTope('Quemado de Sol', 'calidad', 'medio'),
  sinTope('Rugosidad Severa', 'calidad', 'medio'),
  sinTope('Deforme', 'calidad', 'medio'),
  sinTope('Fruto Verde', 'calidad', 'grave'),
  sinTope('Quimera', 'calidad', 'leve'),
  sinTope('Daño por Helada', 'condicion', 'grave'),
  sinTope('Daño de Caracol', 'calidad', 'leve')
];

/** LIMÓN — tablas 13 (calidad) y 14 (condición) */
export const LEMON_DEFECTS_LIST: DefectDef[] = [
  // Calidad
  { name: 'Sin Roseta', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'CHOICE-USA': 100, 'FANCY-USA-J': 100, 'E-FANCY-J': 5 } },
  { name: 'Fruto Deforme', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 15, 'FANCY-USA-J': 8, 'E-FANCY-J': 5 } },
  { name: 'Golpe de Sol', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 15, 'FANCY-USA-J': 5, 'E-FANCY-J': 3 } },
  { name: 'Quemadura de Sol', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 5, 'FANCY-USA-J': 2, 'E-FANCY-J': 2 } },
  { name: 'Herida Cicatrizada', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'CHOICE-USA': 10, 'FANCY-USA-J': 5, 'E-FANCY-J': 5 } },
  { name: 'Pedúnculo Largo', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'CHOICE-USA': 5, 'FANCY-USA-J': 3, 'E-FANCY-J': 2 } },
  { name: 'Russet', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 15, 'FANCY-USA-J': 15, 'E-FANCY-J': 7 } },
  { name: 'Fumagina', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 10, 'FANCY-USA-J': 2, 'E-FANCY-J': 0 } },
  { name: 'Fruto Redondo', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 15, 'FANCY-USA-J': 10, 'E-FANCY-J': 4 } },
  { name: 'Escama', type: 'plagas', category: 'grave', unit: '%', tolerances: { 'CHOICE-USA': 8, 'FANCY-USA-J': 5, 'E-FANCY-J': 0 } },
  { name: 'Botritis en Flor', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 12, 'FANCY-USA-J': 5, 'E-FANCY-J': 1 } },
  { name: 'Insectos Cuarentenarios', type: 'plagas', category: 'grave', unit: '%', tolerances: { 'CHOICE-USA': 0, 'FANCY-USA-J': 0, 'E-FANCY-J': 0 } },
  { name: 'Manchas', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 10, 'FANCY-USA-J': 8, 'E-FANCY-J': 2 } },
  // El Descalibre NO se considera en la sumatoria de la caja (indicación expresa de la norma)
  { name: 'Descalibre', type: 'calidad', category: 'medio', unit: '%', excludeFromTotal: true, tolerances: { 'CHOICE-USA': 10, 'FANCY-USA-J': 10, 'E-FANCY-J': 10 } },
  { name: 'Rugosidad', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 15, 'FANCY-USA-J': 5, 'E-FANCY-J': 5 } },
  { name: 'Pezón Deforme', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 15, 'FANCY-USA-J': 10, 'E-FANCY-J': 5 } },
  { name: 'Cuello de Botella', type: 'calidad', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 15, 'FANCY-USA-J': 10, 'E-FANCY-J': 5 } },
  { name: 'Ácaro de la Yema', type: 'plagas', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 15, 'FANCY-USA-J': 10, 'E-FANCY-J': 5 } },
  // Condición
  { name: 'Deshidratación', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'CHOICE-USA': 0, 'FANCY-USA-J': 0, 'E-FANCY-J': 0 } },
  { name: 'Daño por Helada', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'CHOICE-USA': 0, 'FANCY-USA-J': 0, 'E-FANCY-J': 0 } },
  { name: 'Oleocelosis', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 8, 'FANCY-USA-J': 3, 'E-FANCY-J': 2 } },
  { name: 'Peteca', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 5, 'FANCY-USA-J': 2, 'E-FANCY-J': 0 } },
  { name: 'Sobremaduro (Cuaresmero)', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 5, 'FANCY-USA-J': 0, 'E-FANCY-J': 0 } },
  { name: 'Pudrición', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'CHOICE-USA': 0, 'FANCY-USA-J': 0, 'E-FANCY-J': 0 } },
  { name: 'Herida Abierta', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'CHOICE-USA': 0, 'FANCY-USA-J': 0, 'E-FANCY-J': 0 } },
  { name: 'Piquete', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'CHOICE-USA': 0, 'FANCY-USA-J': 0, 'E-FANCY-J': 0 } },
  { name: 'Machucón', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'CHOICE-USA': 0, 'FANCY-USA-J': 0, 'E-FANCY-J': 0 } },
  { name: 'Daño Mecánico', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'CHOICE-USA': 0, 'FANCY-USA-J': 0, 'E-FANCY-J': 0 } },
  { name: 'Daño de Espina (cicatrizado)', type: 'condicion', category: 'medio', unit: '%', tolerances: { 'CHOICE-USA': 5, 'FANCY-USA-J': 2, 'E-FANCY-J': 0 } }
];

/** PALTA — tabla de tolerancias (graves 5% / leves 7% / total 12%) */
export const AVOCADO_DEFECTS_LIST: DefectDef[] = [
  // Graves
  { name: 'Residuos Químicos', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Pudrición', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Polvo / Tierra / Fumagina', type: 'calidad', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Daño de Helada', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Insectos Cuarentenarios', type: 'plagas', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Daño de Trips (> 2 cm²)', type: 'plagas', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 5 } },
  { name: 'Inserción Desgarrada', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Deformación Severa', type: 'calidad', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Herida Abierta', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Machucones (> 0,5 cm²)', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 2 } },
  { name: 'Daño de Tijera Cicatrizada (> 0,5 cm²)', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 2 } },
  { name: 'Quemado de Sol Severo', type: 'calidad', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Herida Cicatrizada (mordedura roedor)', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Russet Estriado (> 1 cm²)', type: 'calidad', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Russet Suave (> 2 cm²)', type: 'calidad', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 5 } },
  { name: 'Daño de Roce (nivel 4)', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Fruto Etiolado', type: 'calidad', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Deshidratación', type: 'condicion', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Fruta Rojiza', type: 'calidad', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Otra Variedad', type: 'calidad', category: 'grave', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  // Leves
  { name: 'Deformación Leve', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'PALTA-STD': 4 } },
  { name: 'Pedúnculo Desprendido', type: 'condicion', category: 'leve', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Daño de Roce (nivel 3)', type: 'condicion', category: 'leve', unit: '%', tolerances: { 'PALTA-STD': 2 } },
  { name: 'Quimera', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'PALTA-STD': 0 } },
  { name: 'Pedúnculo Largo', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'PALTA-STD': 4 } },
  { name: 'Descalibre', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'PALTA-STD': 2 } },
  { name: 'Golpe de Sol', type: 'calidad', category: 'leve', unit: '%', tolerances: { 'PALTA-STD': 2 } }
];

export function getDefectsList(species: Species): DefectDef[] {
  if (species === 'Mandarina') return MANDARIN_DEFECTS_LIST;
  if (species === 'Limón') return LEMON_DEFECTS_LIST;
  if (species === 'Palta') return AVOCADO_DEFECTS_LIST;
  return ORANGE_DEFECTS_LIST;
}

/** Tolerancia individual del defecto en la categoría del proceso */
export function getTolerance(
  def: { tolerances?: Partial<Record<ExportCategory, number>>; tolerance?: number },
  category: ExportCategory
): number {
  if (def.tolerances && def.tolerances[category] !== undefined) return def.tolerances[category] as number;
  if (typeof def.tolerance === 'number') return def.tolerance;
  return 0;
}

/** Total máximo de defectos permitido en la caja */
export function getMaxTotalCaja(species: Species, category: ExportCategory): number {
  if (species === 'Mandarina') {
    const m: Record<string, number> = { 'EF-SEM10': 10, 'F-SEM10': 11, 'F-SEM20': 12, 'F-SEM30': 14 };
    return m[category] ?? 12;
  }
  if (species === 'Limón') {
    // La norma fija el total por CONDICIÓN; se usa como techo de la caja
    const m: Record<string, number> = { 'CHOICE-USA': 8, 'FANCY-USA-J': 3, 'E-FANCY-J': 2 };
    return m[category] ?? 8;
  }
  if (species === 'Palta') return 12;
  return category === 'EXTRA-FANCY' ? 10 : 12;
}

/** Total máximo de defectos de CALIDAD */
export function getMaxCalidad(species: Species, category: ExportCategory): number {
  if (species === 'Mandarina') {
    const m: Record<string, number> = { 'EF-SEM10': 10, 'F-SEM10': 11, 'F-SEM20': 12, 'F-SEM30': 14 };
    return m[category] ?? 12;
  }
  if (species === 'Limón') return 100; // la norma no fija techo de calidad, solo por defecto individual
  if (species === 'Palta') return 7;   // total defectos leves
  return category === 'EXTRA-FANCY' ? 7 : 12;
}

/** Palta: techo específico de defectos graves */
export function getMaxGraves(species: Species): number | null {
  return species === 'Palta' ? 5 : null;
}

// =============================================================
// PARÁMETROS DE MADUREZ POR ESPECIE
// =============================================================
export interface MaturityParam {
  key: string;
  label: string;
  unit: string;
  min?: number;
  max?: number;
  help: string;
}

export const MATURITY_BY_SPECIES: Record<Species, MaturityParam[]> = {
  Naranja: [
    { key: 'brix', label: 'Sólidos solubles', unit: '°Bx', min: 9, help: '≥10 Japón/Corea temprano · ≥9,0 USA/Canadá/Europa' },
    { key: 'acidez', label: 'Acidez total', unit: '%', max: 1.45, help: '≤1,45 Japón/Corea temprano · ≤1,4 resto' },
    { key: 'ratio', label: 'Relación SS/AT', unit: '', min: 7.5, help: '≥8,0 Japón/Corea · ≥9,1 USA · ≥7,5 Canadá/Europa. Bajo 7,9 queda en guarda' }
  ],
  Mandarina: [
    { key: 'brix', label: 'Sólidos solubles', unit: '°Bx', min: 9, help: "10° Walmart/Sam's · 9,0° USA y otros mercados" },
    { key: 'acidez', label: 'Acidez (ác. cítrico)', unit: '%', max: 1.4, help: '1,0% Walmart · 0,90–1,4% USA · 0,85–1,4% otros' },
    { key: 'ratio', label: 'Relación SS/Acidez', unit: '', min: 7, help: "≥9,0 Walmart/Sam's · ≥7,0 USA y otros · máximo 14,0" },
    { key: 'jugo', label: 'Contenido de jugo', unit: '%', min: 40, help: 'Igual o superior a 40%' }
  ],
  'Limón': [
    { key: 'presion', label: 'Resistencia a la presión', unit: 'lbs', min: 6, help: '<4 no cosechar · 4–6 cosechar con extremo cuidado · ≥6 normal' },
    { key: 'jugo', label: 'Contenido de jugo', unit: '%', min: 30, help: 'Parámetro de madurez de cosecha' }
  ],
  Palta: [
    { key: 'materiaSeca', label: 'Materia seca (promedio)', unit: '%', min: 23, help: '≥23% Europa/Japón · ≥22% USA. Muestra de 5 frutos' },
    { key: 'frutosBajo21', label: 'Frutos bajo 21% MS', unit: 'frutos', max: 1, help: 'Rechazo: 1 fruto (Europa/Japón) · 2 frutos (USA)' }
  ]
};

export function getMaturityParams(species: Species): MaturityParam[] {
  return MATURITY_BY_SPECIES[species] || [];
}

/** Evalúa si una lectura de madurez cumple el criterio */
export function evaluarMadurez(param: MaturityParam, valor: number): boolean {
  if (param.min !== undefined && valor < param.min) return false;
  if (param.max !== undefined && valor > param.max) return false;
  return true;
}

export const GENERAL_TOLERANCES = {
  maxColorDisuniformityPct: 10,
  maxDescalibrePct: 10
};
