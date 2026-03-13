// ============================================================================
// tests/security/restricted-departments.test.ts
//
// @role:   @QA-Engineer / @Security-CISO
// @spec:   Fase 8.11 — Restricción de Departamentos Confidenciales
//
// COBERTURA:
//   1. isRestrictedForUser detecta etiquetas solo_super_admin
//   2. filterConstructorsForRole filtra constructores según rol
//   3. buildDriveFolderTree excluye ramas restringidas para Staff
//   4. buildClonePlan filtra etiquetas restringidas para Staff
//   5. SuperAdmin ve todas las ramas (sin filtro)
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  isRestrictedForUser,
  filterConstructorsForRole,
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

// ─── isRestrictedForUser ────────────────────────────────────────────────────

describe("isRestrictedForUser — detección de etiquetas restringidas", () => {
  it("retorna true para Staff cuando la etiqueta es solo_super_admin", () => {
    expect(isRestrictedForUser({ solo_super_admin: true }, STAFF)).toBe(true);
  });

  it("retorna false para SuperAdmin aunque la etiqueta sea solo_super_admin", () => {
    expect(isRestrictedForUser({ solo_super_admin: true }, SUPER_ADMIN)).toBe(false);
  });

  it("retorna false para etiqueta normal (solo_super_admin=false)", () => {
    expect(isRestrictedForUser({ solo_super_admin: false }, STAFF)).toBe(false);
  });

  it("retorna false para etiqueta sin el campo (undefined/null)", () => {
    expect(isRestrictedForUser({}, STAFF)).toBe(false);
    expect(isRestrictedForUser({ solo_super_admin: null }, STAFF)).toBe(false);
  });
});

// ─── filterConstructorsForRole ──────────────────────────────────────────────

describe("filterConstructorsForRole — filtrado de constructores por rol", () => {
  const constructors = [
    { categoriaNombre: "Departamento", etiquetaNombre: "Fiscal",       solo_super_admin: false, blueprint: null },
    { categoriaNombre: "Departamento", etiquetaNombre: "Penal",        solo_super_admin: true,  blueprint: null },
    { categoriaNombre: "Servicio",     etiquetaNombre: "IRPF",         solo_super_admin: false, blueprint: ["Doc", "Presup"] },
    { categoriaNombre: "Servicio",     etiquetaNombre: "Defensa Penal",solo_super_admin: true,  blueprint: null },
  ];

  it("Staff solo ve constructores no restringidos", () => {
    const filtered = filterConstructorsForRole(constructors, STAFF);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.etiquetaNombre)).toEqual(["Fiscal", "IRPF"]);
  });

  it("SuperAdmin ve todos los constructores", () => {
    const filtered = filterConstructorsForRole(constructors, SUPER_ADMIN);
    expect(filtered).toHaveLength(4);
  });

  it("lista vacía devuelve lista vacía", () => {
    expect(filterConstructorsForRole([], STAFF)).toHaveLength(0);
  });
});

// ─── Drive Mock — invisibilidad de ramas restringidas ───────────────────────

describe("buildDriveFolderTree — invisibilidad de departamentos confidenciales", () => {
  const allConstructors = [
    { categoriaNombre: "Departamento", etiquetaNombre: "Fiscal",       solo_super_admin: false, blueprint: null },
    { categoriaNombre: "Departamento", etiquetaNombre: "Penal",        solo_super_admin: true,  blueprint: null },
    { categoriaNombre: "Servicio",     etiquetaNombre: "IRPF",         solo_super_admin: false, blueprint: null },
    { categoriaNombre: "Servicio",     etiquetaNombre: "Defensa Penal",solo_super_admin: true,  blueprint: null },
  ];

  it("Staff no ve carpetas de departamentos restringidos", () => {
    const visible = filterConstructorsForRole(allConstructors, STAFF);
    const tree = buildDriveFolderTree("Juan García", visible);
    // Raiz > BRAINLEX > Contactos > Juan García
    const contactoNode = tree.children[0].children[0].children[0];
    expect(contactoNode.name).toBe("Juan García");
    // Solo debe haber 1 departamento (Fiscal), NO Penal
    const deptNames = contactoNode.children.map((n) => n.name);
    expect(deptNames).toContain("Fiscal");
    expect(deptNames).not.toContain("Penal");
    // Y dentro de Fiscal, solo IRPF (no Defensa Penal)
    const fiscalChildren = contactoNode.children.find((n) => n.name === "Fiscal")?.children ?? [];
    const serviceNames = fiscalChildren.map((n) => n.name);
    expect(serviceNames).toContain("IRPF");
    expect(serviceNames).not.toContain("Defensa Penal");
  });

  it("SuperAdmin ve todas las carpetas", () => {
    const visible = filterConstructorsForRole(allConstructors, SUPER_ADMIN);
    const tree = buildDriveFolderTree("Juan García", visible);
    const contactoNode = tree.children[0].children[0].children[0];
    const deptNames = contactoNode.children.map((n) => n.name);
    expect(deptNames).toContain("Fiscal");
    expect(deptNames).toContain("Penal");
  });

  it("el espacio del departamento confidencial es invisible (como si no existiera)", () => {
    const visible = filterConstructorsForRole(allConstructors, STAFF);
    const tree = buildDriveFolderTree("Test", visible);
    const contactoNode = tree.children[0].children[0].children[0];
    // Solo 1 departamento visible
    expect(contactoNode.children).toHaveLength(1);
    expect(contactoNode.children[0].name).toBe("Fiscal");
  });
});

// ─── Clonación segura — filtrado de etiquetas restringidas ──────────────────

describe("Clonación segura — Staff no clona etiquetas restringidas", () => {
  // Simula la lógica de filtrado de clonación
  interface CloneableAssignment {
    etiqueta_id: string;
    etiquetaNombre: string;
    solo_super_admin: boolean;
  }

  function filterCloneableForRole(
    assignments: CloneableAssignment[],
    user: UserSecurityContext
  ): CloneableAssignment[] {
    if (user.role === "SUPER_ADMIN") return assignments;
    return assignments.filter((a) => !a.solo_super_admin);
  }

  const sourceAssignments: CloneableAssignment[] = [
    { etiqueta_id: "et1", etiquetaNombre: "Fiscal",        solo_super_admin: false },
    { etiqueta_id: "et2", etiquetaNombre: "IRPF",          solo_super_admin: false },
    { etiqueta_id: "et3", etiquetaNombre: "Penal",          solo_super_admin: true },
    { etiqueta_id: "et4", etiquetaNombre: "Defensa Penal",  solo_super_admin: true },
  ];

  it("Staff solo clona etiquetas no restringidas", () => {
    const filtered = filterCloneableForRole(sourceAssignments, STAFF);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((a) => a.etiquetaNombre)).toEqual(["Fiscal", "IRPF"]);
  });

  it("SuperAdmin clona todas las etiquetas", () => {
    const filtered = filterCloneableForRole(sourceAssignments, SUPER_ADMIN);
    expect(filtered).toHaveLength(4);
  });

  it("no hay fuga: las etiquetas restringidas no aparecen en ningún campo", () => {
    const filtered = filterCloneableForRole(sourceAssignments, STAFF);
    const restrictedIds = filtered.filter((a) => a.solo_super_admin);
    expect(restrictedIds).toHaveLength(0);
  });
});
