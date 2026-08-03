import { ProcessData, BoxSampling } from '../types/process';

const STORAGE_KEY = 'FRUSTOCK_ACTIVE_PROCESS_V1';
const HISTORY_KEY = 'FRUSTOCK_PROCESS_HISTORY_V2'; // V2: historial sin fotos

/** Metadatos de un proceso para el historial (sin cajas ni imágenes) */
export interface ProcessSummary {
  id: string;
  processNumber: string;
  species: string;
  variety: string;
  producerName: string;
  lot: string;
  boxCount: number;
  createdAt: string;
  updatedAt: string;
}

export class ProcessStorageService {
  /**
   * Save or update current process.
   * Devuelve true si se guardó bien; false si falló (ej. cuota de almacenamiento llena).
   */
  static saveCurrentProcess(process: ProcessData): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(process));
      this.saveToHistory(process);
      return true;
    } catch (error) {
      console.error('Error saving process to storage:', error);
      return false;
    }
  }

  static getCurrentProcess(): ProcessData | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading process from storage:', error);
      return null;
    }
  }

  /**
   * Agrega una caja. Devuelve el proceso actualizado, o null si no hay proceso,
   * o el string 'QUOTA' si no se pudo guardar por falta de espacio.
   */
  static addBoxToCurrentProcess(box: BoxSampling): ProcessData | 'QUOTA' | null {
    const process = this.getCurrentProcess();
    if (!process) return null;

    const updatedProcess: ProcessData = {
      ...process,
      boxes: [...process.boxes, box],
      updatedAt: new Date().toISOString()
    };

    const ok = this.saveCurrentProcess(updatedProcess);
    if (!ok) return 'QUOTA';
    return updatedProcess;
  }

  static deleteBoxFromProcess(boxId: string): ProcessData | null {
    const process = this.getCurrentProcess();
    if (!process) return null;

    const updatedBoxes = process.boxes
      .filter(b => b.id !== boxId)
      .map((box, index) => ({ ...box, boxNumber: index + 1 }));

    const updatedProcess: ProcessData = {
      ...process,
      boxes: updatedBoxes,
      updatedAt: new Date().toISOString()
    };

    this.saveCurrentProcess(updatedProcess);
    return updatedProcess;
  }

  /**
   * Historial LIVIANO: guarda solo metadatos del proceso, nunca cajas ni fotos.
   * Antes se duplicaba el proceso completo (con base64) en cada guardado, lo que
   * reventaba la cuota de localStorage y congelaba la app al serializar megabytes.
   */
  private static saveToHistory(process: ProcessData): void {
    try {
      const historyRaw = localStorage.getItem(HISTORY_KEY);
      const history: ProcessSummary[] = historyRaw ? JSON.parse(historyRaw) : [];

      const resumen: ProcessSummary = {
        id: process.id,
        processNumber: process.processNumber,
        species: process.species,
        variety: process.variety,
        producerName: process.producerName,
        lot: process.lot,
        boxCount: process.boxes ? process.boxes.length : 0,
        createdAt: process.createdAt,
        updatedAt: process.updatedAt
      };

      const index = history.findIndex(p => p.id === process.id);
      if (index >= 0) {
        history[index] = resumen;
      } else {
        history.unshift(resumen);
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    } catch (e) {
      // El historial es secundario: si falla, no interrumpir el guardado principal
      console.warn('No se pudo actualizar el historial (secundario):', e);
    }
  }

  /** Lista de procesos anteriores (solo metadatos) */
  static getHistory(): ProcessSummary[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Crea un proceso NUEVO con todos los campos en blanco (sin datos demo).
   */
  static createInitialProcess(override: Partial<ProcessData> = {}): ProcessData {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      processNumber: override.processNumber ?? '',
      species: override.species ?? 'Naranja',
      variety: override.variety ?? '',
      exportCategory: override.exportCategory ?? 'EXTRA-FANCY',
      producerCode: override.producerCode ?? '',
      producerName: override.producerName ?? '',
      csg: override.csg ?? '',
      sdp: override.sdp ?? '',
      receptionDate: override.receptionDate ?? '',
      lot: override.lot ?? '',
      totalKg: override.totalKg ?? 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      boxes: []
    };
  }

  static clearCurrentProcess(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Comprime y redimensiona una imagen a un ancho máximo, devolviendo un
 * data URL JPEG liviano. Evita reventar la cuota de localStorage con fotos grandes.
 */
export function compressImage(file: File, maxWidth = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No se pudo crear el contexto de imagen.'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}
