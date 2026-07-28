export type DefectSeverity = 'grave' | 'medio' | 'leve';
export type DefectCategoryType = 'calidad' | 'condicion' | 'plagas';
export type ExportCategory = 'EXTRA-FANCY' | 'FANCY';
export type BoxStatus = 'APROBADA' | 'OBJETADA';

export interface DefectItem {
  id: string;
  name: string;
  category: DefectSeverity;
  type: DefectCategoryType;
  countOrPercentage: number;
  unit: '%' | 'unidades';
  toleranceExtraFancy: number;
  toleranceFancy: number;
}

export interface BoxSampling {
  id: string;
  boxNumber: number; // Correlativo (1, 2, 3...)
  caliber: string; // Ej. "Calibre 88", "Calibre 56"
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
  species: string; // Ej. "Naranja"
  variety: string; // Ej. "Fukumoto", "Lane Late", "Cara Cara"
  exportCategory: ExportCategory; // "EXTRA-FANCY" | "FANCY"
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

// -------------------------------------------------------------
// ESPECIFICACIONES TÉCNICAS NARANJA (Tablas FRUSTOCK 4.2.1, 4.3, 5.1.1)
// -------------------------------------------------------------

export interface OrangeCaliberSpec {
  caliber: string;
  diameterMm: string;
  weightGr: string;
  isSpecialOrder?: boolean;
}

export const ORANGE_CALIBERS: OrangeCaliberSpec[] = [
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

export interface OrangeColorGrade {
  grade: number;
  name: string;
  hex: string;
  isLackingColor?: boolean;
}

export const ORANGE_COLOR_SCALE: OrangeColorGrade[] = [
  { grade: 1, name: '1. Naranjo Intenso (Rojo Naranja)', hex: '#FF5722' },
  { grade: 2, name: '2. Naranjo sin intensidad', hex: '#FF9800' },
  { grade: 3, name: '3. Naranjo con visos verdes suaves', hex: '#FFC107' },
  { grade: 4, name: '4. Naranjo con visos verdes intensos (Falto de Color)', hex: '#CDDC39', isLackingColor: true },
  { grade: 5, name: '5. Verde sin intensidad', hex: '#8BC34A' },
  { grade: 6, name: '6. Verde medianamente intenso', hex: '#4CAF50' },
  { grade: 7, name: '7. Verde Intenso', hex: '#2E7D32' },
  { grade: 8, name: '8. Verde Oscuro', hex: '#1B5E20' }
];

export interface OrangeDefectDef {
  name: string;
  type: DefectCategoryType;
  category: DefectSeverity;
  toleranceExtraFancy: number;
  toleranceFancy: number;
  unit: '%' | 'unidades';
}

export const ORANGE_DEFECTS_LIST: OrangeDefectDef[] = [
  // DEFECTOS DE CALIDAD
  { name: 'Desuniformidad De Color', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, unit: '%' },
  { name: 'Fruta Verde', type: 'calidad', category: 'grave', toleranceExtraFancy: 5, toleranceFancy: 6, unit: '%' },
  { name: 'Descalibre', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, unit: '%' },
  { name: 'Fumagina', type: 'calidad', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, unit: '%' },
  { name: 'Rugosidad', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, unit: '%' },
  { name: 'Deforme', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, unit: '%' },
  { name: 'Russet Áspero', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, unit: '%' },
  { name: 'Ribbing', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, unit: '%' },
  { name: 'Manchas', type: 'calidad', category: 'medio', toleranceExtraFancy: 5, toleranceFancy: 10, unit: '%' },
  { name: 'Ombligo Abierto (> 1 Cm²)', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, unit: '%' },
  { name: 'Herida Cicatrizada', type: 'calidad', category: 'leve', toleranceExtraFancy: 2, toleranceFancy: 2, unit: '%' },
  { name: 'Sin Pedúnculo', type: 'calidad', category: 'leve', toleranceExtraFancy: 6, toleranceFancy: 10, unit: '%' },
  { name: 'Daño Caracol', type: 'calidad', category: 'leve', toleranceExtraFancy: 2, toleranceFancy: 2, unit: '%' },
  { name: 'Golpe De Sol (20% Fruto Afectado)', type: 'calidad', category: 'medio', toleranceExtraFancy: 6, toleranceFancy: 10, unit: '%' },
  { name: 'Insectos (Escamas)', type: 'plagas', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, unit: '%' },

  // DAÑOS Y DEFECTOS DE CONDICIÓN
  { name: 'Pudrición', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, unit: '%' },
  { name: 'Ombligo Rasgado', type: 'condicion', category: 'grave', toleranceExtraFancy: 2, toleranceFancy: 4, unit: '%' },
  { name: 'Ombligo Expuesto', type: 'condicion', category: 'grave', toleranceExtraFancy: 0, toleranceFancy: 0, unit: '%' },
  { name: 'Creasing', type: 'condicion', category: 'medio', toleranceExtraFancy: 2, toleranceFancy: 4, unit: '%' },
  { name: 'Partidura / Grietas', type: 'condicion', category: 'grave', toleranceExtraFancy: 2, toleranceFancy: 2, unit: '%' },
  { name: 'Pitting', type: 'condicion', category: 'medio', toleranceExtraFancy: 2, toleranceFancy: 2, unit: '%' },
  { name: 'Fruto Blando', type: 'condicion', category: 'medio', toleranceExtraFancy: 2, toleranceFancy: 2, unit: '%' },
  { name: 'Oleocelosis (1 Cm²)', type: 'condicion', category: 'medio', toleranceExtraFancy: 2, toleranceFancy: 2, unit: '%' },
  { name: 'Piquetes', type: 'condicion', category: 'medio', toleranceExtraFancy: 2, toleranceFancy: 2, unit: '%' },
  { name: 'Daño Tijeras / Herida Abierta', type: 'condicion', category: 'grave', toleranceExtraFancy: 2, toleranceFancy: 2, unit: '%' }
];

export const GENERAL_TOLERANCES = {
  maxColorDisuniformityPct: 10, // > 10% OBJETADA
  maxDescalibrePct: 10, // >= 10% OBJETADA
  maxTotalCalidadExtraFancy: 7,
  maxTotalCalidadFancy: 12,
  maxTotalCajaExtraFancy: 10,
  maxTotalCajaFancy: 12
};
