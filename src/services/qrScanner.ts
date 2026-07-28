import { BoxSampling } from '../types/process';

/**
 * Service for handling packing tag QR codes (Roadmap Phase 2).
 * Formatted modularly so native camera scan or web QR reader can feed raw payload.
 */
export interface QRPackingPayload {
  raw: string;
  caliber?: string;
  lot?: string;
  producerCode?: string;
  boxSerial?: string;
  timestamp?: string;
}

export class QRScannerService {
  /**
   * Parse a QR code string from packing box tags.
   * Example QR string formats:
   * "FRUSTOCK|CAL:88|LOT:2026-A|PROD:402|SN:99201"
   * or JSON encoded strings.
   */
  static parsePackingTag(qrRaw: string): QRPackingPayload {
    try {
      // JSON format
      if (qrRaw.trim().startsWith('{')) {
        const parsed = JSON.parse(qrRaw);
        return {
          raw: qrRaw,
          caliber: parsed.caliber || parsed.cal,
          lot: parsed.lot || parsed.lote,
          producerCode: parsed.producerCode || parsed.csg || parsed.prod,
          boxSerial: parsed.sn || parsed.serial,
          timestamp: new Date().toISOString()
        };
      }

      // Key-Value pipe delimited format
      if (qrRaw.includes('|')) {
        const parts = qrRaw.split('|');
        const data: Record<string, string> = {};
        parts.forEach(p => {
          const [key, val] = p.split(':');
          if (key && val) data[key.trim().toUpperCase()] = val.trim();
        });

        return {
          raw: qrRaw,
          caliber: data['CAL'] || data['CALIBRE'],
          lot: data['LOT'] || data['LOTE'],
          producerCode: data['PROD'] || data['CSG'],
          boxSerial: data['SN'] || data['SERIAL'],
          timestamp: new Date().toISOString()
        };
      }

      return { raw: qrRaw, timestamp: new Date().toISOString() };
    } catch (e) {
      console.warn('Error parsing QR code tag payload:', e);
      return { raw: qrRaw, timestamp: new Date().toISOString() };
    }
  }

  /**
   * Auto-populates a box sampling record using parsed QR data.
   */
  static autoFillBoxFromQR(qrPayload: QRPackingPayload, existingBox: Partial<BoxSampling>): Partial<BoxSampling> {
    return {
      ...existingBox,
      caliber: qrPayload.caliber || existingBox.caliber || 'Calibre 88',
      qrPayload: qrPayload
    };
  }
}
