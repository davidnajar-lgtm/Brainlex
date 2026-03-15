"use client";

// ============================================================================
// app/contactos/_modules/ficha/TabBoveda.tsx — Visor de Bóveda Documental
//
// @role: @Frontend-UX / @Doc-Specialist
// @spec: Visor de Bóveda — Renderiza árbol de carpetas desde BD
//
// Funcionalidades:
//   - Árbol jerárquico expandible/colapsable
//   - Carpetas INTELIGENTE con icono diferenciado
//   - Carpetas blueprint marcadas como inmutables (candado)
//   - Archivos listados dentro de cada carpeta
//   - Botón "Nueva carpeta" (abre Modal Consejero)
//   - Drag & Drop de archivos/carpetas entre nodos
// ============================================================================

import { useState, useEffect, useCallback, useTransition, type DragEvent } from "react";
import {
  Folder,
  FolderOpen,
  FolderLock,
  FolderPlus,
  File,
  FileText,
  FileImage,
  ChevronRight,
  ChevronDown,
  Zap,
  Trash2,
  GripVertical,
  Loader2,
  Download,
  ShieldCheck,
} from "lucide-react";
import { DOC_PERMANENTE_NOMBRE } from "@/lib/services/docPermanente.constants";
import type { CarpetaNode } from "@/lib/services/bovedaTree.service";
import {
  getCarpetasTree,
  createCarpetaManual,
  moveCarpeta,
  deleteCarpeta,
  moveArchivo,
} from "@/lib/modules/entidades/actions/boveda.actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface TabBovedaProps {
  contactoId: string;
  onOpenConsejero?: () => void;
  /** Incrementar para forzar recarga del árbol (tras asignar etiquetas). */
  reloadKey?: number;
  /** Tenant activo ("LX" | "LW") para filtrar carpetas por visibilidad. */
  tenantId?: string | null;
}

interface DragPayload {
  type: "carpeta" | "archivo";
  id: string;
  sourceCarpetaId?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("pdf") || mimeType.includes("document")) return FileText;
  return File;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Input reutilizable para crear carpeta ──────────────────────────────────

function QuickCreateInput({
  value,
  onChange,
  onConfirm,
  onCancel,
  depth = 0,
}: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  depth?: number;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-md bg-zinc-900/80 p-1.5 ring-1 ring-zinc-800 my-0.5"
      style={{ marginLeft: depth > 0 ? `${depth * 16 + 4}px` : undefined }}
    >
      <FolderPlus className="h-3 w-3 text-blue-400 shrink-0" />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirm();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Nombre de la carpeta..."
        className="flex-1 bg-transparent text-xs text-zinc-300 placeholder:text-zinc-700 outline-none"
      />
      <button
        onClick={onConfirm}
        disabled={!value.trim()}
        className="rounded bg-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-600 disabled:opacity-40"
      >
        Crear
      </button>
      <button
        onClick={onCancel}
        className="text-[11px] text-zinc-600 hover:text-zinc-400"
      >
        Cancelar
      </button>
    </div>
  );
}

// ─── Componente de nodo del árbol ───────────────────────────────────────────

