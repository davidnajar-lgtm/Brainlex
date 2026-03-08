// ============================================================================
// lib/modules/entidades/services/export.service.ts — Output Layer
//
// Fase 2: buildMailtoUri disponible y funcional.
// Fase 3: generatePDF + sendEntityByEmail con implementación real.
// ============================================================================

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface ExportableContact {
  id:       string;
  name:     string;
  fiscalId?: string;
  email?:   string;
  phone?:   string;
  /** Ej: ["Matriz", "Cliente", "Pre-cliente"] o [] */
  roles:    string[];
  status:   string;
}

export interface GeneratePdfOptions {
  contact: ExportableContact;
  /** Incluir expedientes vinculados. Default: false. */
  includeExpedientes?: boolean;
  /** Incluir historial de comunicaciones. Default: false. */
  includeCommunications?: boolean;
}

export interface ExcelExportOptions {
  /** Nombre base del archivo .xlsx descargado. */
  filename?: string;
  /** Nombre de la hoja de cálculo. Default: "Contactos". */
  sheetName?: string;
}

export interface SendEntityByEmailOptions {
  contact: ExportableContact;
  /** Destinatario. Si se omite, el cliente de email lo rellenará manualmente. */
  to?: string;
  subject?: string;
  message?: string;
}

// ─── Fase 3 — stubs tipados ────────────────────────────────────────────────────

/**
 * Genera un PDF de la ficha del contacto y lo devuelve como Blob.
 * TODO Fase 3: candidatos — @react-pdf/renderer · jsPDF + html2canvas · Puppeteer (SSR)
 */
export async function generatePDF(_options: GeneratePdfOptions): Promise<Blob> {
  throw new Error(
    "generatePDF: no implementado. Pendiente de decisión técnica en Fase 3.\n" +
    "Candidatos: @react-pdf/renderer · jsPDF + html2canvas · Puppeteer (SSR)"
  );
}

/**
 * Envía la ficha del contacto por email vía Server Action + proveedor SMTP.
 * TODO Fase 3: conectar con SendGrid / Resend / SMTP interno.
 */
export async function sendEntityByEmail(
  _options: SendEntityByEmailOptions
): Promise<void> {
  throw new Error(
    "sendEntityByEmail: no implementado. Pendiente de integración SMTP en Fase 3."
  );
}

/**
 * Exporta el listado de contactos a un archivo Excel (.xlsx).
 * TODO Fase 3: candidatos — xlsx (SheetJS) · ExcelJS · endpoint server-side con streaming.
 */
export async function exportToExcel(_options?: ExcelExportOptions): Promise<void> {
  throw new Error(
    "exportToExcel: no implementado. Candidatos Fase 3: xlsx (SheetJS) · ExcelJS · API server-side."
  );
}

// ─── Fase 2 — helpers operativos ──────────────────────────────────────────────

/**
 * Copia al portapapeles la lista de emails del directorio filtrado.
 *
 * @param emails  Array de direcciones de email (strings no vacíos).
 * @returns       Número de emails copiados.
 * @throws        Si el navegador no soporta clipboard API o el permiso es denegado.
 */
export async function copyEmailsToClipboard(emails: string[]): Promise<number> {
  const valid = emails.filter((e) => e.trim().length > 0);
  if (valid.length === 0) return 0;
  await navigator.clipboard.writeText(valid.join(", "));
  return valid.length;
}

/**
 * Construye un URI mailto: con el resumen del contacto pre-rellenado.
 *
 * @param contact   Datos del contacto a incluir en el cuerpo.
 * @param currentUrl URL de la ficha (inyectada desde el cliente para incluir
 *                   el enlace directo). Omitir en contextos SSR/test.
 */
export function buildMailtoUri(
  contact: ExportableContact,
  currentUrl?: string
): string {
  const roles = contact.roles.length > 0 ? contact.roles.join(", ") : "Contacto Base";

  const bodyLines = [
    `Nombre: ${contact.name}`,
    contact.fiscalId ? `NIF / ID Fiscal: ${contact.fiscalId}` : null,
    contact.email    ? `Email: ${contact.email}`               : null,
    contact.phone    ? `Teléfono: ${contact.phone}`            : null,
    `Roles: ${roles}`,
    `Estado: ${contact.status}`,
    currentUrl       ? `\nFicha completa: ${currentUrl}`       : null,
  ]
    .filter(Boolean)
    .join("\n");

  const subject = encodeURIComponent(`Ficha de contacto — ${contact.name}`);
  const body    = encodeURIComponent(bodyLines);

  return `mailto:?subject=${subject}&body=${body}`;
}
