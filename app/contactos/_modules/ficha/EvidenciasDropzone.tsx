"use client";

// ============================================================================
// app/contactos/_modules/ficha/EvidenciasDropzone.tsx
//
// @role: @Frontend-UX
// @spec: FASE 13.06 — Documentos Probatorios en Relaciones
//
// Dropzone + lista de evidencias vinculadas a una relación.
// Se usa dentro del formulario de edición de relación (TabEcosistema).
// ============================================================================

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Trash2, AlertCircle, FileCheck2 } from "lucide-react";
import { detachEvidencia, getEvidenciasDeRelacion } from "@/lib/modules/entidades/actions/evidencias.actions";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface EvidenciaItem {
  id: string;
  nombre: string;
  mime_type: string | null;
  size_bytes: number | null;
  drive_file_id: string | null;
  created_at: Date;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeIcon(mime: string | null): string {
  if (!mime) return "📄";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("word") || mime.includes("document")) return "📘";
  if (mime.includes("sheet") || mime.includes("excel")) return "📗";
  if (mime.includes("image")) return "🖼️";
  return "📄";
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ─── Componente ─────────────────────────────────────────────────────────────

export function EvidenciasDropzone({
  relacionId,
  contactoId,
  evidencias: initialEvidencias,
  onUpdate,
}: {
  relacionId: string;
  contactoId: string;
  evidencias: EvidenciaItem[];
  onUpdate?: () => void;
}) {
  const [evidencias, setEvidencias] = useState<EvidenciaItem[]>(initialEvidencias);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadEvidencias = useCallback(async () => {
    const res = await getEvidenciasDeRelacion(relacionId);
    if (res.ok) setEvidencias(res.data as EvidenciaItem[]);
    onUpdate?.();
  }, [relacionId, onUpdate]);

  // ── Upload logic ──────────────────────────────────────────────────────
  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" supera el límite de 50MB`);
        continue;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("relacion_id", relacionId);
        formData.append("contacto_id", contactoId);

        const res = await fetch("/api/boveda/upload-evidencia", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "Error al subir archivo");
        }
      } catch {
        setError(`Error al subir "${file.name}"`);
      }
    }

    setUploading(false);
    await reloadEvidencias();
  }, [relacionId, contactoId, reloadEvidencias]);

  // ── Drag & Drop handlers ──────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [uploadFiles]);

  // ── Delete handler ────────────────────────────────────────────────────
  const handleDetach = useCallback(async (evidenciaId: string) => {
    const res = await detachEvidencia(evidenciaId, contactoId);
    if (res.ok) {
      await reloadEvidencias();
    } else {
      setError(res.error);
    }
  }, [contactoId, reloadEvidencias]);

  return (
    <div className="space-y-2">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        Documentos probatorios
      </label>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 rounded-md border border-red-800/40 bg-red-950/20 px-2.5 py-1.5 text-[10px] text-red-400">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-300">✕</button>
        </div>
      )}

      {/* Existing evidencias list */}
      {evidencias.length > 0 && (
        <div className="space-y-1">
          {evidencias.map((ev) => (
            <div
              key={ev.id}
              className="group flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5"
            >
              <span className="text-sm" aria-hidden>{getMimeIcon(ev.mime_type)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-zinc-300">{ev.nombre}</p>
                <p className="text-[9px] text-zinc-600">
                  {formatFileSize(ev.size_bytes)}
                  {ev.drive_file_id?.startsWith("stub_") && (
                    <span className="ml-1.5 text-amber-600">(pendiente Drive)</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => handleDetach(ev.id)}
                className="shrink-0 rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-red-950/30 hover:text-red-400 group-hover:opacity-100"
                title="Desvincular evidencia"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed
          px-3 py-4 transition-colors
          ${isDragOver
            ? "border-orange-500/60 bg-orange-500/5"
            : "border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/40"
          }
          ${uploading ? "pointer-events-none opacity-50" : ""}
        `}
      >
        {uploading ? (
          <>
            <FileCheck2 className="h-5 w-5 animate-pulse text-orange-500" />
            <p className="text-[10px] text-orange-400">Subiendo archivo...</p>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-zinc-600" />
            <p className="text-[10px] text-zinc-500">
              Arrastra archivos aquí o <span className="text-orange-400">haz clic</span>
            </p>
            <p className="text-[9px] text-zinc-700">PDF, Word, Excel, imágenes — máx. 50MB</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              uploadFiles(e.target.files);
              e.target.value = "";
            }
          }}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
        />
      </div>

      {/* Counter */}
      {evidencias.length > 0 && (
        <p className="text-[9px] text-zinc-600 text-right">
          {evidencias.length} evidencia{evidencias.length !== 1 ? "s" : ""} vinculada{evidencias.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ─── Mini badge for relation cards (shows count) ────────────────────────────

export function EvidenciasBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-zinc-500">
      <FileText className="h-2.5 w-2.5" />
      {count}
    </span>
  );
}
