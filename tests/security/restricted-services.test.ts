// ============================================================================
// tests/security/restricted-services.test.ts
//
// @role:   @QA-Engineer / @Security-CISO
// @spec:   Fase 8.12 — Seguridad Granular en Servicios
//
// COBERTURA:
//   1. Herencia: servicio hijo de departamento restringido es invisible
//   2. Exclusión directa: servicio restringido dentro de departamento público
//   3. Drive Mock: filtra servicios restringidos dentro de departamentos públicos
//   4. filterWithInheritance aplica ambas reglas combinadas
//   5. SuperAdmin ve todo (sin herencia ni exclusión)
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  filterConstructorsWithInheritance,
  type UserSecurityContext,
} from "@/lib/services/securityFilter.service";
import { buildDriveFolderTree } from "@/lib/services/driveMock.service";

// ─── Contextos de usuario simulados ─────────────────────────────────────────

const SUPER_ADMIN: UserSecurityContext = {
  userId: "admin1",
  role: "SUPER_ADMIN",
};

const STAFF: UserSecurityContext = {
  userId: "staff1",
  role: "STAFF",
};

const ADMIN: UserSecurityContext = {
  userId: "admin2",
  role: "ADMIN",
};

// ─── Datos de prueba: Laboral público, Nóminas Socios restringido ──────────

const SCENARIO = [
  { categoriaNombre: "Departamento", etiquetaNombre: "Laboral",         etiquetaId: "dept-lab",  parentId: null,       solo_super_admin: false, blueprint: null },
  { categoriaNombre: "Departamento", etiquetaNombre: "Penal",           etiquetaId: "dept-pen",  parentId: null,       solo_super_admin: true,  blueprint: null },
  { categoriaNombre: "Servicio",     etiquetaNombre: "Contratos",       etiquetaId: "svc-cont",  parentId: "dept-lab", solo_super_admin: false, blueprint: null },
  { categoriaNombre: "Servicio",     etiquetaNombre: "Nóminas Socios",  etiquetaId: "svc-nom",   parentId: "dept-lab", solo_super_admin: true,  blueprint: ["Recibos", "Modelos"] },
  { categoriaNombre: "Servicio",     etiquetaNombre: "Defensa Penal",   etiquetaId: "svc-def",   parentId: "dept-pen", solo_super_admin: false, blueprint: null },
];

// ─── Herencia: departamento restringido oculta sus hijos ────────────────────

describe("Herencia — Departamento restringido oculta servicios hijos", () => {
  it("Staff no ve servicios hijos de departamento restringido (Penal)", () => {
    const filtered = filterConstructorsWithInheritance(SCENARIO, STAFF);
    const names = filtered.map((c) => c.etiquetaNombre);
    expect(names).not.toContain("Defensa Penal");
    expect(names).not.toContain("Penal");
  });

  it("Staff no ve departamento Penal ni Defensa Penal aunque Defensa no es solo_super_admin", () => {
    // Defensa Penal tiene solo_super_admin=false, pero su padre Penal es true
    const filtered = filterConstructorsWithInheritance(SCENARIO, STAFF);
    expect(filtered.find((c) => c.etiquetaNombre === "Defensa Penal")).toBeUndefined();
  });

  it("SuperAdmin ve todo sin herencia ni exclusión", () => {
    const filtered = filterConstructorsWithInheritance(SCENARIO, SUPER_ADMIN);
    expect(filtered).toHaveLength(5);
  });

  it("ADMIN tampoco ve servicios restringidos (misma regla que Staff)", () => {
    const filtered = filterConstructorsWithInheritance(SCENARIO, ADMIN);
    const names = filtered.map((c) => c.etiquetaNombre);
    expect(names).not.toContain("Penal");
    expect(names).not.toContain("Defensa Penal");
    expect(names).not.toContain("Nóminas Socios");
  });
});

// ─── Exclusión directa: servicio restringido en departamento público ────────

