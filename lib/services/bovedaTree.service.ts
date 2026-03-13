// ============================================================================
// lib/services/bovedaTree.service.ts — Árbol de Carpetas de la Bóveda
//
// @role: @Doc-Specialist
// @spec: Visor de Bóveda — transformación flat → tree para renderizado
//
// Convierte una lista plana de carpetas (con parent_id) en un árbol
// jerárquico listo para renderizar en el visor de la Bóveda.
// ============================================================================

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ArchivoMin {
  id:         string;
  nombre:     string;
  mime_type:  string | null;
  size_bytes: number | null;
}

export interface CarpetaFlat {
  id:           string;
  nombre:       string;
  tipo:         "INTELIGENTE" | "MANUAL";
  contacto_id:  string;
  parent_id:    string | null;
  etiqueta_id:  string | null;
  es_blueprint: boolean;
  orden:        number;
  archivos:     ArchivoMin[];
}

export interface CarpetaNode {
  id:           string;
  nombre:       string;
  tipo:         "INTELIGENTE" | "MANUAL";
  etiqueta_id:  string | null;
  es_blueprint: boolean;
  orden:        number;
  archivos:     ArchivoMin[];
  children:     CarpetaNode[];
}

// ─── Builder ────────────────────────────────────────────────────────────────

/**
 * Transforma una lista plana de carpetas en un árbol jerárquico.
 *
 * Algoritmo O(n): un pase para indexar, un pase para vincular, sort final.
 * Devuelve solo los nodos raíz (parent_id === null), con sus hijos anidados.
 */
export function buildCarpetaTree(flat: CarpetaFlat[]): CarpetaNode[] {
  if (flat.length === 0) return [];

  // 1. Crear nodos indexados por ID
  const nodeMap = new Map<string, CarpetaNode>();
  for (const c of flat) {
    nodeMap.set(c.id, {
      id:           c.id,
      nombre:       c.nombre,
      tipo:         c.tipo,
      etiqueta_id:  c.etiqueta_id,
      es_blueprint: c.es_blueprint,
      orden:        c.orden,
      archivos:     c.archivos,
      children:     [],
    });
  }

  // 2. Vincular padres → hijos
  const roots: CarpetaNode[] = [];
  for (const c of flat) {
    const node = nodeMap.get(c.id)!;
    if (c.parent_id && nodeMap.has(c.parent_id)) {
      nodeMap.get(c.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 3. Ordenar cada nivel por `orden` ASC
  function sortChildren(nodes: CarpetaNode[]): void {
    nodes.sort((a, b) => a.orden - b.orden);
    for (const node of nodes) {
      if (node.children.length > 0) sortChildren(node.children);
    }
  }
  sortChildren(roots);

  return roots;
}
