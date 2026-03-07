# ARCHITECTURE_ENTIDADES.md
## Arquitectura del Módulo de Entidades (Contactos)

> Versión: 2.0 — 2026-03-08 (Cierre Técnico Fase 2)
> Mantenido por: @Data-Architect, @Security-CISO

---

## 1. Modelo de Datos

El módulo de Contactos usa una única tabla `contactos` con discriminación por tipo:

| Campo          | Tipo                | Uso                                                    |
|----------------|---------------------|--------------------------------------------------------|
| `tipo`         | `FISICA / JURIDICA` | Persona Física o Jurídica                              |
| `fiscal_id`    | `String?`           | NIF / CIF / NIE / etc. — UNIQUE (nullable)             |
| `fiscal_id_tipo` | `FiscalIdTipo`    | Enum: NIF, CIF, NIE, DNI, PASAPORTE, VAT, TIE, …     |
| `nombre`       | `String?`           | Nombre (personas físicas)                              |
| `razon_social` | `String?`           | Razón social (personas jurídicas)                      |
| `es_facturadora` | `Boolean`         | Entidad de facturación — veto de borrado permanente   |
| `es_entidad_activa` | `Boolean`      | Entidad holding activa — veto de borrado permanente   |
| `es_cliente`   | `Boolean`           | Atributo comercial: Cliente activo (acumulable con es_precliente) |
| `es_precliente` | `Boolean`          | Atributo comercial: Pre-cliente (acumulable con es_cliente)        |
| `status`       | `ContactoStatus`    | ACTIVE / QUARANTINE — soft-delete mediante cuarentena  |

**Multitenant**: la tabla `contacto_company_links` vincula un contacto con una o más
organizaciones (LX / LW). Un mismo contacto puede existir en ambos tenants.

---

## 2. Ciclo de Vida de un Contacto

```
                     ┌──────────────────────────────────────┐
                     │            ACTIVE                    │
                     │  (status = "ACTIVE")                 │
                     └──────┬───────────────┬───────────────┘
                            │ archivar()    │ borrar()
                            ▼               ▼
              ┌─────────────────┐   ┌──────────────────────┐
              │   QUARANTINE    │   │  AGENTE LEGAL        │
              │ (soft-delete)   │   │  checkDependencias() │
              │ + AuditLog      │   └──────────┬───────────┘
              └──────┬──────────┘              │
                     │ resurrect()    ┌────────┴────────┐
                     │                │ blocked=true    │ blocked=false
                     ▼                ▼                 ▼
              ┌──────────────┐  ┌──────────┐    ┌────────────┐
              │    ACTIVE    │  │QUARANTINE│    │   PURGED   │
              │  (restored)  │  │(forzada) │    │  (físico)  │
              └──────────────┘  └──────────┘    └────────────┘
```

### Estados

| Estado       | Descripción                                                              |
|--------------|--------------------------------------------------------------------------|
| `ACTIVE`     | Contacto visible y operativo en el directorio                            |
| `QUARANTINE` | Archivado con fecha de expiración. Recuperable. Invisible en directorio  |

**No existe estado "DELETED"**: el borrado físico es irreversible y sólo lo ejecuta el
Agente Legal cuando `blocked = false` (cero dependencias legales).

---

## 3. Entidades Matrices (Facturadoras / Holdings)

### Definición

Una **Entidad Matriz** es una sociedad que actúa como núcleo de facturación o holding.
Está protegida por veto de borrado permanente: ni cuarentena ni purga son posibles
mientras el flag `es_facturadora = true` esté activo.

### Identificación — dos mecanismos en capas (belt-and-suspenders)

#### Capa 1: Flag en base de datos

```
contacto.es_facturadora = true
```

Activado manualmente por un Admin desde la ficha del contacto.
El Agente Legal lee este flag en `checkLegalDependencies()` → bloquea el borrado.

#### Capa 2: Variable de entorno (agnóstica / distribuible)

```env
# .env.local (SERVER-ONLY — sin prefijo NEXT_PUBLIC_)
BRAINLEX_MATRIZ_CIFS=B12345678,A98765432
```

- Lista separada por comas de CIFs/NIFs que SIEMPRE deben ser matrices.
- Procesada en `lib/config/matrizConfig.ts` → `isMatrizCif(fiscal_id)`.
- **Auto-set**: en `createContacto` y `updateContacto`, si el `fiscal_id` coincide,
  se escribe `es_facturadora = true` automáticamente en la BD.
