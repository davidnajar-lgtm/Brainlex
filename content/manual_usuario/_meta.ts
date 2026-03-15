// ============================================================================
// content/manual_usuario/_meta.ts
//
// @role: @Knowledge-Librarian
// @spec: Fase 10.09 — Metadatos del manual de usuario
//
// Cada entrada define un artículo del Centro de Ayuda.
// El slug coincide con el nombre del archivo .md (sin extensión).
// ============================================================================

export interface ArticleMeta {
  slug: string;
  title: string;
  description: string;
  category: string;
  order: number;
}

export const CATEGORIES = [
  "Inicio",
  "Contactos",
  "Documentos",
  "Administración",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const ARTICLES: ArticleMeta[] = [
  // ── Inicio ──────────────────────────────────────────────────────────────
  {
    slug: "primeros-pasos",
    title: "Primeros pasos en BrainLex",
    description:
      "Qué es BrainLex, cómo acceder y cómo cambiar entre sociedades.",
    category: "Inicio",
    order: 1,
  },
  {
    slug: "multiempresa",
    title: "Trabajar con varias empresas",
    description:
      "Cómo funciona el selector de sociedad, qué datos son compartidos y cuáles son exclusivos.",
    category: "Inicio",
    order: 2,
  },

  // ── Contactos ───────────────────────────────────────────────────────────
  {
    slug: "crear-contacto",
    title: "Crear un nuevo contacto",
    description:
      "El Alta Rápida, persona física vs jurídica, y cómo se detectan duplicados.",
    category: "Contactos",
    order: 10,
  },
  {
    slug: "ficha-del-contacto",
    title: "La Ficha del Contacto",
    description:
      "Las pestañas de Filiación, Operativa, Ecosistema y Bóveda explicadas paso a paso.",
    category: "Contactos",
    order: 11,
  },
  {
    slug: "roles-y-clasificacion",
    title: "Roles y clasificación",
    description:
      "Pre-cliente, Cliente y Matriz: qué significan y cómo cambiar el rol de un contacto.",
    category: "Contactos",
    order: 12,
  },
  {
    slug: "ecosistema-relaciones",
    title: "Ecosistema de relaciones",
    description:
      "Relaciones entre contactos, evidencias probatorias, porcentajes societarios y vista de grafo.",
    category: "Contactos",
    order: 13,
  },

  // ── Documentos ──────────────────────────────────────────────────────────
  {
    slug: "boveda-documental",
    title: "La Bóveda Documental",
    description:
      "Cómo funciona el visor de carpetas Blueprint y los documentos manuales.",
    category: "Documentos",
    order: 20,
  },

  // ── Administración ──────────────────────────────────────────────────────
  {
    slug: "cuarentena-y-borrado",
    title: "Cuarentena y borrado",
    description:
      "Qué ocurre cuando archivas o eliminas un contacto y cómo restaurarlo.",
    category: "Administración",
    order: 30,
  },
  {
    slug: "taxonomia-sali",
    title: "Taxonomía SALI",
    description:
      "Categorías, etiquetas y cómo organizar la información del despacho.",
    category: "Administración",
    order: 31,
  },
];
