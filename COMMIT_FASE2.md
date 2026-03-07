# COMMIT — Cierre Técnico Fase 2
**Fecha:** 2026-03-08
**Branch:** main
**Tag sugerido:** `v0.2.0-fase2-cierre`

---

## Resumen ejecutivo

Cierre técnico de la Fase 2 del Directorio de Contactos. El sistema es ahora
**agnóstico de cliente** (marca blanca), **correcto en filosofía de datos** y **seguro en RGPD**.

---

## Cambios por categoría

### TAREA 1 — Roles: Filosofía de datos y no-autofacturación

#### Filosofía de datos (decisión CEO — inamovible)

Todos los registros son, ante todo, **Contactos**. Los flags comerciales son
**atributos adicionales**, no tipos excluyentes:

| Combinación                          | Estado    | Motivo                                                   |
|--------------------------------------|-----------|----------------------------------------------------------|
| `es_cliente=true` + `es_precliente=true` | **Permitido** | Un contacto puede ser cliente de un servicio y pre-cliente de otro |
| `es_facturadora=true` + cualquier otro | **Bloqueado** | Veto contable: una Matriz no puede ser cliente de sí misma |

#### Implementación

- **`toggleEsCliente`** / **`toggleEsPrecliente`** — toggles independientes.
  Ninguno afecta al otro. Cada uno solo alterna su propio flag.
- **`toggleEsFacturadora`** (único veto de exclusividad):
  - Activar Matriz limpia `es_cliente` y `es_precliente` en una sola operación DB (anti-autofacturación)
  - Desactivar bloqueado si el CIF está en `BRAINLEX_MATRIZ_CIFS` (veto env-var)
- **`lib/config/matrizConfig.ts`** (nuevo) — parsea `BRAINLEX_MATRIZ_CIFS` → `isMatrizCif()`
- **`RolesPanel`** — checkboxes independientes para Matriz/Cliente/Pre-cliente.
  Badge **"Contacto Base"** visible cuando los tres flags son `false`.
  Cliente y Pre-cliente quedan `disabled` solo cuando `esFacturadora=true`.
- **Ubiquidad garantizada**: `findAll` filtra solo por `status: ACTIVE`, nunca por flags
  comerciales. Cualquier contacto es localizable desde buscadores de relaciones y expedientes
  independientemente de sus atributos de rol.

### TAREA 2 — Seguridad: AuditLog FORGET + Cascade

- **SHA-256 PII hash** en el log de FORGET (`legalAgent.interceptDelete`):
  ```
  pii_hash = SHA256(fiscal_id | nombre | apellido1 | email)
  ```
  El AuditLog prueba la eliminación sin almacenar datos personales en claro (RGPD Art. 17).
- **Cascade delete verificado**: `Direccion` y `CanalComunicacion` tienen
  `onDelete: Cascade` en el schema de Prisma. El borrado físico de un Contacto
  elimina automáticamente todos sus satélites.
- `ContactoCompanyLink` no tiene cascade intencionadamente — se elimina manualmente
  en `interceptDelete` antes del `contacto.delete` para respetar la FK.

### TAREA 3 — Diseño: Sistema de tokens semánticos + Dark/Light mode

- **`app/globals.css`** — sistema completo de CSS custom properties:
  - Tokens semánticos: `--surface-*`, `--border-*`, `--content-*`, `--accent-*`
  - Tema oscuro: DEFAULT (`:root`) — zinc-950/900/800, sin breaking changes
  - Tema claro: `html.light` — inversión completa de la escala zinc de Tailwind v4
    (`--color-zinc-950` → blanco, `--color-zinc-50` → negro) para que **todos los
    componentes con clases hardcoded respondan al tema sin modificaciones**
  - Registrado en `@theme inline` → clases Tailwind: `bg-surface-card`, etc.
- **`components/ui/ThemeToggle.tsx`** (nuevo) — toggle Sun/Moon con persistencia en
  `localStorage["theme"]`
- **`app/layout.tsx`** — script anti-FOUC, `suppressHydrationWarning`, containers
  migrados a `bg-surface-page`
- **`components/layout/Topbar.tsx`** — `ThemeToggle` integrado en la barra superior

### DOCS

- `ARCHITECTURE_ENTIDADES.md` — v2.1: filosofía de datos actualizada, reglas de negocio
  completas, ubiquidad, cascade, SHA-256, sistema de tokens, tabla de archivos clave
- `COMMIT_FASE2.md` (este archivo)

---

## Deuda técnica documentada (Fase 3)

| Elemento                              | Prioridad | Fase |
|---------------------------------------|-----------|------|
| Integrar Holded API para `checkFacturasHolded()` | Alta | 3 |
| Integrar Drive API para `checkDocumentosDrive()` | Alta | 3 |
| Paginación real en `findAll` (actualmente `take: 50`) | Media | 3 |
| Auth real + RLS Supabase activo | Alta | 3 |

---

## Mensaje de commit sugerido

```
feat(fase2-cierre): filosofía datos correcta, FORGET SHA-256, tokens dark/light

- es_cliente + es_precliente: atributos acumulables (no excluyentes)
- Solo es_facturadora mantiene veto de exclusividad (anti-autofacturación)
- Badge "Contacto Base" cuando ningún rol activo
- BRAINLEX_MATRIZ_CIFS env var: detección belt-and-suspenders de Matrices
- toggleEsFacturadora: limpia cliente/precliente atómicamente al activar
- FORGET AuditLog: pii_hash SHA-256 para RGPD Art.17 compliance
- Cascade delete: Direccion + CanalComunicacion
- Tokens semánticos CSS + inversión escala zinc para dark/light mode global
- ThemeToggle (Sun/Moon) con anti-FOUC script
- ARCHITECTURE_ENTIDADES.md v2.1
```
