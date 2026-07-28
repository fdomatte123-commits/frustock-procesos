import { ProcessData, BoxSampling } from '../types/process';

const STORAGE_KEY = 'FRUSTOCK_ACTIVE_PROCESS_V1';
const HISTORY_KEY = 'FRUSTOCK_PROCESS_HISTORY_V1';

export class ProcessStorageService {
  /**
   * Save or update current process
   */
  static saveCurrentProcess(process: ProcessData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(process));
      this.saveToHistory(process);
    } catch (error) {
      console.error('Error saving process to storage:', error);
    }
  }

  /**
   * Load active process or return null
   */
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
   * Add a box to current process
   */
  static addBoxToCurrentProcess(box: BoxSampling): ProcessData | null {
    const process = this.getCurrentProcess();
    if (!process) return null;

    const updatedProcess: ProcessData = {
      ...process,
      boxes: [...process.boxes, box],
      updatedAt: new Date().toISOString()
    };

    this.saveCurrentProcess(updatedProcess);
    return updatedProcess;
  }

  /**
   * Delete a box from current process
   */
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
   * Save to process history
   */
  private static saveToHistory(process: ProcessData): void {
    try {
      const historyRaw = localStorage.getItem(HISTORY_KEY);
      const history: ProcessData[] = historyRaw ? JSON.parse(historyRaw) : [];
      const index = history.findIndex(p => p.id === process.id);
      if (index >= 0) {
        history[index] = process;
      } else {
        history.unshift(process);
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20))); // Keep last 20 processes
    } catch (e) {
      console.error('Error saving history:', e);
    }
  }

  /**
   * Create new default empty process
   */
  static createInitialProcess(override: Partial<ProcessData> = {}): ProcessData {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const defaultNum = `PROC-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      id: crypto.randomUUID(),
      processNumber: override.processNumber || defaultNum,
      variety: override.variety || 'Royal Dawn',
      producerCode: override.producerCode || 'P-402',
      producerName: override.producerName || 'Agrícola Valle Central',
      csg: override.csg || '123456',
      sdp: override.sdp || 'SDP-01',
      receptionDate: override.receptionDate || dateStr,
      lot: override.lot || `LOTE-${now.getMonth() + 1}${now.getDate()}`,
      totalKg: override.totalKg || 12500,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      boxes: []
    };
  }

  /**
   * Clear active session
   */
  static clearCurrentProcess(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
