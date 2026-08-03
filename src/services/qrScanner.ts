import { BoxSampling, ProcessData, Species } from '../types/process';

/**
 * Lectura de etiquetas QR de packing (formato FRUSTOCK).
 *
 * Formato real leído desde una etiqueta de Agroindustrial Vista Hermosa:
 * {"caja":{"ID":3198281,"Esp":"NA","Var":"LA","Cat":"C1","Cal":"72",
 *          "NProc":220,"Pro":"109121","Alt3":"46629","Fri":108181,
 *          "Lote":"F00137","FP":"2026-07-31","Exp":"172963", ...}}
 */

export interface QRPackingPayload {
  raw: string;
  // Datos de proceso
  processNumber?: string;   // NProc  → N° de proceso
  species?: Species;        // Esp    → NA = Naranja, MA = Mandarina
  variety?: string;         // Var    → código de variedad
  producerCode?: string;    // Pro    → código productor
  csg?: string;             // Pro/Alt1 → CSG
  sdp?: string;             // Alt3   → SDP
  lot?: string;             // Lote
  receptionDate?: string;   // FP     → fecha de proceso (yyyy-mm-dd)
  exporterCode?: string;    // Exp    → CSE exportador
  packingCode?: string;     // Fri    → CSP packing
  // Datos de caja
  caliber?: string;         // Cal    → calibre
  boxSerial?: string;       // ID     → identificador de caja
  plu?: string;             // Plu
  shift?: string;           // Turno
  line?: string;            // Linea
  labelCategory?: string;   // Cat    → C1 (categoría impresa en la etiqueta)
  timestamp?: string;
}

/** Códigos de especie de la etiqueta → especie de la app */
const MAPA_ESPECIE: Record<string, Species> = {
  NA: 'Naranja',
  NAV: 'Naranja',
  MA: 'Mandarina',
  MAN: 'Mandarina'
};

/** Códigos de variedad conocidos → nombre legible (ampliable según se detecten) */
const MAPA_VARIEDAD: Record<string, string> = {
  LA: 'Lane Late',
  FK: 'Fukumoto',
  NW: 'Navelina',
  CC: 'Cara Cara',
  VL: 'Valencia Late',
  WM: 'W. Murcott',
  CL: 'Clemenules',
  TG: 'Tango'
};

function str(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  return String(v).trim();
}

export class QRScannerService {
  /**
   * Interpreta el contenido de un QR de etiqueta de packing.
   * Soporta el formato JSON {"caja":{...}}, JSON plano y el formato con pipes.
   */
  static parsePackingTag(qrRaw: string): QRPackingPayload {
    const base: QRPackingPayload = { raw: qrRaw, timestamp: new Date().toISOString() };
    if (!qrRaw || !qrRaw.trim()) return base;

    const texto = qrRaw.trim();

    try {
      // ---- Formato JSON (el que usan las etiquetas actuales) ----
      if (texto.startsWith('{')) {
        const parsed = JSON.parse(texto);
        const c = parsed.caja || parsed.box || parsed;

        const espRaw = str(c.Esp)?.toUpperCase();
        const varRaw = str(c.Var) || str(c.VEti);

        return {
          ...base,
          processNumber: str(c.NProc) || str(c.nproc) || str(c.proceso),
          species: espRaw ? MAPA_ESPECIE[espRaw] : undefined,
          variety: varRaw ? (MAPA_VARIEDAD[varRaw.toUpperCase()] || varRaw) : undefined,
          producerCode: str(c.Pro) || str(c.Alt1),
          csg: str(c.Pro) || str(c.Alt1) || str(c.CSG),
          sdp: str(c.Alt3) || str(c.Cua) || str(c.SDP),
          lot: str(c.Lote) || str(c.lote),
          receptionDate: str(c.FP) || str(c.fecha),
          exporterCode: str(c.Exp),
          packingCode: str(c.Fri),
          caliber: str(c.Cal) || str(c.calibre),
          boxSerial: str(c.ID) || str(c.id),
          plu: str(c.Plu),
          shift: str(c.Turno),
          line: str(c.Linea),
          labelCategory: str(c.Cat)
        };
      }

      // ---- Formato con pipes: "FRUSTOCK|CAL:88|LOT:2026-A|PROD:402|SN:99201" ----
      if (texto.includes('|')) {
        const data: Record<string, string> = {};
        texto.split('|').forEach(p => {
          const [k, v] = p.split(':');
          if (k && v) data[k.trim().toUpperCase()] = v.trim();
        });
        return {
          ...base,
          caliber: data['CAL'] || data['CALIBRE'],
          lot: data['LOT'] || data['LOTE'],
          producerCode: data['PROD'] || data['CSG'],
          csg: data['CSG'] || data['PROD'],
          boxSerial: data['SN'] || data['SERIAL'],
          processNumber: data['PROC'] || data['NPROC']
        };
      }
    } catch (e) {
      console.warn('No se pudo interpretar el contenido del QR:', e);
    }

    return base;
  }

  /** ¿La lectura trajo información utilizable? */
  static tieneDatos(p: QRPackingPayload): boolean {
    return Boolean(p.processNumber || p.lot || p.caliber || p.producerCode);
  }

  /** Convierte la lectura en datos de proceso para prellenar el formulario */
  static toProcessData(p: QRPackingPayload): Partial<ProcessData> {
    const out: Partial<ProcessData> = {};
    if (p.processNumber) out.processNumber = p.processNumber;
    if (p.species) out.species = p.species;
    if (p.variety) out.variety = p.variety;
    if (p.producerCode) out.producerCode = p.producerCode;
    if (p.csg) out.csg = p.csg;
    if (p.sdp) out.sdp = p.sdp;
    if (p.lot) out.lot = p.lot;
    if (p.receptionDate) out.receptionDate = p.receptionDate;
    return out;
  }

  /** Rellena una caja con los datos de la etiqueta (calibre y trazabilidad) */
  static autoFillBoxFromQR(p: QRPackingPayload, existingBox: Partial<BoxSampling>): Partial<BoxSampling> {
    return {
      ...existingBox,
      caliber: p.caliber ? `Calibre ${p.caliber}` : existingBox.caliber,
      qrPayload: { ...p }
    };
  }
}
