export type DefectSeverity = 'grave' | 'medio' | 'leve';
export type DefectCategoryType = 'calidad' | 'condicion' | 'plagas';
export type ExportCategory = 'EXTRA-FANCY' | 'FANCY' | 'FANCY-LATAM';
export type BoxStatus = 'APROBADA' | 'OBJETADA';
export type Species = 'Naranja' | 'Mandarina';
export type CaliberProgram = 'NORMAL' | 'COSTCO';

export interface DefectItem {
  id: string;
  name: string;
  category: DefectSeverity;
  type: DefectCategoryType;
  countOrPercentage: number;
  unit: '%' | 'unidades';
  toleranceExtraFancy: number;
  toleranceFancy: number;
  toleranceFancyLatam: number;
}

export interface BoxSampling {
  id: string;
  boxNumber: number; // Correlativo (1, 2, 3...)
  program?: CaliberProgram; // NORMAL o COSTCO (aplica a mandarina)
  caliber: string; // Ej. "Calibre 88", "Calibre 2A"
  caliberLabel?: string; // Rótulo mostrado (ej. Costco "24")
  diameterMm?: string; // Ej. "69 - 72 mm"
  weightGr?: string; // Ej. "156 - 188 gr"
  colorGrade?: number; // Escala 1 al 8
  colorName?: string;
  status: BoxStatus; // APROBADA | OBJETADA
  statusReasons?: string[]; // Razones si queda objetada
  photos: string[];
  defects: DefectItem[];
  notes: string;
  timestamp: string;
  qrPayload?: Record<string, any>;
}

export interface ProcessData {
  id: string;
  processNumber: string;
  species: Species; // "Naranja" | "Mandarina"
  variety: string; // Ej. "Fukumoto", "W. Murcott", "Clemenules"
  exportCategory: ExportCategory; // "EXTRA-FANCY" | "FANCY" | "FANCY-LATAM"
  producerCode: string;
  producerName: string;
  csg: string;
  sdp: string;
  receptionDate: string;
  lot: string;
  totalKg: number;
  createdAt: string;
  updatedAt: string;
  boxes: BoxSampling[];
}

// =============================================================
// ESPECIFICACIONES TÉCNICAS — común a cítricos
// =============================================================

export interface CaliberSpec {
  caliber: string;       // Calibre USA-LAT (ej. "88", "2A", "1XX")
  diameterMm: string;    // "69 - 72"
  weightGr: string;      // "156 - 188"
  costcoLabel?: string;  // Rótulo Costco (ej. "24", "36")
  isSpecialOrder?: boolean;
}

// -------------------------------------------------------------
// NARANJA — Tabla de calibres (4.2.1)
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// MANDARINA — Tabla de calibres NORMAL (foto 2)
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// MANDARINA — Tabla de calibres PROGRAMA COSTCO (foto 3)
// El rótulo Costco puede mapear a subcalibres (2A/2B, 4A/4B).
// -------------------------------------------------------------
export const MANDARIN_COSTCO_CALIBERS: CaliberSpec[] = [
  { costcoLabel: '16', caliber: '1XX', diameterMm: '74 - 79', weightGr: '147 - 184' },
  { costcoLabel: '18', caliber: '1X', diameterMm: '68 - 74', weightGr: '130 - 147' },
  { costcoLabel: '20', caliber: '1', diameterMm: '64 - 68', weightGr: '116 - 130' },
  { costcoLabel: '24', caliber: '2A', diameterMm: '61 - 64', weightGr: '100 - 116' },
  { costcoLabel: '24', caliber: '2B', diameterMm: '58 - 61', weightGr: '92 - 100' },
  { costcoLabel: '32', caliber: '3', diameterMm: '55 - 58', weightGr: '74 - 92' },
  { costcoLabel: '36', caliber: '4A', diameterMm: '51 - 55', weightGr: '65 - 74' },
  { costcoLabel: '36', caliber: '4B', diameterMm: '49 - 51', weightGr: '59 - 65' },
  { costcoLabel: '40', caliber: '5', diameterMm: '47 - 49', weightGr: '48 - 59' },
  { costcoLabel: '6', caliber: '5B', diameterMm: '44 - 46.9', weightGr: '37 - 48', isSpecialOrder: true }
];

// Selector de tabla de calibres según especie y programa
export function getCalibers(species: Species, program: CaliberProgram = 'NORMAL'): CaliberSpec[] {
  if (species === 'Mandarina') {
    return program === 'COSTCO' ? MANDARIN_COSTCO_CALIBERS : MANDARIN_CALIBERS;
  }
  return ORANGE_CALIBERS;
}

