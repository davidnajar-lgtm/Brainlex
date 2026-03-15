// ============================================================================
// tests/export/csv-export.test.ts — Tests de exportación CSV
//
// Verifica la lógica de generación CSV del ExportDropdown.
// Extraemos la lógica de building CSV a una función pura para testear.
// ============================================================================

import { describe, it, expect } from "vitest";

// ─── Lógica extraída (misma que ExportDropdown.handleDownloadCsv) ────────────

interface CsvContact {
  tipo: string;
  razon_social: string | null;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  fiscal_id: string | null;
  fiscal_id_tipo: string | null;
  email_principal: string | null;
  telefono_movil: string | null;
  telefono_fijo: string | null;
  website_url: string | null;
  status: string;
}

function buildCsvContent(contactos: CsvContact[]): string {
  const headers = [
    "Nombre", "Tipo", "NIF/CIF", "Tipo ID Fiscal",
    "Email", "Teléfono Móvil", "Teléfono Fijo", "Web", "Estado",
  ];
  const rows = contactos.map((c) => {
    const nombre = c.tipo === "PERSONA_JURIDICA"
      ? (c.razon_social ?? "")
      : [c.nombre, c.apellido1, c.apellido2].filter(Boolean).join(" ");
    return [
      nombre,
      c.tipo === "PERSONA_JURIDICA" ? "Persona Jurídica" : "Persona Física",
      c.fiscal_id ?? "",
      c.fiscal_id_tipo ?? "",
      c.email_principal ?? "",
      c.telefono_movil ?? "",
      c.telefono_fijo ?? "",
      c.website_url ?? "",
      c.status,
    ];
  });
  const escapeCsv = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  return [headers, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PF: CsvContact = {
  tipo: "PERSONA_FISICA",
  razon_social: null,
  nombre: "Juan",
  apellido1: "García",
  apellido2: "López",
  fiscal_id: "12345678A",
  fiscal_id_tipo: "NIF",
  email_principal: "juan@test.com",
  telefono_movil: "+34612345678",
  telefono_fijo: null,
  website_url: null,
  status: "ACTIVE",
};

const PJ: CsvContact = {
  tipo: "PERSONA_JURIDICA",
  razon_social: "Acme, S.L.",
  nombre: null,
  apellido1: null,
  apellido2: null,
  fiscal_id: "B12345678",
  fiscal_id_tipo: "CIF",
  email_principal: "info@acme.com",
  telefono_movil: null,
  telefono_fijo: "+34911234567",
  website_url: "https://acme.com",
  status: "ACTIVE",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("buildCsvContent — Generación CSV para exportación", () => {
  it("genera cabeceras correctas", () => {
    const csv = buildCsvContent([]);
    expect(csv).toBe(
      "Nombre,Tipo,NIF/CIF,Tipo ID Fiscal,Email,Teléfono Móvil,Teléfono Fijo,Web,Estado"
    );
  });

  it("exporta persona física con nombre completo", () => {
    const csv = buildCsvContent([PF]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Juan García López");
    expect(lines[1]).toContain("Persona Física");
    expect(lines[1]).toContain("12345678A");
  });

  it("exporta persona jurídica con razón social", () => {
    const csv = buildCsvContent([PJ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    // Razón social tiene coma → debe ir entrecomillada
    expect(lines[1]).toContain('"Acme, S.L."');
    expect(lines[1]).toContain("Persona Jurídica");
    expect(lines[1]).toContain("B12345678");
  });

  it("escapa comillas dobles en valores CSV", () => {
    const c: CsvContact = {
      ...PJ,
      razon_social: 'Empresa "La Buena"',
    };
    const csv = buildCsvContent([c]);
    expect(csv).toContain('"Empresa ""La Buena"""');
  });

  it("maneja campos nulos como cadenas vacías", () => {
    const c: CsvContact = {
      ...PF,
      fiscal_id: null,
      email_principal: null,
      telefono_movil: null,
    };
    const csv = buildCsvContent([c]);
    const lines = csv.split("\n");
    const cols = lines[1].split(",");
    // NIF/CIF vacío, Email vacío, Teléfono Móvil vacío
    expect(cols[2]).toBe("");
    expect(cols[4]).toBe("");
    expect(cols[5]).toBe("");
  });

  it("exporta múltiples contactos en orden", () => {
    const csv = buildCsvContent([PF, PJ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // cabecera + 2 filas
    expect(lines[1]).toContain("Juan García López");
    expect(lines[2]).toContain("Acme");
  });

  it("persona física sin apellido2 concatena solo nombre + apellido1", () => {
    const c: CsvContact = { ...PF, apellido2: null };
    const csv = buildCsvContent([c]);
    expect(csv).toContain("Juan García,");
  });
});
