export type DefectSeverity = 'grave' | 'medio' | 'leve';

export interface DefectItem {
  id: string;
  name: string;
  category: DefectSeverity;
  countOrPercentage: number;
  unit: '%' | 'unidades';
}

export interface BoxSampling {
  id: string;
  boxNumber: number; // Correlativo (1, 2, 3...)
  caliber: string; // Ej. "Calibre 88", "Calibre 56", "Jumbo", "XL"
  photos: string[]; // Base64 or DataURIs of photos
  defects: DefectItem[];
  notes: string;
  timestamp: string;
  qrPayload?: Record<string, any>; // Modular data from QR Scanner (Phase 2)
}

export interface ProcessData {
  id: string;
  processNumber: string; // Número de proceso
  variety: string; // Variedad (ej. "Royal Dawn", "Lapins", "Hass")
  producerCode: string; // Código Productor
  producerName: string; // Productor
  csg: string; // CSG (Código SAG Predio)
  sdp: string; // SDP (Sitio de Inspección)
  receptionDate: string; // Fecha de recepción
  lot: string; // Lote
  totalKg: number; // Kg totales
  createdAt: string;
  updatedAt: string;
  boxes: BoxSampling[];
}

export const COMMON_DEFECT_PRESETS: Omit<DefectItem, 'id' | 'countOrPercentage'>[] = [
  { name: 'Pudrición / Hongos', category: 'grave', unit: '%' },
  { name: 'Herida Abierta / Fruto Partido', category: 'grave', unit: '%' },
  { name: 'Daño por Pájaro / Insecto', category: 'grave', unit: '%' },
  { name: 'Piel de Lagarto / Russeting', category: 'medio', unit: '%' },
  { name: 'Machucón / Daño Mecánico', category: 'medio', unit: '%' },
  { name: 'Deshidratación de Pedicelo', category: 'medio', unit: '%' },
  { name: 'Falta de Color', category: 'leve', unit: '%' },
  { name: 'Manchas Superficiales', category: 'leve', unit: '%' },
  { name: 'Pedicelo Corto / Ausente', category: 'leve', unit: 'unidades' },
];

export const CALIBER_PRESETS = [
  'Calibre 36',
  'Calibre 48',
  'Calibre 56',
  'Calibre 70',
  'Calibre 84',
  'Calibre 88',
  'Calibre 100',
  'Jumbo',
  'Super Jumbo',
  'Extra Jumbo',
  'L (Large)',
  'XL (Extra Large)'
];
