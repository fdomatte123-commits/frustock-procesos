import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ProcessData } from '../types/process';

export class PDFReportGenerator {
  /**
   * Generates a PDF report enforcing exactly 1 page per sampled box.
   * If a process has N boxes, the resulting PDF will have N pages.
   */
  static async generateProcessPDF(process: ProcessData, onProgress?: (percent: number) => void): Promise<void> {
    if (!process.boxes || process.boxes.length === 0) {
      throw new Error('No hay cajas muestreadas para generar el informe PDF.');
    }

    // Create a temporary hidden container element in DOM for rendering PDF pages
    const renderContainer = document.createElement('div');
    renderContainer.id = 'frustock-pdf-render-container';
    renderContainer.style.position = 'absolute';
    renderContainer.style.left = '-9999px';
    renderContainer.style.top = '-9999px';
    renderContainer.style.width = '794px'; // A4 width at 96 DPI
    document.body.appendChild(renderContainer);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    try {
      const totalBoxes = process.boxes.length;

      for (let index = 0; index < totalBoxes; index++) {
        const box = process.boxes[index];
        if (onProgress) {
          onProgress(Math.round(((index + 1) / totalBoxes) * 100));
        }

        // Render HTML for this specific box (1 Page)
        renderContainer.innerHTML = this.buildSingleBoxPageHTML(process, box, index + 1, totalBoxes);

        // Capture page as high-res canvas
        const pageElement = renderContainer.firstElementChild as HTMLElement;
        const canvas = await html2canvas(pageElement, {
          scale: 2, // High resolution crisp text & photos
          useCORS: true,
          logging: false,
          backgroundColor: '#FFFFFF',
          width: 794,
          height: 1123
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        if (index > 0) {
          doc.addPage('a4', 'portrait');
        }

        // Add to PDF (A4 dimensions: 210mm x 297mm)
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      // Save output
      const fileName = `FRUSTOCK_Reporte_${process.processNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } finally {
      // Clean up DOM container
      if (document.body.contains(renderContainer)) {
        document.body.removeChild(renderContainer);
      }
    }
  }

  /**
   * Builds pixel-perfect A4 page HTML for a single box.
   */
  private static buildSingleBoxPageHTML(
    process: ProcessData,
    box: typeof process.boxes[0],
    pageIndex: number,
    totalPages: number
  ): string {
    const graveCount = box.defects.filter(d => d.category === 'grave').length;
    const medioCount = box.defects.filter(d => d.category === 'medio').length;
    const leveCount = box.defects.filter(d => d.category === 'leve').length;

    const photosHTML = box.photos && box.photos.length > 0
      ? box.photos.map((src, i) => `
          <div style="flex: 1; min-width: 45%; max-width: 50%; height: 190px; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; background: #F8FAFC; text-align: center; display: flex; align-items: center; justify-content: center;">
            <img src="${src}" style="width: 100%; height: 100%; object-fit: cover;" alt="Foto caja ${i + 1}" />
          </div>
        `).join('')
      : `
        <div style="width: 100%; height: 140px; border: 2px dashed #CBD5E1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 13px; font-weight: 500;">
          Sin fotografías registradas para esta caja
        </div>
      `;

    const defectsRows = box.defects && box.defects.length > 0
      ? box.defects.map(d => {
          const badgeBg = d.category === 'grave' ? '#FEE2E2' : d.category === 'medio' ? '#FEF3C7' : '#ECFDF5';
          const badgeColor = d.category === 'grave' ? '#991B1B' : d.category === 'medio' ? '#92400E' : '#065F46';
          const catLabel = d.category === 'grave' ? 'GRAVE' : d.category === 'medio' ? 'MEDIO' : 'LEVE';

          return `
            <tr style="border-bottom: 1px solid #F1F5F9;">
              <td style="padding: 10px 12px; font-weight: 600; color: #1E293B;">${d.name}</td>
              <td style="padding: 10px 12px; text-align: center;">
                <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                  ${catLabel}
                </span>
              </td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #0F172A;">
                ${d.countOrPercentage} ${d.unit}
              </td>
            </tr>
          `;
        }).join('')
      : `
        <tr>
          <td colspan="3" style="padding: 18px; text-align: center; color: #059669; font-weight: 600; background: #F0FDF4; border-radius: 6px;">
            ✓ Sin defectos registrados en este muestreo
          </td>
        </tr>
      `;

    return `
      <div style="width: 794px; height: 1123px; padding: 32px; box-sizing: border-box; background: #FFFFFF; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; flex-direction: column; justify-content: space-between; color: #0F172A;">
        
        <!-- HEADER DE LA PÁGINA / MARCA Y PROCESO -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 20px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="background: #059669; color: white; font-weight: 800; font-size: 18px; padding: 4px 10px; border-radius: 6px; font-family: 'Outfit', sans-serif;">FRUSTOCK</div>
                <span style="font-size: 14px; font-weight: 700; color: #475569; letter-spacing: 0.5px;">PROCESOS • INFORME DE MUESTREO</span>
              </div>
              <div style="font-size: 12px; color: #64748B; margin-top: 4px;">Control de Calidad en Planta de Empaque</div>
            </div>
            <div style="text-align: right;">
              <div style="background: #0F291E; color: #34D399; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; display: inline-block;">
                PÁGINA ${pageIndex} DE ${totalPages}
              </div>
              <div style="font-size: 11px; color: #94A3B8; margin-top: 4px;">Fecha emisión: ${new Date().toLocaleDateString('es-ES')}</div>
            </div>
          </div>

          <!-- FICHA TÉCNICA DEL PROCESO -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
            <div style="font-size: 11px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">
              Datos Generales del Proceso
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 12px;">
              <div>
                <span style="color: #64748B; display: block; font-size: 10px; text-transform: uppercase;">N° Proceso</span>
                <strong style="color: #0F172A; font-size: 13px;">${process.processNumber}</strong>
              </div>
              <div>
                <span style="color: #64748B; display: block; font-size: 10px; text-transform: uppercase;">Variedad</span>
                <strong style="color: #059669; font-size: 13px;">${process.variety}</strong>
              </div>
              <div>
                <span style="color: #64748B; display: block; font-size: 10px; text-transform: uppercase;">Productor</span>
                <strong style="color: #0F172A; font-size: 13px;">${process.producerName} (${process.producerCode})</strong>
              </div>
              <div>
                <span style="color: #64748B; display: block; font-size: 10px; text-transform: uppercase;">CSG / SDP</span>
                <strong style="color: #0F172A;">CSG: ${process.csg} | SDP: ${process.sdp}</strong>
              </div>
              <div>
                <span style="color: #64748B; display: block; font-size: 10px; text-transform: uppercase;">Lote / Recept.</span>
                <strong style="color: #0F172A;">${process.lot} (${process.receptionDate})</strong>
              </div>
              <div>
                <span style="color: #64748B; display: block; font-size: 10px; text-transform: uppercase;">Total Kilos</span>
                <strong style="color: #0F172A;">${process.totalKg.toLocaleString()} Kg</strong>
              </div>
            </div>
          </div>

          <!-- DETALLE ESPECÍFICO DE LA CAJA -->
          <div style="background: #FFFFFF; border: 2px solid #059669; border-radius: 12px; padding: 18px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px; margin-bottom: 14px;">
              <div>
                <span style="background: #D1FAE5; color: #065F46; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">
                  MUESTREO DE CAJA
                </span>
                <h2 style="margin: 6px 0 0 0; font-size: 22px; font-weight: 800; color: #0F172A; font-family: 'Outfit', sans-serif;">
                  CAJA MUESTRA N° ${box.boxNumber}
                </h2>
              </div>

              <div style="text-align: right;">
                <div style="font-size: 10px; color: #64748B; font-weight: 700; text-transform: uppercase;">Calibre Evaluado</div>
                <div style="font-size: 20px; font-weight: 800; color: #059669; background: #F0FDF4; border: 1px solid #A7F3D0; padding: 4px 16px; border-radius: 8px; display: inline-block; margin-top: 2px;">
                  ${box.caliber}
                </div>
              </div>
            </div>

            <!-- TABLA DE DEFECTOS REGISTRADOS -->
            <div style="margin-bottom: 16px;">
              <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span>RESUMEN DE DEFECTOS DETECTADOS</span>
                <div style="font-size: 11px; font-weight: 600;">
                  <span style="color: #DC2626; margin-right: 8px;">● Graves: ${graveCount}</span>
                  <span style="color: #D97706; margin-right: 8px;">● Medios: ${medioCount}</span>
                  <span style="color: #059669;">● Leves: ${leveCount}</span>
                </div>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #F1F5F9; color: #475569; font-size: 11px; text-transform: uppercase; text-align: left;">
                    <th style="padding: 8px 12px;">Defecto / Desviación</th>
                    <th style="padding: 8px 12px; text-align: center;">Severidad</th>
                    <th style="padding: 8px 12px; text-align: right;">Cantidad / Impacto</th>
                  </tr>
                </thead>
                <tbody>
                  ${defectsRows}
                </tbody>
              </table>
            </div>

            <!-- SECCIÓN DE OBSERVACIONES -->
            <div style="background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 10px 14px;">
              <span style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase;">Observaciones del Inspector:</span>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #334155; font-style: ${box.notes ? 'normal' : 'italic'};">
                ${box.notes || 'Sin observaciones adicionales registradas.'}
              </p>
            </div>
          </div>

          <!-- REGISTRO FOTOGRÁFICO DE LA CAJA -->
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px;">
              REGISTRO FOTOGRÁFICO DE LA CAJA Y FRUTA
            </div>
            <div style="display: flex; gap: 14px; justify-content: space-between;">
              ${photosHTML}
            </div>
          </div>
        </div>

        <!-- FOOTER FIRMA E INSPECCIÓN -->
        <div style="border-top: 1px solid #E2E8F0; padding-top: 16px; margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 10px; color: #64748B;">Hora de registro: ${new Date(box.timestamp).toLocaleString('es-ES')}</div>
            <div style="font-size: 10px; color: #94A3B8; margin-top: 2px;">Sistema de Control de Calidad FRUSTOCK Procesos</div>
          </div>

          <div style="text-align: center; width: 200px;">
            <div style="border-bottom: 1px solid #94A3B8; height: 35px; margin-bottom: 4px;"></div>
            <div style="font-size: 10px; font-weight: 700; color: #334155;">Firma Inspector de Calidad</div>
          </div>
        </div>

      </div>
    `;
  }
}
