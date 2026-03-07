# CONTEXT.md — Agente de Datos (Architect / TaxonomyManager)

> Extraído de `docs/SSD_MASTER.md` secciones 4, 8 y `docs/Source/micro specs.txt`.
> Define qué protege y qué garantiza el Agente de Datos en cada sesión.

---

## Specs de Referencia
- **Micro-Spec 1.1** — Esquema Core y Multi-tenancy Híbrida
- **Micro-Spec 2.1** — Validaciones de Identidad y Fiscalidad
- **Micro-Spec 2.2** — Pestaña Estructura y Visor Gráfico
- **Micro-Spec 3.1** — Drive como Backend + Taxonomía SALI

---

## Modelo Multi-Tenancy Híbrida (INAMOVIBLE)

```
Tabla GLOBAL (sin company_id):
  Contacto — un mismo sujeto puede pertenecer a LX y LW sin duplicarse

Tabla PUENTE (con company_id):
  ContactoCompanyLink — company_id: "LX" | "LW" | futuros

Tabla HOLDING:
  SociedadHolding — añadir empresa = 1 INSERT. Sin cambios de esquema.

Tabla de transacciones (con company_id):
  Expediente, Facturas, Suplidos — siempre separados por tenant
```

**Regla de oro:** NUNCA poner company_id en la tabla Contacto.
La separación lógica de tenants va en las tablas de transacciones.

---

## Campos Fijos de Comunicación en Contacto (Whitelist — NO ampliar)

| Campo | Tipo | Restricción |
|-------|------|-------------|
| `email_principal` | String | `@unique` en BD |
| `telefono_movil` | String | Formato E.164 |
| `telefono_fijo` | String | Formato E.164 |
| `website_url` | String | URL normalizada https:// |
| `linkedin_url` | String | URL válida |
| `canal_preferido` | Enum | `"EMAIL"` \| `"MOVIL"` |

Cualquier canal adicional → tabla `CanalComunicacion` (satélite 1:N).
VETO: `SchemaVetoError` si se intenta añadir campo fuera de whitelist.

---

## Taxonomía SALI — Etiquetas del Sistema

Solo el Agente de Datos (rol Admin) puede crear etiquetas raíz.
Los empleados solo pueden asignar etiquetas existentes.

### Categorías implementadas (pendiente Micro-Spec 3.1):
| Categoría | Ejemplos |
|-----------|---------|
| Por Proceso | Facturado, Pendiente, En Cuarentena, URGENTE, Blueprint |
| Por Tipo de Actuación | Demanda, Notificación Judicial, Escritura, Contrato, Modelo Tributario |
| Por Departamento | Mercantil, Procesal, Fiscal, Laboral (LW) |

Estructura de BD pendiente: tabla `tags` + tabla `tag_assignments` (polimórfica con `resource_type`).

---

## Pestaña Estructura — Visor Gráfico (Micro-Spec 2.2 — PENDIENTE)

Relaciones a modelar en tabla pivot:

| Rol | Contexto |
|-----|---------|
| Socio | % de participación |
| Administrador | Solidario / Mancomunado / Consejo + representante persona física |
| Empleado | Asignado a empresa |
| Participada | % de participación inversa |
| Contratista (LW) | Obra asignada |
| Subcontratista (LW) | Obra asignada |
| Coordinador de Seguridad (LW) | Persona asignada a obra |
| Recurso Preventivo (LW) | Persona asignada a obra |

Endpoint para visor gráfico de nodos: pendiente diseño con librería de grafos.

---

## Validaciones de Identidad Fiscal (Implementadas — Micro-Spec 2.1)

| Tipo | Regex | Aplica a |
|------|-------|---------|
| DNI | `[0-9]{8}[A-Z]` | PF |
| NIE | `[XYZ][0-9]{7}[A-Z]` | PF |
| NIF | DNI + NIE + CIF | PF + PJ |
| CIF | `[A-W][0-9]{7}[0-9A-J]` | PJ |
| VAT | `[A-Z]{2}[A-Z0-9]{2,12}` | PF + PJ |
| TIE | `[A-Z][0-9]{7}[A-Z0-9]` | PF |
| PASAPORTE | `[A-Z0-9]{6,20}` | PF |

**Pendiente (Micro-Spec 2.6):** algoritmo dígito de control DNI/NIE + validación VIES API.

---

## Campos Avanzados de Identidad (Micro-Spec 2.1 — EN SCHEMA desde 2026-03-07)

Añadidos a `prisma/schema.prisma` y sincronizados con BD vía `prisma db push`:

| Campo | Tipo | Editable por | Notas |
|-------|------|-------------|-------|
| `cnae` | `String?` | Admin/Gestor | Código Nacional de Actividades Económicas |
| `iae` | `String?` | Admin/Gestor | Epígrafe del IAE |
| `prorrata_pct` | `Int?` (0–100) | **SOLO CTO** | **ZONA VEDADA** — @ARCHITECTURE_RULES Regla 1 |
| `hacienda_status` | `String?` | Admin/Gestor | Estado censal AEAT + fecha |
| `last_accounts_year` | `Int?` | Admin/Gestor | Último año cuentas en Registro |
| `last_books_year` | `Int?` | Admin/Gestor | Último año libros contables |

Pendiente: UI de edición para estos campos (Tab Fiscal en Ficha Ampliada — Micro-Spec 2.4).

---

## Reglas de Migración (BLOQUEANTE)

- Ninguna migración Prisma puede ejecutarse sin aprobación explícita del Arquitecto Jefe
- Cualquier nuevo campo en `Contacto` requiere aprobación de @Data-Architect
- Prohibido crear columnas duplicadas o semánticamente equivalentes
- `@@unique([fiscal_id, fiscal_id_tipo])` y `email_principal @unique` son inamovibles

---

## Limitaciones del Agente de Datos (NO puede hacer)

- NO saltarse el company_id en tablas de transacciones
- NO crear campos de comunicación ad-hoc en Contacto
- NO crear etiquetas SALI sin pasar por el sistema de tags
- NO ejecutar migraciones sin autorización

---

## Certificación de Módulo

```typescript
TaxonomyManager.assertFixedCommField(field)   // VETO si campo no autorizado
TaxonomyManager.assertCanalTipo(tipo)         // VETO si tipo no en whitelist
TaxonomyManager.auditCommFields(payload)      // detecta campos no autorizados
```
