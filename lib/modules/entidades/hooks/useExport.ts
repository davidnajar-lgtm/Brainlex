"use client";

import { useState, useCallback } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ExportFormat = "print" | "pdf" | "excel";

export interface ExportOptions {
  /** Nombre base del archivo descargado (sin extensión). */
  filename?: string;
  /** Título visible en el encabezado del documento exportado. */
  title?: string;
}

export interface ExcelExportOptions {
  /** Nombre base del archivo .xlsx descargado. */
  filename?: string;
  /** Nombre de la hoja de cálculo. */
  sheetName?: string;
}

export interface UseExportReturn {
  /** true mientras se genera una exportación asíncrona. */
  isExporting: boolean;
  /** Lanza window.print() — respeta las clases print:hidden del DOM. */
  exportToPrint: () => void;
  /**
   * Genera y descarga un PDF real.
   * TODO Fase 3: @react-pdf/renderer · jsPDF + html2canvas · Puppeteer
   */
  exportToPdf: (options?: ExportOptions) => Promise<void>;
  /**
   * Exporta el listado a Excel (.xlsx).
   * TODO Fase 3: xlsx (SheetJS) · ExcelJS · API server-side
   */
  exportToExcel: (options?: ExcelExportOptions) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPrint = useCallback(() => {
    window.print();
  }, []);

  // STUB — Fase 3: sustituir por implementación real de PDF
  const exportToPdf = useCallback(async (_options?: ExportOptions) => {
    setIsExporting(true);
    try {
      throw new Error(
        "exportToPdf: no implementado. Pendiente de decisión técnica en Fase 3."
      );
    } finally {
      setIsExporting(false);
    }
  }, []);

  // STUB — Fase 3: sustituir por generación real de Excel
  const exportToExcel = useCallback(async (_options?: ExcelExportOptions) => {
    setIsExporting(true);
    try {
      throw new Error(
        "exportToExcel: no implementado. Candidatos Fase 3: xlsx (SheetJS) · ExcelJS · API server-side."
      );
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { isExporting, exportToPrint, exportToPdf, exportToExcel };
}