describe("Exclusión directa — Servicio restringido en departamento público", () => {
  it("Staff ve Laboral y Contratos, pero NO Nóminas Socios", () => {
    const filtered = filterConstructorsWithInheritance(SCENARIO, STAFF);
    const names = filtered.map((c) => c.etiquetaNombre);
    expect(names).toContain("Laboral");
    expect(names).toContain("Contratos");
    expect(names).not.toContain("Nóminas Socios");
  });

  it("solo 2 etiquetas visibles para Staff (Laboral + Contratos)", () => {
    const filtered = filterConstructorsWithInheritance(SCENARIO, STAFF);
    expect(filtered).toHaveLength(2);
  });
});

// ─── Drive Mock — servicios restringidos invisibles en árbol ────────────────

describe("Drive Mock — servicio confidencial invisible en árbol de carpetas", () => {
  it("Staff: Laboral tiene solo Contratos (sin Nóminas Socios)", () => {
    const filtered = filterConstructorsWithInheritance(SCENARIO, STAFF);
    const tree = buildDriveFolderTree("Cliente Test", filtered);
    const contactoNode = tree.children[0].children[0].children[0];
    expect(contactoNode.name).toBe("Cliente Test");

    // Solo Laboral visible (Penal invisible)
    expect(contactoNode.children).toHaveLength(1);
    const laboral = contactoNode.children[0];
    expect(laboral.name).toBe("Laboral");

    // Dentro de Laboral: solo Contratos
    const serviceNames = laboral.children.map((n) => n.name);
    expect(serviceNames).toContain("Contratos");
    expect(serviceNames).not.toContain("Nóminas Socios");
    expect(serviceNames).toHaveLength(1);
  });

  it("SuperAdmin: ve Laboral (con Contratos + Nóminas) y Penal (con Defensa)", () => {
    const filtered = filterConstructorsWithInheritance(SCENARIO, SUPER_ADMIN);
    const tree = buildDriveFolderTree("CEO Test", filtered);
    const contactoNode = tree.children[0].children[0].children[0];

    // 2 departamentos
    const deptNames = contactoNode.children.map((n) => n.name);
    expect(deptNames).toContain("Laboral");
    expect(deptNames).toContain("Penal");

    // Laboral tiene 2 servicios
    const laboral = contactoNode.children.find((n) => n.name === "Laboral")!;
    const laboralServices = laboral.children.map((n) => n.name);
    expect(laboralServices).toContain("Contratos");
    expect(laboralServices).toContain("Nóminas Socios");
  });

  it("Nóminas Socios mantiene su blueprint cuando es visible para SuperAdmin", () => {
    const filtered = filterConstructorsWithInheritance(SCENARIO, SUPER_ADMIN);
    const tree = buildDriveFolderTree("CEO Test", filtered);
    const contactoNode = tree.children[0].children[0].children[0];
    const laboral = contactoNode.children.find((n) => n.name === "Laboral")!;
    const nominas = laboral.children.find((n) => n.name === "Nóminas Socios")!;
    // Blueprint: ["Recibos", "Modelos"] → sorted alphabetically
    const subcarpetas = nominas.children.map((n) => n.name);
    expect(subcarpetas).toContain("Modelos");
    expect(subcarpetas).toContain("Recibos");
  });
});

// ─── Caso borde: todos restringidos ─────────────────────────────────────────

describe("Caso borde — todos los constructores restringidos", () => {
  const allRestricted = [
    { categoriaNombre: "Departamento", etiquetaNombre: "Secreto", etiquetaId: "d1", parentId: null, solo_super_admin: true, blueprint: null },
    { categoriaNombre: "Servicio",     etiquetaNombre: "TopSec",  etiquetaId: "s1", parentId: "d1",  solo_super_admin: true, blueprint: null },
  ];

  it("Staff no ve nada", () => {
    const filtered = filterConstructorsWithInheritance(allRestricted, STAFF);
    expect(filtered).toHaveLength(0);
  });

  it("Drive tree vacío para Staff", () => {
    const filtered = filterConstructorsWithInheritance(allRestricted, STAFF);
    const tree = buildDriveFolderTree("Invisible", filtered);
    // Google Drive > BRAINLEX > Contactos > (vacío)
    const contactos = tree.children[0].children[0];
    expect(contactos.children).toHaveLength(0);
  });
});
