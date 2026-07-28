# 🍇 FRUSTOCK Procesos — Control de Calidad Packing

[![Firebase Status](https://img.shields.io/badge/Firebase%20Hosting-En%20Vivo-059669?style=for-the-badge&logo=firebase)](https://studio-4593459646-8ec4f.web.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)

Aplicación móvil PWA diseñada para el **control de calidad de cajas terminadas** en procesos de empaque frutícola (Packing). Permite a los inspectores de calidad registrar la información general del proceso y realizar muestreos de calidad caja por caja en tiempo real, finalizando con la generación de un informe PDF exportable de **1 página por caja**.

🌐 **Demo en vivo**: [https://studio-4593459646-8ec4f.web.app](https://studio-4593459646-8ec4f.web.app)

---

## 🎯 Características Principales

- **Pantalla 1: Datos del Proceso (Formulario Inicial)**
  - Registro de datos de recepción: *Número de Proceso, Variedad, Código Productor, Productor, CSG, SDP, Fecha de Recepción, Lote y Kg Totales*.
  - Botón de autocompletado con datos de prueba (*Ejemplo Demo*).
  
- **Pantalla 2: Muestreo de Cajas (Inspección en Tiempo Real)**
  - Selección rápida de Calibres (*Calibre 88, 56, 70, Jumbo, XL, etc.*).
  - Captura / Carga de fotografías de la fruta evaluada.
  - Registro dinámico de defectos clasificados por severidad (**Grave**, **Medio**, **Leve**).
  - Opción de guardar e inspeccionar múltiples cajas continuamente.

- **Módulo de Reportes PDF (Regla de Oro)**
  - Generación de informes PDF maquetados a **1 página por cada caja muestreada** (ej: 10 cajas = 10 páginas), garantizando orden visual y sin saturación.

- **Fase 2 (Roadmap) — Escáner QR**
  - Módulo desacoplado `QRScannerService` listo para conectar la lectura de etiquetas del packing.

---

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: Vanilla CSS con tokens modernos y diseño adaptativo para móviles/tablets
- **Despliegue**: Firebase Hosting (Offline-first Ready)
- **PDF Engine**: `jsPDF` + `html2canvas`

---

## 🚀 Instalación y Desarrollo Local

```bash
# Clonar el repositorio
git clone https://github.com/fdomatte123-commits/frustock-procesos.git
cd frustock-procesos

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

---

Desarrollado para **FRUSTOCK Procesos** • Control de Calidad Frutícola.
