// ============================================================================
// agents/frontend/index.ts — Agente de Frontend: Manifiesto
//
// @role:   @Frontend-UX / Agente de Frontend
// @author: Arquitecto Jefe (Project Manager)
//
// RESPONSABILIDAD:
//   Garantizar que la interfaz de usuario sea simple, accesible y rápida.
//   Usa Shadcn/UI como sistema de diseño. Tailwind CSS para estilos.
//   Trabaja bajo supervisión del Agente de Rendimiento (Optimizer).
//
// REGLAS DE VETO (propias):
//   → No duplicar lógica de negocio en el cliente; usar Server Actions.
//   → No llamar a APIs externas directamente desde Client Components.
//   → Los formularios deben conectar con los esquemas Zod del servidor.
//
// REGLAS DE VETO EXTERNAS (recibidas de Optimizer):
//   → Ninguna página puede tener más de 200ms de TTI (Time to Interactive).
//   → No añadir animaciones o gráficos que degraden el scroll (fps < 60).
//   → Google Maps SOLO se carga en los componentes que lo necesitan
//     estrictamente — nunca en el layout global ni en el bundle principal.
//   → Listas de Contactos DEBEN usar paginación + cursor-based fetch.
//     Prohibido cargar listas completas de registros en una sola llamada.
//
// PATRONES OBLIGATORIOS:
//   · SWR (stale-while-revalidate): caché en cliente para entidades visitadas.
//     Un contacto ya visitado debe renderizarse instantáneamente desde caché.
//   · Shadcn/UI: usar componentes del sistema, no inventar UI desde cero.
//   · Dark theme first: el diseño primario es dark (#0d0d0d background).
//   · Error Boundaries: cada sección crítica necesita su propio boundary.
//
// CERTIFICADO DE MÓDULO:
//   Antes de pasar a producción, el Agente de Rendimiento debe emitir
//   Optimizer.issueCertificate(module) con veredicto "APPROVED".
// ============================================================================

export { } ;
