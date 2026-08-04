import type jsPDFType from 'jspdf';
import { ProcessData, getTolerance, getCategoriaLabel, calcularEstadisticasPeso, calcularEstadisticasGrupo } from '../types/process';
import { LOGO_FRUSTOCK_PNG, LOGO_RATIO } from '../assets/logoFrustock';

// jsPDF y html2canvas pesan ~600 kB y solo se usan al exportar.
// Se cargan bajo demanda para que la app abra rápido en terreno con señal débil.
let _libsPromise: Promise<{
  jsPDF: typeof jsPDFType;
  html2canvas: typeof import('html2canvas').default;
}> | null = null;

function cargarLibreriasPDF() {
  if (!_libsPromise) {
    _libsPromise = Promise.all([
      import('jspdf'),
      import('html2canvas')
    ]).then(([jspdfMod, h2cMod]) => ({
      jsPDF: jspdfMod.default,
      html2canvas: h2cMod.default
    }));
  }
  return _libsPromise;
}

// Escapa texto para insertarlo con seguridad dentro de innerHTML
function esc(s: any): string {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

/**
 * Escala tipográfica única del informe.
 * Antes había 34 tamaños inline distintos sin criterio; esto los unifica.
 */
const FS = {
  titulo: '17px',
  subtitulo: '13px',
  seccion: '11px',
  dato: '10px',
  tabla: '10px',
  meta: '8.5px',
  micro: '8px'
} as const;

export class PDFReportGenerator {
  /**
   * Marca corporativa en la esquina superior izquierda.
   * La usan las dos plantillas, así aparece en todas las páginas del informe.
   */
  private static membrete(subtitulo: string, altoLogo = 34): string {
    const anchoLogo = Math.round(altoLogo / LOGO_RATIO);
    return `
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${LOGO_FRUSTOCK_PNG}" width="${anchoLogo}" height="${altoLogo}"
             style="width:${anchoLogo}px; height:${altoLogo}px; display:block; flex-shrink:0;" alt="" />
        <div>
          <div style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:800; color:#4A4A4A; letter-spacing:.16em; line-height:1;">FRUSTOCK</div>
          <div style="font-size:${FS.micro}; font-weight:800; color:#94A3B8; letter-spacing:.07em; margin-top:4px;">${subtitulo}</div>
        </div>
      </div>`;
  }

  // -------------------------------------------------------------
  // FOTOGRAFÍAS
  // -------------------------------------------------------------
  /**
   * Mide el ancho y alto reales de una foto.
   *
   * Hace falta porque html2canvas NO implementa object-fit: si se le da a la
   * imagen un alto y un ancho que no corresponden a su proporción, la estira
   * para llenar la caja en vez de recortarla. La única forma de que salga sin
   * deformar es calcular nosotros las dimensiones exactas.
   */
  private static medirImagen(src: string): Promise<{ w: number; h: number }> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 });
      img.onerror = () => resolve({ w: 4, h: 3 });   // proporción típica de teléfono
      img.src = src;
    });
  }

  /** Mide todas las fotos del proceso antes de empezar a dibujar páginas */
  private static async medirFotos(process: ProcessData): Promise<Map<string, { w: number; h: number }>> {
    const mapa = new Map<string, { w: number; h: number }>();
    const todas = (process.boxes || []).flatMap(b => b.photos || []);
    for (const src of todas) {
      if (mapa.has(src)) continue;
      mapa.set(src, await this.medirImagen(src));
    }
    return mapa;
  }

  /**
   * Bloque de evidencia fotográfica.
   * Cada foto se escala para caber entera dentro de su recuadro conservando su
   * proporción, y se centra con márgenes calculados en píxeles: nada depende de
   * object-fit, flexbox ni márgenes automáticos, que html2canvas no respeta.
   */
  private static bloqueFotosHTML(
    fotos: string[] | undefined,
    medidas: Map<string, { w: number; h: number }>
  ): string {
    if (!fotos || fotos.length === 0) {
      return `<div style="width: 100%; height: 110px; border: 2px dashed #CBD5E1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 12px;">Sin registro fotográfico en esta caja</div>`;
    }

    const ANCHO_UTIL = 734;                       // 794 de página menos 30+30 de margen
    const GAP = 12;
    const columnas = fotos.length === 1 ? 1 : 2;
    const anchoCelda = Math.floor((ANCHO_UTIL - GAP * (columnas - 1)) / columnas);
    // Con menos fotos se les da más alto: son la evidencia del informe
    const altoCelda = fotos.length === 1 ? 360 : fotos.length === 2 ? 300 : 250;

    // Se usa inline-block con márgenes fijos en vez de flexbox: html2canvas
    // resuelve el flujo en línea de forma consistente, el flex no siempre.
    // El borde se descuenta del área útil para que la fila no se pase del ancho.
    const BORDE = 1;
    const utilW = anchoCelda - BORDE * 2;
    const utilH = altoCelda - BORDE * 2;

    const celdas = fotos.map((src, i) => {
      const m = medidas.get(src) ?? { w: 4, h: 3 };
      const escala = Math.min(utilW / m.w, utilH / m.h);
      const w = Math.max(1, Math.round(m.w * escala));
      const h = Math.max(1, Math.round(m.h * escala));
      const top = Math.round((utilH - h) / 2);
      const left = Math.round((utilW - w) / 2);
      const ultimaDeFila = columnas === 1 || i % columnas === columnas - 1;
      return `<div style="display:inline-block; vertical-align:top; box-sizing:border-box; width:${anchoCelda}px; height:${altoCelda}px; margin:0 ${ultimaDeFila ? 0 : GAP}px ${GAP}px 0; border-radius:8px; overflow:hidden; border:${BORDE}px solid #E2E8F0; background:#F1F5F9;"><img src="${src}" width="${w}" height="${h}" style="display:block; width:${w}px; height:${h}px; margin:${top}px 0 0 ${left}px;" alt="Foto ${i + 1}" /></div>`;
    }).join('');

    // font-size 0 elimina el espacio en blanco entre los inline-block
    return `<div style="font-size:0; line-height:0;">${celdas}</div>`;
  }

  /**
   * Precarga la marca una sola vez.
   * html2canvas captura el DOM tal como está: si la imagen todavía no decodifica,
   * la página sale sin logo y sin ningún error visible.
   */
  private static _logoListo: Promise<void> | null = null;
  private static precargarLogo(): Promise<void> {
    if (!this._logoListo) {
      this._logoListo = new Promise<void>(resolve => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();   // sin logo el informe se genera igual
        img.src = LOGO_FRUSTOCK_PNG;
      });
    }
    return this._logoListo;
  }

  /**
   * Genera un PDF con exactamente 1 página por caja muestreada.
   * El contenido fluye a su altura natural y se ajusta a la página sin recortar.
   */
  static async generateProcessPDF(process: ProcessData, onProgress?: (percent: number) => void): Promise<void> {
    if (!process.boxes || process.boxes.length === 0) {
      throw new Error('No hay cajas muestreadas para generar el informe PDF.');
    }

    // Descarga de las librerías pesadas solo cuando realmente se exporta
    if (onProgress) onProgress(1);
    const [{ jsPDF, html2canvas }, medidasFotos] = await Promise.all([
      cargarLibreriasPDF(),
      this.medirFotos(process),
      this.precargarLogo()
    ]);

    const renderContainer = document.createElement('div');
    renderContainer.style.position = 'absolute';
    renderContainer.style.left = '-9999px';
    renderContainer.style.top = '-9999px';
    renderContainer.style.width = '794px';
    document.body.appendChild(renderContainer);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;

    // En móvil se baja la escala porque con muchas cajas a scale 2 la pestaña se
    // queda sin memoria. Con pocas cajas sí alcanza, y las fotos se ven bastante
    // más nítidas, que es donde se aprecia el detalle de la fruta.
    const esMovil = typeof window !== 'undefined' && window.innerWidth <= 768;
    const escala = esMovil ? (process.boxes.length <= 8 ? 2 : 1.5) : 2;

    // Renderiza un bloque HTML y lo agrega como página, liberando memoria después
    const agregarPagina = async (html: string, esPrimera: boolean) => {
      renderContainer.innerHTML = html;
      const pageElement = renderContainer.firstElementChild as HTMLElement;

      const canvas = await html2canvas(pageElement, {
        scale: escala,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        width: 794
      });

      // 0.92 en vez de 0.88: el JPEG se nota sobre todo en las fotos de fruta,
      // y el peso extra en una página de texto es despreciable.
      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      if (!esPrimera) doc.addPage('a4', 'portrait');

      let renderW = pageW;
      let renderH = (canvas.height * pageW) / canvas.width;
      if (renderH > pageH) {
        renderH = pageH;
        renderW = (canvas.width * pageH) / canvas.height;
      }
      doc.addImage(imgData, 'JPEG', (pageW - renderW) / 2, 0, renderW, renderH);

      // Liberar el canvas y ceder el hilo: evita el crash y el congelamiento
      canvas.width = 0;
      canvas.height = 0;
      await new Promise(r => setTimeout(r, 0));
    };

    try {
      const totalBoxes = process.boxes.length;

      // Página 1: resumen del proceso completo (lo primero que mira un recibidor)
      if (onProgress) onProgress(3);
      await agregarPagina(this.buildSummaryPageHTML(process), true);

      // Una página por caja
      for (let index = 0; index < totalBoxes; index++) {
        const box = process.boxes[index];
        if (onProgress) onProgress(Math.round(((index + 1) / totalBoxes) * 95) + 4);
        await agregarPagina(this.buildSingleBoxPageHTML(process, box, index + 1, totalBoxes, medidasFotos), false);
      }

      // Numeración estampada sobre el PDF ya generado (fiable ante cualquier corte)
      try {
        const totalPag = doc.getNumberOfPages();
        const num = (process.processNumber || 'S/N').toString();
        for (let p = 1; p <= totalPag; p++) {
          doc.setPage(p);
          doc.setFontSize(7.5);
          doc.setTextColor(150, 158, 170);
          doc.text(`Proceso ${num} · ${process.producerName || ''}`.trim(), 8, pageH - 4);
          doc.text(`Página ${p} de ${totalPag}`, pageW - 8, pageH - 4, { align: 'right' });
        }
      } catch (pagErr) {
        console.warn('No se pudo numerar las páginas:', pagErr);
      }

      const especie = process.species || 'Naranja';
      const numLimpio = (process.processNumber || 'SN').toString().replace(/[\/\\?%*:|"<>]/g, '');
      const fileName = `FRUSTOCK_${especie}_${numLimpio}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } finally {
      if (document.body.contains(renderContainer)) {
        document.body.removeChild(renderContainer);
      }
    }
  }

  /**
   * PORTADA: resumen del proceso completo.
   * Responde de un vistazo "¿cómo salió el lote?" antes del detalle caja por caja.
   */
  private static buildSummaryPageHTML(process: ProcessData): string {
    const boxes = process.boxes || [];
    const total = boxes.length;
    const aprobadas = boxes.filter(b => b.status === 'APROBADA').length;
    const objetadas = total - aprobadas;
    const pctAprob = total > 0 ? (aprobadas / total) * 100 : 0;
    const pctObj = 100 - pctAprob;

    // Distribución de calibres
    const porCalibre: Record<string, number> = {};
    boxes.forEach(b => {
      const k = b.caliberLabel ? `${b.caliber} (${b.caliberLabel})` : b.caliber;
      porCalibre[k] = (porCalibre[k] || 0) + 1;
    });
    const calibres = Object.entries(porCalibre).sort((a, b) => b[1] - a[1]);
    const maxCal = Math.max(...calibres.map(c => c[1]), 1);

    // Top defectos por frecuencia y % promedio
    const acumDefectos: Record<string, { veces: number; suma: number }> = {};
    boxes.forEach(b => (b.defects || []).forEach(d => {
      if (!acumDefectos[d.name]) acumDefectos[d.name] = { veces: 0, suma: 0 };
      acumDefectos[d.name].veces += 1;
      acumDefectos[d.name].suma += d.countOrPercentage;
    }));
    const topDefectos = Object.entries(acumDefectos)
      .map(([name, v]) => ({ name, veces: v.veces, prom: v.suma / v.veces }))
      .sort((a, b) => b.veces - a.veces)
      .slice(0, 5);
    const maxProm = Math.max(...topDefectos.map(d => d.prom), 1);

    // Promedios de calidad y condición sobre el total de cajas
    const promTipo = (tipo: 'calidad' | 'condicion') => {
      if (total === 0) return 0;
      const suma = boxes.reduce((s, b) =>
        s + (b.defects || []).filter(d => d.type === tipo).reduce((x, d) => x + d.countOrPercentage, 0), 0);
      return suma / total;
    };
    const promCalidad = promTipo('calidad');
    const promCondicion = promTipo('condicion');

    // Bloque de madurez del lote (Brix, acidez, materia seca… según especie)
    const madurez = process.maturity || [];
    const madurezHTML = madurez.length > 0 ? `
      <div style="border:1px solid #E2E8F0; border-radius:8px; padding:10px 12px; margin-bottom:16px; background:#FFFFFF;">
        <div style="font-size:${FS.micro}; color:#64748B; font-weight:700; letter-spacing:.05em; margin-bottom:6px;">
          PARÁMETROS DE MADUREZ DEL LOTE
        </div>
        <div style="display:grid; grid-template-columns:repeat(${Math.min(madurez.length, 4)},1fr); gap:10px;">
          ${madurez.map(m => `
            <div style="border-left:3px solid ${m.ok ? '#059669' : '#DC2626'}; padding:2px 8px;">
              <div style="font-size:${FS.micro}; color:#64748B;">${esc(m.label)}</div>
              <div style="font-size:${FS.subtitulo}; font-weight:800; color:${m.ok ? '#0F172A' : '#DC2626'};">
                ${m.value}${m.unit ? ' ' + esc(m.unit) : ''}
              </div>
              <div style="font-size:${FS.micro}; color:${m.ok ? '#059669' : '#DC2626'}; font-weight:700;">
                ${m.ok ? 'Cumple' : 'Fuera de norma'}
              </div>
            </div>`).join('')}
        </div>
      </div>` : '';

    // Control de peso de cajas del packing, con el detalle por calibre:
    // es ahí donde se ve la línea descalibrada que el promedio del turno esconde.
    const wc = process.weightControl;
    const ws = wc ? calcularEstadisticasPeso(wc) : null;
    const tara = wc?.taraKg ?? 0;
    const statsGrupos = (wc?.grupos ?? []).map(g =>
      calcularEstadisticasGrupo(g, process.species, wc?.netoObjetivoKg, wc?.taraKg));
    const criticos = statsGrupos.filter(s => s.total >= 3 && s.pctConforme < 70);

    const filasPeso = statsGrupos.map(s => {
      const alerta = s.total >= 3 && s.pctConforme < 70;
      return `
        <tr style="border-bottom:1px solid #F1F5F9; background:${alerta ? '#FEF2F2' : 'transparent'};">
          <td style="padding:4px 8px; font-weight:700;">${esc(s.caliber)}${s.line ? ` <span style="color:#94A3B8; font-weight:600;">(${esc(s.line)})</span>` : ''}</td>
          <td style="padding:4px 8px; text-align:center;">${s.total}</td>
          <td style="padding:4px 8px; text-align:right;">${s.promedio.toFixed(3)}</td>
          <td style="padding:4px 8px; text-align:right; color:#64748B;">${(s.promedio - tara).toFixed(3)}</td>
          <td style="padding:4px 8px; text-align:center; color:#64748B; font-size:${FS.micro};">${s.rangoMin.toFixed(3)}–${s.rangoMax.toFixed(3)}</td>
          <td style="padding:4px 8px; text-align:center; color:${s.bajoRango ? '#DC2626' : '#94A3B8'};">${s.bajoRango}</td>
          <td style="padding:4px 8px; text-align:center; color:${s.sobreRango ? '#D97706' : '#94A3B8'};">${s.sobreRango}</td>
          <td style="padding:4px 8px; text-align:right; font-weight:800; color:${alerta ? '#DC2626' : '#059669'};">${s.pctConforme.toFixed(0)}%</td>
        </tr>`;
    }).join('');

    const pesosHTML = (wc && ws && ws.total > 0) ? `
      <div style="border:1px solid #E2E8F0; border-radius:8px; padding:10px 12px; margin-top:14px; background:#FFFFFF;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
          <span style="font-size:${FS.micro}; color:#64748B; font-weight:700; letter-spacing:.05em;">CONTROL DE PESO DE CAJAS</span>
          <span style="font-size:${FS.micro}; color:#94A3B8;">
            Tara ${tara.toFixed(3)} kg · neto objetivo ${(wc.netoObjetivoKg ?? 0).toFixed(3)} kg · mínimo bruto ${wc.minKg.toFixed(3)} kg
          </span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px; text-align:center; margin-bottom:8px;">
          <div><div style="font-size:${FS.micro}; color:#64748B;">Cajas pesadas</div><div style="font-size:${FS.subtitulo}; font-weight:800;">${ws.total}</div></div>
          <div><div style="font-size:${FS.micro}; color:#64748B;">Neto promedio</div><div style="font-size:${FS.subtitulo}; font-weight:800;">${(ws.promedio - tara).toFixed(3)}</div></div>
          <div><div style="font-size:${FS.micro}; color:#64748B;">Bruto mínimo</div><div style="font-size:${FS.subtitulo}; font-weight:800;">${ws.min.toFixed(3)}</div></div>
          <div><div style="font-size:${FS.micro}; color:#64748B;">Bruto máximo</div><div style="font-size:${FS.subtitulo}; font-weight:800;">${ws.max.toFixed(3)}</div></div>
          <div>
            <div style="font-size:${FS.micro}; color:#64748B;">Conforme</div>
            <div style="font-size:${FS.subtitulo}; font-weight:800; color:${ws.pctConforme >= 90 ? '#059669' : '#DC2626'};">${ws.pctConforme.toFixed(1)}%</div>
          </div>
        </div>
        ${filasPeso ? `
          <table style="width:100%; border-collapse:collapse; font-size:${FS.meta};">
            <tr style="background:#F8FAFC; color:#475569; font-weight:700;">
              <td style="padding:4px 8px;">Calibre</td>
              <td style="padding:4px 8px; text-align:center;">Cajas</td>
              <td style="padding:4px 8px; text-align:right;">Bruto</td>
              <td style="padding:4px 8px; text-align:right;">Neto</td>
              <td style="padding:4px 8px; text-align:center;">Rango bruto</td>
              <td style="padding:4px 8px; text-align:center;">Bajo</td>
              <td style="padding:4px 8px; text-align:center;">Sobre</td>
              <td style="padding:4px 8px; text-align:right;">Conforme</td>
            </tr>
            ${filasPeso}
          </table>` : ''}
        ${criticos.length > 0 ? `
          <div style="margin-top:8px; background:#FEF2F2; border:1px solid #FCA5A5; color:#991B1B; padding:5px 10px; border-radius:5px; font-size:${FS.meta};">
            <strong>Revisar en línea:</strong>
            ${criticos.map(c => `calibre ${esc(c.caliber)}${c.line ? ` (${esc(c.line)})` : ''} ${c.bajoRango > c.sobreRango ? 'llenando bajo el mínimo' : 'sobre el máximo'}`).join(' · ')}.
          </div>` : ''}
      </div>` : '';

    // Si el inspector ya resolvió el lote, esa decisión manda sobre el cálculo automático
    const resuelto = process.verdict && process.verdict !== 'PENDIENTE';
    const semColor = resuelto
      ? (process.verdict === 'ACEPTADO' ? '#059669' : '#DC2626')
      : (pctObj === 0 ? '#059669' : (pctObj <= 20 ? '#D97706' : '#DC2626'));
    const semTexto = resuelto
      ? `LOTE ${process.verdict}`
      : (pctObj === 0 ? 'LOTE CONFORME' : (pctObj <= 20 ? 'CON OBSERVACIONES' : 'LOTE OBJETADO'));
    const semBg = resuelto
      ? (process.verdict === 'ACEPTADO' ? '#ECFDF5' : '#FEF2F2')
      : (pctObj === 0 ? '#ECFDF5' : (pctObj <= 20 ? '#FFFBEB' : '#FEF2F2'));

    const filasCalibre = calibres.map(([cal, n]) => `
      <tr>
        <td style="padding:5px 8px; font-weight:600; color:#1E293B;">${esc(cal)}</td>
        <td style="padding:5px 8px; width:55%;">
          <div style="background:#E2E8F0; border-radius:3px; height:9px; position:relative;">
            <div style="width:${(n / maxCal) * 100}%; background:#132542; height:9px; border-radius:3px;"></div>
          </div>
        </td>
        <td style="padding:5px 8px; text-align:right; font-weight:800; color:#0F172A;">${n}</td>
        <td style="padding:5px 8px; text-align:right; color:#64748B;">${((n / total) * 100).toFixed(1)}%</td>
      </tr>`).join('');

    const filasDefectos = topDefectos.length > 0 ? topDefectos.map(d => `
      <tr>
        <td style="padding:5px 8px; font-weight:600; color:#1E293B;">${esc(d.name)}</td>
        <td style="padding:5px 8px; width:45%;">
          <div style="background:#E2E8F0; border-radius:3px; height:9px;">
            <div style="width:${(d.prom / maxProm) * 100}%; background:#DC2626; height:9px; border-radius:3px;"></div>
          </div>
        </td>
        <td style="padding:5px 8px; text-align:right; font-weight:800; color:#DC2626;">${d.prom.toFixed(1)}%</td>
        <td style="padding:5px 8px; text-align:right; color:#64748B;">${d.veces} caja(s)</td>
      </tr>`).join('')
      : `<tr><td colspan="4" style="padding:14px; text-align:center; color:#059669; font-weight:600; background:#F0FDF4;">✓ No se registraron defectos en el proceso</td></tr>`;

    return `
      <div style="width:794px; min-height:1123px; padding:34px 30px; box-sizing:border-box; background:#FFF; font-family:'Plus Jakarta Sans',sans-serif; color:#0F172A; display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #F59E0B; padding-bottom:14px; margin-bottom:18px;">
          <div>
            ${this.membrete('PROCESOS · RESUMEN DE INSPECCIÓN', 38)}
            <h1 style="font-size:${FS.titulo}; margin:10px 0 0; font-weight:800;">Informe de calidad · ${esc(process.species)} ${esc(process.variety)}</h1>
            <div style="font-size:${FS.meta}; color:#64748B; margin-top:3px;">Control de calidad de cajas terminadas en packing</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:${FS.micro}; color:#94A3B8; font-weight:700;">FECHA DE EMISIÓN</div>
            <div style="font-size:${FS.subtitulo}; font-weight:800;">${new Date().toLocaleDateString('es-ES')}</div>
            <div style="font-size:${FS.micro}; color:#94A3B8; font-weight:700; margin-top:6px;">PROCESO</div>
            <div style="font-size:${FS.dato}; font-weight:800;">${esc(process.processNumber)}</div>
            ${process.folio ? `
              <div style="font-size:${FS.micro}; color:#94A3B8; font-weight:700; margin-top:5px;">FOLIO</div>
              <div style="font-size:${FS.dato}; font-weight:800; color:#D97706;">${esc(process.folio)}</div>` : ''}
            ${process.inspector ? `
              <div style="font-size:${FS.micro}; color:#94A3B8; font-weight:700; margin-top:5px;">INSPECTOR</div>
              <div style="font-size:${FS.meta}; font-weight:700;">${esc(process.inspector)}</div>` : ''}
          </div>
        </div>

        <div style="background:${semBg}; border:1.5px solid ${semColor}; border-radius:10px; padding:14px 18px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:${FS.micro}; color:#64748B; font-weight:700; letter-spacing:.06em;">
              ${resuelto ? 'RESOLUCIÓN DEL INSPECTOR' : 'RESULTADO GLOBAL DEL PROCESO'}
            </div>
            <div style="font-size:22px; font-weight:800; color:${semColor}; margin-top:2px;">${semTexto}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:28px; font-weight:800; color:${semColor}; line-height:1;">${pctAprob.toFixed(0)}%</div>
            <div style="font-size:${FS.meta}; color:#64748B;">cajas aprobadas</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px;">
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px; text-align:center;">
            <div style="font-size:${FS.micro}; color:#64748B; font-weight:700;">CAJAS EVALUADAS</div>
            <div style="font-size:22px; font-weight:800;">${total}</div>
          </div>
          <div style="background:#F0FDF4; border:1px solid #86EFAC; border-radius:8px; padding:10px; text-align:center;">
            <div style="font-size:${FS.micro}; color:#166534; font-weight:700;">APROBADAS</div>
            <div style="font-size:22px; font-weight:800; color:#059669;">${aprobadas}</div>
          </div>
          <div style="background:#FEF2F2; border:1px solid #FCA5A5; border-radius:8px; padding:10px; text-align:center;">
            <div style="font-size:${FS.micro}; color:#991B1B; font-weight:700;">OBJETADAS</div>
            <div style="font-size:22px; font-weight:800; color:#DC2626;">${objetadas}</div>
          </div>
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px; text-align:center;">
            <div style="font-size:${FS.micro}; color:#64748B; font-weight:700;">CATEGORÍA</div>
            <div style="font-size:${FS.dato}; font-weight:800; color:#D97706; margin-top:4px;">${esc(getCategoriaLabel(process.species, process.exportCategory))}</div>
          </div>
        </div>

        ${madurezHTML}

        <div style="display:flex; height:24px; border-radius:5px; overflow:hidden; margin-bottom:18px; border:1px solid #CBD5E1;">
          ${aprobadas > 0 ? `<div style="width:${pctAprob}%; background:#059669; color:#FFF; font-size:${FS.meta}; font-weight:800; display:flex; align-items:center; justify-content:center;">${pctAprob.toFixed(1)}% aprobadas</div>` : ''}
          ${objetadas > 0 ? `<div style="width:${pctObj}%; background:#DC2626; color:#FFF; font-size:${FS.meta}; font-weight:800; display:flex; align-items:center; justify-content:center;">${pctObj.toFixed(1)}% objetadas</div>` : ''}
        </div>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px; margin-bottom:18px;">
          <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; font-size:${FS.dato};">
            <div><span style="color:#64748B; font-size:${FS.micro}; text-transform:uppercase;">Productor</span><strong style="display:block;">${esc(process.producerName)} (${esc(process.producerCode)})</strong></div>
            <div><span style="color:#64748B; font-size:${FS.micro}; text-transform:uppercase;">Lote / Recepción</span><strong style="display:block;">${esc(process.lot)} · ${esc(process.receptionDate)}</strong></div>
            <div><span style="color:#64748B; font-size:${FS.micro}; text-transform:uppercase;">CSG / SDP</span><strong style="display:block;">${esc(process.csg)} | ${esc(process.sdp)}</strong></div>
            <div><span style="color:#64748B; font-size:${FS.micro}; text-transform:uppercase;">Kg Totales</span><strong style="display:block;">${Number(process.totalKg || 0).toLocaleString()} Kg</strong></div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px;">
            <div style="font-size:${FS.micro}; color:#64748B; font-weight:700;">PROMEDIO DEFECTOS DE CALIDAD</div>
            <div style="font-size:20px; font-weight:800; color:${promCalidad > 7 ? '#DC2626' : '#0F172A'};">${promCalidad.toFixed(1)}%</div>
          </div>
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px;">
            <div style="font-size:${FS.micro}; color:#64748B; font-weight:700;">PROMEDIO DEFECTOS DE CONDICIÓN</div>
            <div style="font-size:20px; font-weight:800; color:${promCondicion > 5 ? '#DC2626' : '#0F172A'};">${promCondicion.toFixed(1)}%</div>
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <h2 style="font-size:${FS.seccion}; font-weight:800; border-bottom:2px solid #132542; padding-bottom:3px; margin:0 0 4px; text-transform:uppercase;">Distribución de calibres</h2>
          <table style="width:100%; border-collapse:collapse; font-size:${FS.tabla};">${filasCalibre}</table>
        </div>

        <div>
          <h2 style="font-size:${FS.seccion}; font-weight:800; border-bottom:2px solid #132542; padding-bottom:3px; margin:0 0 4px; text-transform:uppercase;">Defectos más frecuentes del proceso</h2>
          <table style="width:100%; border-collapse:collapse; font-size:${FS.tabla};">${filasDefectos}</table>
        </div>

        ${pesosHTML}

        <div style="margin-top:auto; padding-top:20px; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:flex-end;">
          <div style="font-size:${FS.micro}; color:#94A3B8; max-width:340px;">
            El detalle caja por caja se presenta en las páginas siguientes (1 página por caja).
            ${process.verdictNote ? `<br><strong style="color:#475569;">Observación:</strong> ${esc(process.verdictNote)}` : ''}
          </div>
          <div style="text-align:center; width:210px;">
            <div style="border-bottom:1px solid #94A3B8; height:26px; margin-bottom:3px;"></div>
            <div style="font-size:${FS.dato}; font-weight:800; color:#0F172A;">${esc(process.inspector || '')}</div>
            <div style="font-size:${FS.micro}; font-weight:700; color:#334155;">Inspector de Calidad</div>
          </div>
        </div>
      </div>`;
  }

  private static buildSingleBoxPageHTML(
    process: ProcessData,
    box: typeof process.boxes[0],
    pageIndex: number,
    totalPages: number,
    medidasFotos: Map<string, { w: number; h: number }>
  ): string {
    const especie = (process.species || 'Naranja').toUpperCase();
    const isApproved = box.status === 'APROBADA';
    const statusBg = isApproved ? '#D1FAE5' : '#FEE2E2';
    const statusColor = isApproved ? '#065F46' : '#991B1B';
    const statusBorder = isApproved ? '#10B981' : '#EF4444';
    const caliberLabel = box.caliberLabel && box.caliberLabel !== box.caliber
      ? `${esc(box.caliber)} (Rótulo ${esc(box.caliberLabel)})`
      : esc(box.caliber);

    const defectsRows = box.defects && box.defects.length > 0
      ? box.defects.map(d => {
          const tol = getTolerance(d, process.exportCategory);
          const isExceeded = d.countOrPercentage > tol;
          const badgeBg = d.category === 'grave' ? '#FEE2E2' : d.category === 'medio' ? '#FEF3C7' : '#ECFDF5';
          const badgeColor = d.category === 'grave' ? '#991B1B' : d.category === 'medio' ? '#92400E' : '#065F46';
          return `
            <tr style="border-bottom: 1px solid #F1F5F9; background: ${isExceeded ? '#FEF2F2' : 'transparent'};">
              <td style="padding: 8px 12px; font-weight: 600; color: #1E293B;">
                ${esc(d.name)} ${isExceeded ? '<span style="color:#DC2626; font-size:10px; font-weight:800;">[EXCEDE TOL.]</span>' : ''}
              </td>
              <td style="padding: 8px 12px; text-align: center;">
                <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase;">
                  ${esc(d.type)} / ${esc(d.category)}
                </span>
              </td>
              <td style="padding: 8px 12px; text-align: center; color: #64748B; font-size: 11px;">${tol} %</td>
              <td style="padding: 8px 12px; text-align: right; font-weight: 800; color: ${isExceeded ? '#DC2626' : '#0F172A'}; font-size: 13px;">
                ${d.countOrPercentage} %
                ${d.unidades != null
                  ? `<div style="font-size:9px; font-weight:600; color:#94A3B8; margin-top:1px;">${d.unidades} de ${d.totalFrutos} frutos</div>`
                  : ''}
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #059669; font-weight: 600; background: #F0FDF4;">✓ Sin defectos registrados en este muestreo</td></tr>`;

    const photosHTML = this.bloqueFotosHTML(box.photos, medidasFotos);

    const statusReasonsHTML = box.statusReasons && box.statusReasons.length > 0
      ? `<div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 6px; padding: 8px 12px; margin-top: 8px; font-size: 11px; color: #991B1B;">
          <strong>${isApproved ? 'Observaciones de clasificación:' : 'Causa de Objetación:'}</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0;">${box.statusReasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        </div>`
      : '';

    return `
      <div style="width: 794px; min-height: 1123px; padding: 30px; box-sizing: border-box; background: #FFFFFF; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; flex-direction: column; justify-content: space-between; color: #0F172A;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #F59E0B; padding-bottom: 14px; margin-bottom: 16px;">
            <div>
              ${this.membrete(`PROCESOS · INFORME ${especie}`, 34)}
              <div style="font-size: 11px; color: #64748B; margin-top: 5px;">Control de Calidad Packing • ${esc(process.species)}</div>
            </div>
            <div style="text-align: right;">
              <div style="background: #0F291E; color: #34D399; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; display: inline-block;">PÁGINA ${pageIndex} DE ${totalPages}</div>
              <div style="font-size: 10px; color: #94A3B8; margin-top: 3px;">Fecha: ${new Date().toLocaleDateString('es-ES')}</div>
            </div>
          </div>

          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 11px;">
              <div><span style="color:#64748B; font-size:9px; text-transform:uppercase;">N° Proceso</span><strong style="display:block;">${esc(process.processNumber)}</strong></div>
              <div><span style="color:#64748B; font-size:9px; text-transform:uppercase;">Variedad / Especie</span><strong style="color:#D97706; display:block;">${esc(process.variety)} (${esc(process.species)})</strong></div>
              <div><span style="color:#64748B; font-size:9px; text-transform:uppercase;">Categoría</span><strong style="color:#059669; display:block;">${esc(getCategoriaLabel(process.species, process.exportCategory))}</strong></div>
              <div><span style="color:#64748B; font-size:9px; text-transform:uppercase;">Productor</span><strong style="display:block;">${esc(process.producerName)} (${esc(process.producerCode)})</strong></div>
              <div><span style="color:#64748B; font-size:9px; text-transform:uppercase;">CSG / SDP</span><strong style="display:block;">CSG: ${esc(process.csg)} | SDP: ${esc(process.sdp)}</strong></div>
              <div><span style="color:#64748B; font-size:9px; text-transform:uppercase;">Lote / Fecha</span><strong style="display:block;">${esc(process.lot)} (${esc(process.receptionDate)})</strong></div>
              <div><span style="color:#64748B; font-size:9px; text-transform:uppercase;">Kg Totales</span><strong style="display:block;">${Number(process.totalKg || 0).toLocaleString()} Kg</strong></div>
              ${box.program ? `<div><span style="color:#64748B; font-size:9px; text-transform:uppercase;">Programa</span><strong style="color:${box.program === 'COSTCO' ? '#D97706' : '#059669'}; display:block;">${esc(box.program)}</strong></div>` : ''}
            </div>
          </div>

          <div style="background: #FFFFFF; border: 2px solid ${statusBorder}; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 10px; margin-bottom: 12px;">
              <div>
                <span style="font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase;">INSPECCIÓN CAJA MUESTRA N° ${box.boxNumber}</span>
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px;">
                  <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0F172A;">${caliberLabel}</h2>
                  <span style="font-size: 12px; color: #475569; background: #F1F5F9; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Diámetro: ${esc(box.diameterMm || 'N/A')} | Peso: ${esc(box.weightGr || 'N/A')}</span>
                  ${box.totalFrutos != null
                    ? `<span style="font-size: 12px; color: #92400E; background: #FEF3C7; padding: 2px 8px; border-radius: 4px; font-weight: 700;">${box.totalFrutos} frutos evaluados</span>`
                    : ''}
                  ${box.serie
                    ? `<span style="font-size: 12px; color: #065F46; background: #ECFDF5; padding: 2px 8px; border-radius: 4px; font-weight: 700;">Etiqueta ${esc(box.serie)}</span>`
                    : ''}
                </div>
              </div>
              <div style="background: ${statusBg}; border: 1.5px solid ${statusBorder}; color: ${statusColor}; font-size: 15px; font-weight: 800; padding: 6px 18px; border-radius: 20px; text-transform: uppercase;">CAJA ${box.status}</div>
            </div>
            ${statusReasonsHTML}
            ${box.colorName ? `<div style="margin-top: 10px; margin-bottom: 12px; font-size: 11px; background: #FFFBEB; border: 1px solid #FDE68A; padding: 6px 10px; border-radius: 6px; color: #92400E;"><strong>Evaluación de Color:</strong> Grado ${box.colorGrade} - ${esc(box.colorName)}</div>` : ''}
            <div>
              <div style="font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px; text-transform: uppercase;">Desglose de Defectos</div>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr style="background: #F1F5F9; color: #475569; font-size: 10px; text-transform: uppercase; text-align: left;">
                    <th style="padding: 7px 10px;">Defecto / Problema</th>
                    <th style="padding: 7px 10px; text-align: center;">Tipo / Severidad</th>
                    <th style="padding: 7px 10px; text-align: center;">Tol.</th>
                    <th style="padding: 7px 10px; text-align: right;">% Muestra</th>
                  </tr>
                </thead>
                <tbody>${defectsRows}</tbody>
              </table>
            </div>
            <div style="background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 6px; padding: 8px 12px; margin-top: 12px;">
              <span style="font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase;">Observaciones del Inspector:</span>
              <p style="margin: 2px 0 0 0; font-size: 11px; color: #334155;">${esc(box.notes || 'Sin observaciones adicionales.')}</p>
            </div>
          </div>

          <div>
            <div style="font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px; text-transform: uppercase;">Evidencia Fotográfica de la Caja</div>
            ${photosHTML}
          </div>
        </div>

        <div style="border-top: 1px solid #E2E8F0; padding-top: 12px; margin-top: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 9px; color: #64748B;">Registro: ${new Date(box.timestamp).toLocaleString('es-ES')}</div>
            <div style="font-size: 9px; color: #94A3B8; margin-top: 1px;">Control de Calidad FRUSTOCK Procesos • Norma ${esc(process.species)}</div>
          </div>
          <div style="text-align: center; width: 180px;">
            <div style="border-bottom: 1px solid #94A3B8; height: 30px; margin-bottom: 3px;"></div>
            <div style="font-size: 9px; font-weight: 700; color: #334155;">Firma Inspector de Calidad</div>
          </div>
        </div>
      </div>`;
  }
}
