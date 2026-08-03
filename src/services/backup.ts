import { ProcessData, calcularEstadisticasPeso, calcularEstadisticasGrupo, getCategoriaLabel } from '../types/process';
import { AuditLog, SessionService, LogEvent } from './session';

/**
 * Respaldo del proceso en Google Sheets (vía Apps Script).
 *
 * Envía tres bloques: cabecera del proceso, detalle de cajas y bitácora.
 * Funciona sin bloquear al inspector: si falla, queda en cola y se reintenta.
 */

const KEY_URL = 'FK_PROC_BACKUP_URL';
const KEY_TOKEN = 'FK_PROC_BACKUP_TOKEN';
const KEY_QUEUE = 'FK_PROC_BACKUP_QUEUE';

// Configuración de fábrica: se puede dejar precargada antes de publicar
const DEFAULT_URL = '';
const DEFAULT_TOKEN = '';

export interface BackupConfig {
  url: string;
  token: string;
}

export const BackupService = {
  config(): BackupConfig {
    return {
      url: localStorage.getItem(KEY_URL) || DEFAULT_URL,
      token: localStorage.getItem(KEY_TOKEN) || DEFAULT_TOKEN
    };
  },

  guardarConfig(url: string, token: string): void {
    localStorage.setItem(KEY_URL, url.trim());
    localStorage.setItem(KEY_TOKEN, token.trim());
  },

  configurado(): boolean {
    return Boolean(this.config().url);
  },

  /** Arma el paquete que se envía a la planilla */
  construirPayload(process: ProcessData) {
    const stats = process.weightControl ? calcularEstadisticasPeso(process.weightControl) : null;

    return {
      token: this.config().token || undefined,
      proceso: {
        folio: process.folio || '',
        numero: process.processNumber,
        especie: process.species,
        variedad: process.variety,
        categoria: getCategoriaLabel(process.species, process.exportCategory),
        productor: process.producerName,
        codigoProductor: process.producerCode,
        csg: process.csg,
        sdp: process.sdp,
        lote: process.lot,
        fechaRecepcion: process.receptionDate,
        kgTotales: process.totalKg,
        inspector: process.inspector || SessionService.inspector(),
        veredicto: process.verdict || 'PENDIENTE',
        notaVeredicto: process.verdictNote || '',
        cajasTotal: process.boxes.length,
        cajasAprobadas: process.boxes.filter(b => b.status === 'APROBADA').length,
        cajasObjetadas: process.boxes.filter(b => b.status === 'OBJETADA').length,
        madurez: (process.maturity || []).map(m => `${m.label}: ${m.value}${m.unit} (${m.ok ? 'cumple' : 'fuera'})`).join(' | '),
        pesosTotal: stats?.total ?? '',
        pesoPromedio: stats ? Number(stats.promedio.toFixed(3)) : '',
        pesosFueraRango: stats ? stats.bajoRango + stats.sobreRango : '',
        pesoRango: process.weightControl ? `${process.weightControl.minKg}-${process.weightControl.maxKg}` : '',
        taraKg: process.weightControl?.taraKg ?? '',
        netoObjetivoKg: process.weightControl?.netoObjetivoKg ?? '',
        pesoNetoPromedio: stats && process.weightControl?.taraKg != null
          ? Number((stats.promedio - process.weightControl.taraKg).toFixed(3))
          : '',
        // "72(x):14 cajas 16.259 kg 43% | 105:14 cajas 16.218 kg 50%"
        pesosPorCalibre: (process.weightControl?.grupos ?? []).map(g => {
          const s = calcularEstadisticasGrupo(g, process.species,
            process.weightControl?.netoObjetivoKg, process.weightControl?.taraKg);
          return `${g.caliber}${g.line ? `(${g.line})` : ''}:${s.total} cajas ${s.promedio.toFixed(3)}kg ${s.pctConforme.toFixed(0)}%`;
        }).join(' | '),
        creadoEn: process.createdAt,
        actualizadoEn: process.updatedAt
      },
      cajas: process.boxes.map(b => ({
        folio: process.folio || '',
        numeroProceso: process.processNumber,
        caja: b.boxNumber,
        calibre: b.caliber,
        rotulo: b.caliberLabel || '',
        serie: b.serie || '',
        programa: b.program || '',
        diametro: b.diameterMm || '',
        peso: b.weightGr || '',
        color: b.colorName ? `${b.colorGrade} - ${b.colorName}` : '',
        totalFrutos: b.totalFrutos ?? '',
        estado: b.status,
        motivos: (b.statusReasons || []).join(' | '),
        // "Manchas:5/105 (4.8%)" deja auditable el conteo, no solo el porcentaje
        defectos: (b.defects || []).map(d => d.unidades != null
          ? `${d.name}:${d.unidades}/${d.totalFrutos} (${d.countOrPercentage}%)`
          : `${d.name}:${d.countOrPercentage}%`).join(', '),
        fotos: (b.photos || []).length,
        observaciones: b.notes || '',
        inspector: b.inspector || process.inspector || '',
        registrado: b.timestamp,
        editado: b.editedAt || ''
      })),
      bitacora: AuditLog.pendientes().map((e: LogEvent) => ({
        fecha: e.timestamp,
        inspector: e.inspector,
        accion: e.accion,
        detalle: e.detalle,
        proceso: e.processNumber || ''
      }))
    };
  },

  /** Envía el proceso a la planilla. Devuelve true si se confirmó la escritura. */
  async sincronizar(process: ProcessData): Promise<boolean> {
    const { url } = this.config();
    if (!url) return false;

    const payload = this.construirPayload(process);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // evita preflight CORS
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status !== 'success') throw new Error(data.message || 'Error del servidor');

      AuditLog.limpiar(); // la bitácora ya quedó respaldada
      return true;
    } catch (e) {
      console.warn('No se pudo respaldar en Sheets, queda en cola:', e);
      this.encolar(process.id);
      return false;
    }
  },

  encolar(processId: string): void {
    try {
      const cola: string[] = JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
      if (!cola.includes(processId)) {
        cola.push(processId);
        localStorage.setItem(KEY_QUEUE, JSON.stringify(cola));
      }
    } catch { /* sin cola disponible */ }
  },

  hayPendientes(): boolean {
    try {
      const cola: string[] = JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]');
      return cola.length > 0;
    } catch {
      return false;
    }
  },

  limpiarCola(): void {
    localStorage.removeItem(KEY_QUEUE);
  }
};

/** Genera un folio correlativo por dispositivo: QC-2026-001 */
export function generarFolio(): string {
  const KEY = 'FK_PROC_FOLIO';
  const n = parseInt(localStorage.getItem(KEY) || '0', 10) + 1;
  localStorage.setItem(KEY, String(n));
  return `QC-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`;
}