- **Failsafe**: en `legalAgent.checkLegalDependencies()`, aunque el flag DB no esté
  activo, si el CIF aparece en la env var → veto igualmente aplicado.

### Cómo configurar una nueva Entidad Matriz

**Opción A — Inmediata (recomendada para producción)**
1. Añadir el CIF a `BRAINLEX_MATRIZ_CIFS` en `.env.local` (o en las variables del
   servidor de producción).
2. Reiniciar el servidor Next.js.
3. La siguiente edición/creación de ese contacto activará el flag en BD automáticamente.

**Opción B — UI Admin**
1. Navegar a la ficha del contacto → sección Roles.
2. Activar el toggle `Es facturadora`.
3. El flag se persiste inmediatamente en BD.

**Ambas opciones son complementarias** y se aplican con la lógica `OR`.

---

## 4. Reglas de Negocio Críticas

| Regla                              | Implementación                                                              |
|------------------------------------|-----------------------------------------------------------------------------|
| Atributos comerciales acumulables  | `es_cliente` y `es_precliente` son **independientes** — pueden coexistir (ej: cliente de contabilidad y pre-cliente de herencia) |
| Exclusividad Matriz → limpia roles | `toggleEsFacturadora` — activar Matriz borra `es_cliente` y `es_precliente` atómicamente (veto contable) |
| Anti-autofacturación               | UI: Cliente y Pre-cliente quedan `disabled` cuando `esFacturadora=true`     |
| Veto de desactivación de Matriz    | Si CIF en `BRAINLEX_MATRIZ_CIFS` → `toggleEsFacturadora` devuelve error     |
| Soft-delete obligatorio            | Nunca `prisma.contacto.delete` directo. Siempre vía `legalAgent.interceptDelete()` |
| AuditLog antes de mutar            | `writeAuditLog()` ANTES de cualquier `UPDATE` o `DELETE`                    |
| FORGET 100% anónimo               | Log PURGE incluye `pii_hash` SHA-256 (fiscal_id\|nombre\|email). Sin PII en claro |
| Cascade delete de satélites        | `Direccion` y `CanalComunicacion` tienen `onDelete: Cascade` en schema      |
| `es_facturadora` no auto-desactivado | El env var sólo activa, nunca desactiva el flag                           |

## 4b. Ubiquidad — Roles no excluyen de búsquedas

Un rol comercial (`es_cliente`, `es_precliente`, `es_facturadora`) **nunca oculta** a un
Contacto de los buscadores de Relaciones ni de Expedientes. El único criterio de visibilidad
en `findAll` es `status: "ACTIVE"`. Los roles solo afectan al filtrado en el Directorio
(`tab="clientes"` etc.) y a la lógica de borrado (veto en Matrices).

---

## 5. Archivos Clave

| Archivo                                        | Responsabilidad                                                        |
|------------------------------------------------|------------------------------------------------------------------------|
| `lib/config/matrizConfig.ts`                   | Parsea `BRAINLEX_MATRIZ_CIFS` → `isMatrizCif()`                        |
| `lib/services/legalAgent.middleware.ts`        | Interceptor de borrado — veto + cuarentena + FORGET + SHA-256          |
| `lib/actions/contactos.actions.ts`             | toggleEsCliente, toggleEsPrecliente, toggleEsFacturadora (atómicos)    |
| `lib/repositories/contacto.repository.ts`      | Capa de acceso a datos (Prisma)                         |
| `app/contactos/[id]/_components/RolesPanel.tsx` | UI: toggles independientes (checkboxes); badge "Contacto Base" cuando ningún rol activo |
| `prisma/schema.prisma`                         | Modelo `Contacto` con todos los flags                   |

---

## 6. Extensibilidad

Para añadir un nuevo tipo de protección de entidad:

1. Añadir un campo boolean a `prisma/schema.prisma` (ej: `es_auditora`).
2. Generar migración: `npx prisma migrate dev`.
3. Añadir la comprobación en `legalAgent.checkLegalDependencies()`.
4. Opcionalmente, añadir una env var en `matrizConfig.ts` para protección agnóstica.
5. Añadir el toggle en la UI de la ficha del contacto.

El sistema está diseñado para ser **completamente agnóstico al cliente**: ningún nombre
de empresa, CIF, ni ID está hardcodeado en el código fuente.