// -------------------------------------------------------------
// ESCALA DE COLOR CÍTRICOS (foto 1) — con reglas de embalaje
// grados 1-4 embalables; grado 5 = defecto (>21% visos verdes);
// grados 6-8 = FRUTA NO EMBALABLE
// -------------------------------------------------------------
export interface CitrusColorGrade {
  grade: number;
  name: string;
  hex: string;
  rule: string;
  embalable: boolean;   // false => no debe embalarse
  isDefect: boolean;    // true => cuenta como defecto de condición
}

export const CITRUS_COLOR_SCALE: CitrusColorGrade[] = [
  { grade: 1, name: 'Naranjo Intenso', hex: '#FF5722', rule: 'Full color', embalable: true, isDefect: false },
  { grade: 2, name: 'Naranjo sin intensidad', hex: '#FF9800', rule: 'Full color', embalable: true, isDefect: false },
  { grade: 3, name: 'Naranjo con visos verdes suaves', hex: '#FFC107', rule: 'Full color', embalable: true, isDefect: false },
  { grade: 4, name: 'Naranjo con visos verdes intensos', hex: '#CDDC39', rule: 'Fruta con 20% visos verdes suaves; termina de virar en viaje', embalable: true, isDefect: false },
  { grade: 5, name: 'Verde sin intensidad', hex: '#8BC34A', rule: 'Sobre 21% visos verdes intensos: calificada como DEFECTO', embalable: false, isDefect: true },
  { grade: 6, name: 'Verde medianamente intenso', hex: '#4CAF50', rule: 'FRUTA NO EMBALABLE', embalable: false, isDefect: true },
  { grade: 7, name: 'Verde Intenso', hex: '#2E7D32', rule: 'FRUTA NO EMBALABLE', embalable: false, isDefect: true },
  { grade: 8, name: 'Verde Oscuro', hex: '#1B5E20', rule: 'FRUTA NO EMBALABLE', embalable: false, isDefect: true }
];

// Compatibilidad: alias usado por código previo
export const ORANGE_COLOR_SCALE = CITRUS_COLOR_SCALE;

// -------------------------------------------------------------
// DEFECTOS
// -------------------------------------------------------------
export interface DefectDef {
  name: string;
  type: DefectCategoryType;
  category: DefectSeverity;
  toleranceExtraFancy: number;
  toleranceFancy: number;
  toleranceFancyLatam: number;
  unit: '%' | 'unidades';
}

