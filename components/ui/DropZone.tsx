"use client";

// ============================================================================
// components/ui/DropZone.tsx — Zona Receptora de Etiquetas (Drag & Drop)
//
// Acepta etiquetas arrastradas desde el TagPalette / TagSelector.
// Se ilumina al detectar un drag-over válido.
//
// Datos transferidos via dataTransfer:
//   text/plain → JSON: { id, nombre, color, categoriaNombre, categoriaTipo }
// ============================================================================

import { useState, type DragEvent, type ReactNode } from "react";
import { Target } from "lucide-react";

export interface DropPayload {
  id:              string;
  nombre:         string;
  color:          string;
  categoriaNombre: string;
  categoriaTipo:   "CONSTRUCTOR" | "ATRIBUTO";
}

interface DropZoneProps {
  onDrop:       (payload: DropPayload) => void;
  accentColor:  string;
  disabled?:    boolean;
  children?:    ReactNode;
}

export function DropZone({ onDrop, accentColor, disabled = false, children }: DropZoneProps) {
  const [isOver, setIsOver] = useState(false);

  function handleDragOver(e: DragEvent) {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    // Only if leaving the actual drop zone (not entering a child)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOver(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsOver(false);
    if (disabled) return;

    try {
      const raw = e.dataTransfer.getData("text/plain");
      const payload = JSON.parse(raw) as DropPayload;
      if (payload.id && payload.nombre) {
        onDrop(payload);
      }
    } catch {
      // Invalid drag data — ignore silently
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-lg border-2 border-dashed p-4 transition-all duration-200 ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-default"
      }`}
      style={{
        borderColor: isOver ? accentColor : `${accentColor}40`,
        backgroundColor: isOver ? `${accentColor}12` : "transparent",
        boxShadow: isOver ? `0 0 20px ${accentColor}15` : "none",
      }}
    >
      {children ?? (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <Target
            className="h-5 w-5 transition-colors duration-200"
            style={{ color: isOver ? accentColor : `${accentColor}60` }}
          />
          <p
            className="text-xs font-medium transition-colors duration-200"
            style={{ color: isOver ? accentColor : `${accentColor}80` }}
          >
            Arrastra aquí para clasificar
          </p>
          <p className="text-[10px] text-zinc-600">
            Vincular a Drive
          </p>
        </div>
      )}

      {/* Glow overlay when active */}
      {isOver && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none animate-pulse"
          style={{ backgroundColor: `${accentColor}06` }}
        />
      )}
    </div>
  );
}
