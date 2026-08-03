/**
 * Sesión: control de acceso por código y firma del inspector.
 *
 * Los códigos se derivan de una clave secreta y del período (mes o año),
 * de modo que se pueden generar por adelantado sin conexión.
 */

// ⚠ Cambia esta clave por la tuya antes de publicar
const ACCESS_SECRET = 'FRUSTOCK-PROCESOS-2026';

const KEY_UNTIL = 'FK_PROC_ACCESS_UNTIL';
const KEY_ROLE = 'FK_PROC_ROLE';
const KEY_INSPECTOR = 'FK_PROC_INSPECTOR';
const KEY_INSPECTOR_DATE = 'FK_PROC_INSPECTOR_DATE';

export type AccessRole = 'admin' | 'inspector';
export type AccessKind = 'mensual' | 'anual' | null;

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function codigoPara(periodo: string): Promise<string> {
  const hex = await sha256Hex(`${ACCESS_SECRET}-${periodo}`);
  return String(parseInt(hex.slice(0, 8), 16) % 1000000).padStart(6, '0');
}

/** Código del mes en curso (formato interno: MES-2026-07) */
export function periodoMesActual(d = new Date()): string {
  return `MES-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Código del año en curso */
export function periodoAnioActual(d = new Date()): string {
  return `ANIO-${d.getFullYear()}`;
}

export const SessionService = {
  /** Genera los códigos de un período (para la pantalla de administración) */
  async generarCodigos(fecha = new Date()) {
    const meses: { periodo: string; etiqueta: string; codigo: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(fecha.getFullYear(), fecha.getMonth() + i, 1);
      const periodo = periodoMesActual(d);
      meses.push({
        periodo,
        etiqueta: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
        codigo: await codigoPara(periodo)
      });
    }
    const anual = {
      periodo: periodoAnioActual(fecha),
      etiqueta: `Año ${fecha.getFullYear()} (administrador)`,
      codigo: await codigoPara(periodoAnioActual(fecha))
    };
    return { meses, anual };
  },

  /** Valida un código; devuelve el tipo de acceso o null */
  async validarCodigo(codigo: string): Promise<AccessKind> {
    const limpio = (codigo || '').trim();
    if (!limpio) return null;
    if (limpio === await codigoPara(periodoAnioActual())) return 'anual';
    if (limpio === await codigoPara(periodoMesActual())) return 'mensual';
    return null;
  },

  /** Registra el acceso concedido */
  activarAcceso(tipo: Exclude<AccessKind, null>): void {
    const ahora = new Date();
    let hasta: Date;
    if (tipo === 'anual') {
      hasta = new Date(ahora.getFullYear(), 11, 31, 23, 59, 59);
      localStorage.setItem(KEY_ROLE, 'admin');
    } else {
      hasta = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);
      localStorage.setItem(KEY_ROLE, 'inspector');
    }
    localStorage.setItem(KEY_UNTIL, String(hasta.getTime()));
  },

  accesoVigente(): boolean {
    const until = parseInt(localStorage.getItem(KEY_UNTIL) || '0', 10);
    return Date.now() < until;
  },

  vigenciaHasta(): Date | null {
    const until = parseInt(localStorage.getItem(KEY_UNTIL) || '0', 10);
    return until ? new Date(until) : null;
  },

  rol(): AccessRole {
    return (localStorage.getItem(KEY_ROLE) as AccessRole) || 'inspector';
  },

  esAdmin(): boolean {
    return this.rol() === 'admin';
  },

  // ---------- Identidad del inspector ----------

  /** Nombre del inspector de la jornada (se pide una vez al día) */
  inspector(): string {
    return localStorage.getItem(KEY_INSPECTOR) || '';
  },

  /** ¿Hay que pedir el nombre? (no registrado o cambió el día) */
  requiereInspector(): boolean {
    const nombre = localStorage.getItem(KEY_INSPECTOR);
    const fecha = localStorage.getItem(KEY_INSPECTOR_DATE);
    const hoy = new Date().toISOString().split('T')[0];
    return !nombre || fecha !== hoy;
  },

  setInspector(nombre: string): void {
    localStorage.setItem(KEY_INSPECTOR, nombre.trim());
    localStorage.setItem(KEY_INSPECTOR_DATE, new Date().toISOString().split('T')[0]);
  },

  cerrarJornada(): void {
    localStorage.removeItem(KEY_INSPECTOR_DATE);
  }
};

// ============================================================
// BITÁCORA DE EVENTOS
// ============================================================
export interface LogEvent {
  timestamp: string;
  inspector: string;
  accion: string;
  detalle: string;
  processNumber?: string;
}

const KEY_LOG = 'FK_PROC_LOG';
const MAX_LOG = 300;

export const AuditLog = {
  registrar(accion: string, detalle: string, processNumber?: string): void {
    try {
      const evento: LogEvent = {
        timestamp: new Date().toISOString(),
        inspector: SessionService.inspector() || 'sin identificar',
        accion,
        detalle,
        processNumber
      };
      const previos = this.listar();
      previos.unshift(evento);
      localStorage.setItem(KEY_LOG, JSON.stringify(previos.slice(0, MAX_LOG)));
    } catch (e) {
      console.warn('No se pudo registrar el evento en la bitácora:', e);
    }
  },

  listar(): LogEvent[] {
    try {
      const raw = localStorage.getItem(KEY_LOG);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /** Eventos aún no enviados al respaldo remoto */
  pendientes(): LogEvent[] {
    return this.listar();
  },

  limpiar(): void {
    localStorage.removeItem(KEY_LOG);
  }
};
