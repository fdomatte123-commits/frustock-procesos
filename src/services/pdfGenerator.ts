import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ProcessData, getTolerance } from '../types/process';

// Escapa texto para insertarlo con seguridad dentro de innerHTML
function esc(s: any): string {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

export class PDFReportGenerator {
  /**
   * Genera un PDF con exactamente 1 página por caja muestreada.
   * El contenido fluye a su altura natural y se ajusta a la página sin recortar.
   */
  static async generateProcessPDF(process: ProcessData, onProgress?: (percent: number) => void): Promise<void> {
    if (!process.boxes || process.boxes.length === 0) {
      throw new Error('No hay cajas muestreadas para generar el informe PDF.');
    }

    const renderContainer = document.createElement('div');
    renderContainer.style.position = 'absolute';
    renderContainer.style.left = '-9999px';
    renderContainer.style.top = '-9999px';
    renderContainer.style.width = '794px';
    document.body.appendChild(renderContainer);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;

    try {
      const totalBoxes = process.boxes.length;

      for (let index = 0; index < totalBoxes; index++) {
        const box = process.boxes[index];
        if (onProgress) onProgress(Math.round(((index + 1) / totalBoxes) * 100));

        renderContainer.innerHTML = this.buildSingleBoxPageHTML(process, box, index + 1, totalBoxes);
        const pageElement = renderContainer.firstElementChild as HTMLElement;

        // Sin height fija: html2canvas captura la altura real (no recorta)
        const canvas = await html2canvas(pageElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#FFFFFF',
          width: 794
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.92);

        if (index > 0) doc.addPage('a4', 'portrait');

        // Ajustar a una página preservando proporción (si sobra alto, se reduce)
        let renderW = pageW;
        let renderH = (canvas.height * pageW) / canvas.width;
        if (renderH > pageH) {
          renderH = pageH;
          renderW = (canvas.width * pageH) / canvas.height;
        }
        const offsetX = (pageW - renderW) / 2;
        doc.addImage(imgData, 'JPEG', offsetX, 0, renderW, renderH);
      }

      const especie = process.species || 'Naranja';
      const num = (process.processNumber || 'SN').toString().replace(/[\/\\?%*:|"<>]/g, '');
      const fileName = `FRUSTOCK_${especie}_${num}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } finally {
      if (document.body.contains(renderContainer)) {
        document.body.removeChild(renderContainer);
      }
    }
  }

  private static buildSingleBoxPageHTML(
    process: ProcessData,
    box: typeof process.boxes[0],
    pageIndex: number,
    totalPages: number
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
              </td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #059669; font-weight: 600; background: #F0FDF4;">✓ Sin defectos registrados en este muestreo</td></tr>`;

    const photosHTML = box.photos && box.photos.length > 0
      ? box.photos.map((src, i) => `
          <div style="flex: 1; min-width: 45%; max-width: 50%; height: 180px; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; background: #F8FAFC;">
            <img src="${src}" style="width: 100%; height: 100%; object-fit: cover;" alt="Foto ${i + 1}" />
          </div>`).join('')
      : `<div style="width: 100%; height: 110px; border: 2px dashed #CBD5E1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 12px;">Sin registro fotográfico en esta caja</div>`;

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
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="background: #F59E0B; color: white; font-weight: 800; font-size: 17px; padding: 4px 10px; border-radius: 6px; font-family: 'Outfit', sans-serif;">FRUSTOCK</div>
                <span style="font-size: 13px; font-weight: 800; color: #334155; letter-spacing: 0.5px;">PROCESOS • INFORME ${especie}</span>
              </div>
              <div style="font-size: 11px; color: #64748B; margin-top: 3px;">Control de Calidad Packing • ${esc(process.species)}</div>
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
              <div><span style="color:#64748B; font-size:9px; text-transform:uppercase;">Categoría</span><strong style="color:#059669; display:block;">${esc(process.exportCategory)}</strong></div>
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
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">${photosHTML}</div>
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
