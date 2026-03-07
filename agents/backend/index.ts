// ============================================================================
// agents/backend/index.ts — Agente de Backend: Manifiesto
//
// @role:   Agente de Backend
// @author: Arquitecto Jefe (Project Manager)
//
// RESPONSABILIDAD:
//   Controla la capa de lógica de negocio en el servidor.
//   Garantiza que toda mutación de datos pasa por Server Actions validadas.
//   Nunca expone lógica de negocio al cliente.
//
// REGLAS DE VETO:
//   → Ninguna lógica de negocio puede ejecutarse en el cliente (client component).
//   → Toda Server Action DEBE validar con Zod antes de persistir.
//   → Toda Server Action DEBE escribir AuditLog antes de mutar (CISO).
//   → Las transacciones multi-tabla DEBEN usar prisma.$transaction().
//
// PATRONES OBLIGATORIOS:
//   · Repository Pattern: toda consulta a BD va a través de un repository.
//   · Result Pattern: { ok: true; data } | { ok: false; error } (sin throws al cliente).
//   · Soft Delete: nunca DELETE físico sin pasar por Guardian.validateDelete().
//
// DEPENDENCIAS:
//   · agents/legal/Guardian.ts  — veto de borrado
//   · agents/data/TaxonomyManager.ts — blindaje de esquema
//   · lib/actions/*.actions.ts  — Server Actions (controladores delgados)
//   · lib/repositories/*.ts     — acceso a datos
//   · lib/validations/*.schema.ts — contratos Zod
// ============================================================================

export { } from "@/agents/legal/Guardian";
export { } from "@/agents/data/TaxonomyManager";