// NARANJA (tabla 4.3) — mantiene su lista; se añade la 3ª columna igual a Fancy
export const ORANGE_DEFECTS_LIST: DefectDef[] = [
  { name: 'Desuniformidad De Color', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Fruta Verde', type: 'calidad', category: 'grave', toleranceExtraFancy: 5, toleranceFancy: 6, toleranceFancyLatam: 6, unit: '%' },
  { name: 'Descalibre', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Fumagina', type: 'calidad', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Rugosidad', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Deforme', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Russet Áspero', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Ribbing', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Manchas', type: 'calidad', category: 'medio', toleranceExtraFancy: 5, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Ombligo Abierto (> 1 Cm²)', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Herida Cicatrizada', type: 'calidad', category: 'leve', toleranceExtraFancy: 2, toleranceFancy: 2, toleranceFancyLatam: 2, unit: '%' },
  { name: 'Sin Pedúnculo', type: 'calidad', category: 'leve', toleranceExtraFancy: 6, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Daño Caracol', type: 'calidad', category: 'leve', toleranceExtraFancy: 2, toleranceFancy: 2, toleranceFancyLatam: 2, unit: '%' },
  { name: 'Golpe De Sol (20% Fruto Afectado)', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Insectos (Escamas)', type: 'plagas', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Pudrición', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Ombligo Rasgado', type: 'condicion', category: 'grave', toleranceExtraFancy: 2, toleranceFancy: 4, toleranceFancyLatam: 4, unit: '%' },
  { name: 'Ombligo Expuesto', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Creasing', type: 'condicion', category: 'medio', toleranceExtraFancy: 2, toleranceFancy: 4, toleranceFancyLatam: 4, unit: '%' },
  { name: 'Partidura / Grietas', type: 'condicion', category: 'grave', toleranceExtraFancy: 2, toleranceFancy: 2, toleranceFancyLatam: 2, unit: '%' },
  { name: 'Pitting', type: 'condicion', category: 'medio', toleranceExtraFancy: 2, toleranceFancy: 2, toleranceFancyLatam: 2, unit: '%' },
  { name: 'Fruto Blando', type: 'condicion', category: 'medio', toleranceExtraFancy: 2, toleranceFancy: 2, toleranceFancyLatam: 2, unit: '%' },
  { name: 'Oleocelosis (1 Cm²)', type: 'condicion', category: 'medio', toleranceExtraFancy: 2, toleranceFancy: 2, toleranceFancyLatam: 2, unit: '%' },
  { name: 'Piquetes', type: 'condicion', category: 'medio', toleranceExtraFancy: 2, toleranceFancy: 2, toleranceFancyLatam: 2, unit: '%' },
  { name: 'Daño Tijeras / Herida Abierta', type: 'condicion', category: 'grave', toleranceExtraFancy: 2, toleranceFancy: 2, toleranceFancyLatam: 2, unit: '%' }
];

// MANDARINA (foto 4) — 3 columnas: Extra-Fancy / Fancy / Fancy-Latam
export const MANDARIN_DEFECTS_LIST: DefectDef[] = [
  { name: 'Residuos Químicos', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Polvo / Tierra', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Insectos Cuarentenarios', type: 'plagas', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Ácaros / Insectos Acompañantes', type: 'plagas', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Pudrición', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Herida Abierta', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Deshidratación Severa', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Fruta Blanda', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Creasing Severo', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Bufado Severo', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, toleranceFancyLatam: 0, unit: '%' },
  { name: 'Pedúnculo Largo', type: 'calidad', category: 'leve', toleranceExtraFancy: 5, toleranceFancy: 5, toleranceFancyLatam: 5, unit: '%' },
  { name: 'Cuello de Botella', type: 'calidad', category: 'medio', toleranceExtraFancy: 5, toleranceFancy: 8, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Golpe de Sol', type: 'calidad', category: 'medio', toleranceExtraFancy: 5, toleranceFancy: 8, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Herida Cicatrizada Leve', type: 'calidad', category: 'leve', toleranceExtraFancy: 5, toleranceFancy: 8, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Rugosidad', type: 'calidad', category: 'medio', toleranceExtraFancy: 5, toleranceFancy: 8, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Fumagina', type: 'calidad', category: 'medio', toleranceExtraFancy: 5, toleranceFancy: 8, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Descalibre', type: 'calidad', category: 'medio', toleranceExtraFancy: 4, toleranceFancy: 6, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Russet / Manchas (0,5 Cm²)', type: 'calidad', category: 'medio', toleranceExtraFancy: 5, toleranceFancy: 10, toleranceFancyLatam: 10, unit: '%' },
  { name: 'Ausencia de Roseta', type: 'calidad', category: 'leve', toleranceExtraFancy: 5, toleranceFancy: 5, toleranceFancyLatam: 5, unit: '%' },
  { name: 'Oleocelosis Leve (0,5 Cm²)', type: 'condicion', category: 'medio', toleranceExtraFancy: 3, toleranceFancy: 8, toleranceFancyLatam: 8, unit: '%' },
  { name: 'Bufado Leve', type: 'condicion', category: 'leve', toleranceExtraFancy: 3, toleranceFancy: 5, toleranceFancyLatam: 5, unit: '%' },
  { name: 'Piquetes', type: 'condicion', category: 'medio', toleranceExtraFancy: 3, toleranceFancy: 3, toleranceFancyLatam: 3, unit: '%' }
];

// Selector de lista de defectos por especie
export function getDefectsList(species: Species): DefectDef[] {
  return species === 'Mandarina' ? MANDARIN_DEFECTS_LIST : ORANGE_DEFECTS_LIST;
}

// Totales máximos de defectos en la caja por categoría (% total de la caja)
export function getMaxTotalCaja(species: Species, category: ExportCategory): number {
  if (species === 'Mandarina') {
    if (category === 'EXTRA-FANCY') return 10;
    if (category === 'FANCY') return 12;
    return 14; // FANCY-LATAM
  }
  // Naranja
  if (category === 'EXTRA-FANCY') return 10;
  return 12;
}

// Total máximo de defectos de CALIDAD por categoría
export function getMaxCalidad(species: Species, category: ExportCategory): number {
  if (species === 'Mandarina') {
    if (category === 'EXTRA-FANCY') return 7;
    if (category === 'FANCY') return 10;
    return 12; // FANCY-LATAM
  }
  if (category === 'EXTRA-FANCY') return 7;
  return 12;
}

// Devuelve la tolerancia individual de un defecto según la categoría
export function getTolerance(def: { toleranceExtraFancy: number; toleranceFancy: number; toleranceFancyLatam: number }, category: ExportCategory): number {
  if (category === 'EXTRA-FANCY') return def.toleranceExtraFancy;
  if (category === 'FANCY') return def.toleranceFancy;
  return def.toleranceFancyLatam;
}

export const GENERAL_TOLERANCES = {
  maxColorDisuniformityPct: 10,
  maxDescalibrePct: 10
};