function CarpetaTreeNode({
  node,
  depth,
  onDelete,
  onDrop,
  onDownload,
  onCreateSub,
  selectedNodeId,
  onSelect,
  quickCreateParentId,
  newFolderName,
  onNewFolderNameChange,
  onQuickCreateConfirm,
  onQuickCreateCancel,
  downloading,
  dragPayload,
  setDragPayload,
}: {
  node: CarpetaNode;
  depth: number;
  onDelete: (id: string, nombre: string, esBlueprint: boolean) => void;
  onDrop: (targetId: string) => void;
  onDownload: (carpetaId: string) => void;
  onCreateSub: (parentId: string) => void;
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
  quickCreateParentId: string | null | false;
  newFolderName: string;
  onNewFolderNameChange: (v: string) => void;
  onQuickCreateConfirm: () => void;
  onQuickCreateCancel: () => void;
  downloading: boolean;
  dragPayload: DragPayload | null;
  setDragPayload: (p: DragPayload | null) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = node.children.length > 0 || node.archivos.length > 0;
  const isBlueprint = node.es_blueprint;
  const isInteligente = node.tipo === "INTELIGENTE";
  const isSelected = selectedNodeId === node.id;
  const isDocPermanente = node.nombre === DOC_PERMANENTE_NOMBRE && depth === 0;

  const FolderIcon = isDocPermanente
    ? ShieldCheck
    : isBlueprint
      ? FolderLock
      : expanded
        ? FolderOpen
        : Folder;

  const folderColorClass = isDocPermanente
    ? "text-emerald-400"
    : isBlueprint
      ? "text-amber-400"
      : isInteligente
        ? "text-blue-400"
        : "text-zinc-300";

  // Drag handlers para carpetas
  function handleDragStart(e: DragEvent) {
    if (isBlueprint) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = "move";
    setDragPayload({ type: "carpeta", id: node.id });
  }

  function handleDragOver(e: DragEvent) {
    if (!dragPayload) return;
    if (dragPayload.type === "carpeta" && dragPayload.id === node.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }

  function handleDragLeave() { setDragOver(false); }

  function handleDropOnNode(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!dragPayload) return;
    onDrop(node.id);
  }

  return (
    <div>
      {/* Folder row */}
      <div
        className={`group flex items-center gap-1 rounded px-1 py-0.5 cursor-pointer select-none transition-colors
          ${dragOver
            ? "bg-blue-500/20 ring-1 ring-blue-500/40"
            : isSelected
              ? "bg-blue-500/15 ring-1 ring-blue-500/30"
              : "hover:bg-zinc-800/50"
          }
        `}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        draggable={!isBlueprint}
        onClick={() => onSelect(isSelected ? null : node.id)}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropOnNode}
        onDragEnd={() => setDragPayload(null)}
      >
        {/* Expand/collapse */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="shrink-0 p-0.5 text-zinc-600 hover:text-zinc-400"
          aria-label={expanded ? "Colapsar" : "Expandir"}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : (
            <span className="inline-block h-3 w-3" />
          )}
        </button>

        {/* Drag grip (solo si no es blueprint) */}
        {!isBlueprint && (
          <GripVertical className="h-3 w-3 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab" />
        )}

        {/* Icon */}
        <span
          title={
            isDocPermanente
              ? "Documentación Permanente — NIF, Escrituras, Poderes. Compartida con todo el Holding."
              : isBlueprint
                ? "Estructura de plantilla — no se puede mover ni borrar"
                : isInteligente
                  ? "Carpeta creada automáticamente por asignación de servicio"
                  : undefined
          }
          className="shrink-0 flex items-center"
        >
          <FolderIcon className={`h-3.5 w-3.5 ${folderColorClass}`} />
        </span>

        {/* Name */}
        <span className={`text-xs truncate flex-1 ${isBlueprint ? "text-zinc-400" : "text-zinc-300"}`}>
          {node.nombre}
        </span>

        {/* Badges */}
        {isDocPermanente && (
          <span className="rounded bg-emerald-950/30 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-300 shrink-0" title="Documentación compartida con todo el Holding">UNIVERSAL</span>
        )}
        {isInteligente && !isBlueprint && !isDocPermanente && (
          <Zap className="h-2.5 w-2.5 text-blue-500/50 shrink-0" />
        )}
        {isBlueprint && !isDocPermanente && (
          <span className="rounded bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-amber-300 shrink-0">BLUEPRINT</span>
        )}

        {/* File count */}
        {node.archivos.length > 0 && (
          <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">
            {node.archivos.length}
          </span>
        )}

        {/* Download carpeta */}
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(node.id); }}
          disabled={downloading}
          className="p-0.5 text-zinc-700 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title="Descargar carpeta (.zip)"
        >
          <Download className="h-3 w-3" />
        </button>

        {/* Crear subcarpeta dentro de esta carpeta */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); onCreateSub(node.id); }}
          className="p-0.5 text-zinc-700 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title="Nueva subcarpeta aquí"
        >
          <FolderPlus className="h-3 w-3" />
        </button>

        {/* Delete (solo carpetas no-blueprint) */}
        {!isBlueprint && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.nombre, isBlueprint); }}
            className="p-0.5 text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
            title="Eliminar carpeta"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Children + files + inline create */}
      {expanded && (
        <div>
          {/* Subcarpetas */}
          {node.children.map((child) => (
            <CarpetaTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onDelete={onDelete}
              onDrop={onDrop}
              onDownload={onDownload}
              onCreateSub={onCreateSub}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              quickCreateParentId={quickCreateParentId}
              newFolderName={newFolderName}
              onNewFolderNameChange={onNewFolderNameChange}
              onQuickCreateConfirm={onQuickCreateConfirm}
              onQuickCreateCancel={onQuickCreateCancel}
              downloading={downloading}
              dragPayload={dragPayload}
              setDragPayload={setDragPayload}
            />
          ))}

          {/* Quick-create inline dentro de esta carpeta */}
          {quickCreateParentId === node.id && (
            <QuickCreateInput
              value={newFolderName}
              onChange={onNewFolderNameChange}
              onConfirm={onQuickCreateConfirm}
              onCancel={onQuickCreateCancel}
              depth={depth + 1}
            />
          )}

          {/* Archivos */}
          {node.archivos.map((archivo) => {
            const IconComp = getFileIcon(archivo.mime_type);
            return (
              <div
                key={archivo.id}
                className="group flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-zinc-800/30 cursor-default"
                style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDragPayload({ type: "archivo", id: archivo.id, sourceCarpetaId: node.id });
                }}
                onDragEnd={() => setDragPayload(null)}
              >
                <span className="inline-block h-3 w-3 shrink-0" /> {/* spacer for alignment */}
                <IconComp className="h-3 w-3 text-zinc-600 shrink-0" />
                <span className="text-[11px] text-zinc-500 truncate flex-1">{archivo.nombre}</span>
                {archivo.size_bytes && (
                  <span className="text-[10px] text-zinc-700 tabular-nums shrink-0">
                    {formatSize(archivo.size_bytes)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────

export function TabBoveda({ contactoId, onOpenConsejero, reloadKey = 0, tenantId }: TabBovedaProps) {
  const [tree, setTree] = useState<CarpetaNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);

  // Confirm dialog state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nombre: string } | null>(null);

  // Selección de carpeta activa (para crear subcarpeta con botón header)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Quick-create state (parentId = null → raíz, string → dentro de carpeta)
  const [quickCreateParentId, setQuickCreateParentId] = useState<string | null | false>(false);
  const [newFolderName, setNewFolderName] = useState("");
  const quickCreate = quickCreateParentId !== false;

  // Download state
  const [downloading, setDownloading] = useState(false);

  const reload = useCallback(async () => {
    const data = await getCarpetasTree(contactoId, tenantId);
    setTree(data);
    setLoading(false);
  }, [contactoId, tenantId]);

  // Reload on mount AND when reloadKey changes (tras asignar etiquetas)
  useEffect(() => { reload(); }, [reload, reloadKey]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  function handleDelete(id: string, nombre: string, esBlueprint: boolean) {
    if (esBlueprint) return;
    setDeleteTarget({ id, nombre });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteCarpeta(deleteTarget.id, tenantId);
    if (result.ok) await reload();
    else alert(result.error);
    setDeleteTarget(null);
  }

  function handleDrop(targetCarpetaId: string) {
    if (!dragPayload) return;
    startTransition(async () => {
      if (dragPayload.type === "carpeta") {
        await moveCarpeta(dragPayload.id, targetCarpetaId, 0, tenantId);
      } else if (dragPayload.type === "archivo") {
        await moveArchivo(dragPayload.id, targetCarpetaId, contactoId, tenantId);
      }
      setDragPayload(null);
      await reload();
    });
  }

  async function handleQuickCreate() {
    if (!newFolderName.trim()) return;
    const parentId = quickCreateParentId === false ? null : quickCreateParentId;
    const result = await createCarpetaManual(contactoId, newFolderName.trim(), parentId, tenantId);
    if (result.ok) {
      setNewFolderName("");
      setQuickCreateParentId(false);
      await reload();
    }
  }

  function handleCreateSub(parentId: string) {
    setQuickCreateParentId(parentId);
    setNewFolderName("");
  }

  /** Descarga ZIP de la bóveda completa o de una carpeta específica. */
  async function handleDownloadZip(carpetaId?: string) {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ contactoId });
      if (carpetaId) params.set("carpetaId", carpetaId);

      const res = await fetch(`/api/boveda/download?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Error de descarga" }));
        alert(body.error || "Error al generar el archivo ZIP.");
        return;
      }

      // Descargar el blob y trigger link
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fileName = match?.[1] ?? "Boveda.zip";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Boveda Documental
        </h3>
        <div className="flex items-center gap-1.5">
          {onOpenConsejero && (
            <button
              onClick={onOpenConsejero}
              className="flex items-center gap-1 rounded-md bg-blue-600/10 px-2 py-1 text-[11px] font-medium text-blue-400 ring-1 ring-blue-500/20 transition-colors hover:bg-blue-600/20"
            >
              <Zap className="h-3 w-3" />
              Consejero
            </button>
          )}
          {tree.length > 0 && (
            <button
              onClick={() => handleDownloadZip()}
              disabled={downloading}
              className="flex items-center gap-1 rounded-md bg-emerald-600/10 px-2 py-1 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/20 transition-colors hover:bg-emerald-600/20 disabled:opacity-40"
              title="Descargar toda la bóveda como archivo ZIP"
            >
              {downloading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {downloading ? "Generando..." : "Descargar (.zip)"}
            </button>
          )}
          <button
            onClick={() => {
              setQuickCreateParentId(selectedNodeId);
              setNewFolderName("");
            }}
            className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-400 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
          >
            <FolderPlus className="h-3 w-3" />
            {selectedNodeId ? "Nueva subcarpeta" : "Nueva carpeta"}
          </button>
        </div>
      </div>

      {/* Quick create inline — solo se muestra aquí si el padre es null (raíz) */}
      {quickCreate && quickCreateParentId === null && (
        <QuickCreateInput
          value={newFolderName}
          onChange={setNewFolderName}
          onConfirm={handleQuickCreate}
          onCancel={() => { setQuickCreateParentId(false); setNewFolderName(""); }}
        />
      )}

      {/* Tree */}
      {tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/70">
            <FolderLock className="h-5 w-5 text-zinc-500" />
          </div>
          <h3 className="mt-3 text-xs font-semibold text-zinc-400">Boveda vacia</h3>
          <p className="mt-1 max-w-xs text-[11px] text-zinc-600">
            Asigna etiquetas de Departamento o Servicio para generar carpetas inteligentes,
            o crea carpetas manuales para organizar documentos libremente.
          </p>
          <div className="mt-3 flex items-center gap-2">
            {onOpenConsejero && (
              <button
                onClick={onOpenConsejero}
                className="flex items-center gap-1 rounded-md bg-blue-600/10 px-3 py-1.5 text-[11px] font-medium text-blue-400 ring-1 ring-blue-500/20 transition-colors hover:bg-blue-600/20"
              >
                <Zap className="h-3 w-3" />
                Usar Consejero
              </button>
            )}
            <button
              onClick={() => setQuickCreateParentId(null)}
              className="flex items-center gap-1 rounded-md bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-zinc-400 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-700"
            >
              <FolderPlus className="h-3 w-3" />
              Carpeta manual
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 py-1">
          {isPending && (
            <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-blue-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Actualizando...
            </div>
          )}
          {tree.map((node) => (
            <CarpetaTreeNode
              key={node.id}
              node={node}
              depth={0}
              onDelete={handleDelete}
              onDrop={handleDrop}
              onDownload={handleDownloadZip}
              onCreateSub={handleCreateSub}
              selectedNodeId={selectedNodeId}
              onSelect={setSelectedNodeId}
              quickCreateParentId={quickCreateParentId}
              newFolderName={newFolderName}
              onNewFolderNameChange={setNewFolderName}
              onQuickCreateConfirm={handleQuickCreate}
              onQuickCreateCancel={() => { setQuickCreateParentId(false); setNewFolderName(""); }}
              downloading={downloading}
              dragPayload={dragPayload}
              setDragPayload={setDragPayload}
            />
          ))}
        </div>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Eliminar carpeta"
        confirmLabel="Eliminar"
        variant="danger"
      >
        <p className="text-sm text-zinc-400">
          Se eliminara la carpeta <strong className="text-zinc-200">{deleteTarget?.nombre}</strong> y
          todo su contenido (subcarpetas y archivos). Esta accion no se puede deshacer.
        </p>
      </ConfirmDialog>
    </div>
  );
}
