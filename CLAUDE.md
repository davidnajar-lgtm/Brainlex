# Reglas Maestras de Desarrollo — BRAINLEX & LAWORK

## 0. PROTOCOLO DE SESIÓN (Obligatorio antes de cada respuesta)

**PASO 1 — VERIFICACIÓN DE COHERENCIA:**
Antes de proponer o escribir cualquier código, Claude DEBE verificar que
su lógica es coherente con las Fuentes de Verdad (ver Sección 1).
Si hay conflicto entre lo solicitado y cualquier SSD o Micro-Spec, **PARAR**
e informar al **Arquitecto Jefe** antes de proceder:

> "ALERTA ARQUITECTO JEFE: Lo solicitado contradice [sección X de la Fuente
> de Verdad]. La spec indica [descripción]. No puedo proceder sin confirmación
> explícita."

**Esta regla es inamovible.** Cualquier conflicto entre una instrucción
nueva y los SSD/Micro-Specs debe ser reportado al Arquitecto Jefe antes
de proceder. No se admiten excepciones silenciosas.

**PASO 2 — VISTO BUENO DE AGENTE:**
Si la tarea afecta a un agente con poder de VETO, el agente debe dar
su aprobación antes de ejecutar. Si el agente solicitaría algo diferente
a lo indicado en los archivos de especificación, **pedir permiso explícito**:

> "El @[Agente] indica que [regla del CONTEXT.md]. La tarea solicitada
> haría [descripción]. ¿Apruebas esta excepción?"

**PASO 3 — TDD:**
Escribir el test unitario ANTES que la lógica de negocio.
NO test → NO implementation.

---

## 1. Fuentes de Verdad (OBLIGATORIO — leer antes de cada sesión)

> Estos documentos son la autoridad máxima del proyecto.
> Ninguna instrucción conversacional puede contradirlos sin aprobación del Arquitecto Jefe.

### Documentos Fuente Originales (CEO — input estratégico)

| Archivo | Contenido | Ubicación |
|---------|-----------|-----------|
| `micro specs.txt` | Hoja de ruta técnica: 6 fases, 18 micro-specs (1.1 → 6.4) | `docs/Source/` |
| `ssd genérico.txt` | Reglas maestras de desarrollo: agentes, DDD, TDD, protocolo | `docs/Source/` |
| `DOCUMENTO DE ESPECIFICACIONES TÉCNICAS Y FUNCIONALES.txt` | Diccionario de campos, lógica multi-entidad, seguridad | `docs/Source/` |
| `Contexto_Negocio_BrainLex.txt` | Dolores del negocio, 12TB, 14 usuarios, objetivos de escala | `docs/Source/` |

### Documentos de Trabajo Derivados (Consolidados para uso diario)

| Archivo | Propósito | Prioridad |
|---------|-----------|-----------|
| `docs/SSD_MASTER.md` | Spec maestra consolidada: todos los módulos y estado actual | **MÁXIMA** |
| `ARCHITECTURE_RULES.md` | Reglas técnicas inamovibles del stack | Alta |
| `AGENTS.md` | Jerarquía de agentes, VETOs, flujo de certificación | Alta |
| `docs/ROADMAP.md` | Estado por fase y micro-spec | Media |
| `agents/[nombre]/CONTEXT.md` | Reglas específicas por agente | Media |

### Steering Automático (cargado en cada sesión)

| Archivo | Propósito |
|---------|-----------|
| `.claude/steering/product.md` | Pains, diccionario negocio, LX/LW |
| `.claude/steering/tech_and_architecture.md` | Stack, multi-tenancy, APIs |
| `.claude/steering/security_and_legal.md` | VETO LEGAL, cuarentena, AES-256 |

---

## 2. Regla de Conflictos (INAMOVIBLE)

> **"Cualquier conflicto entre una instrucción nueva y los SSD/Micro-Specs
> debe ser reportado al Arquitecto Jefe antes de proceder."**

Ejemplos de conflictos que DEBEN ser reportados:
- Una instrucción pide añadir `company_id` a la tabla `Contacto` (viola Micro-Spec 1.1)
- Una instrucción pide saltarse el AuditLog antes de una mutación (viola REGLA CISO)
- Una instrucción pide cargar Google Maps en el layout global (viola VETO P3)
- Una instrucción pide un borrado físico directo con dependencias (viola Micro-Spec 1.2)
- Una instrucción pide desactivar AES-256 por rendimiento (viola REGLA CISO)

---

## 3. Documentos de Dirección (Steering) — REFERENCIA RÁPIDA

| Archivo | Propósito | Carga |
|---------|-----------|-------|
| `docs/SSD_MASTER.md` | Spec maestra: negocio, módulos, micro-specs, estado | Manual |
| `.claude/steering/product.md` | Pains, diccionario, LX/LW | Automática |
| `.claude/steering/tech_and_architecture.md` | Stack, multi-tenancy, APIs | Automática |
| `.claude/steering/security_and_legal.md` | VETO LEGAL, cuarentena, AES-256 | Automática |
| `ARCHITECTURE_RULES.md` | Reglas técnicas inamovibles | Manual |
| `AGENTS.md` | Jerarquía de agentes, VETOs, protocolo | Manual |

---

## Agentes de Proyecto

En base al SSD_MASTER, definimos los siguientes perfiles de agentes:

- **@Security-CISO**: Responsable de RLS, cifrado de certificados y auditoría inmutable.
- **@Data-Architect**: Responsable del modelo de Entidades único y la lógica multitenant (LX vs LW).
- **@Frontend-UX**: Responsable de la simplicidad de la interfaz usando Shadcn/UI.
- **@Doc-Specialist**: Responsable de la abstracción de metadatos para los 12TB en Drive.

> **Nota:** ninguna línea de código puede ser aprobada si no cumple las reglas de @Security-CISO.

---

## Activación del agente @Doc-Specialist

El perfil de **@Doc-Specialist** queda formalmente activado. Su misión, en colaboración con @Data-Architect, es diseñar e implementar un **sistema de Etiquetado Universal**. Los objetivos clave son:

1. Crear una tabla maestra `tags` que almacene etiquetas globales.
2. Crear una tabla de unión `tag_assignments` capaz de vincular un `tag_id` con cualquier tipo de recurso mediante un campo `resource_type` (p. ej. `entity`, `file`, `task`, `process`).
3. Los Estados de Proceso deben representarse como etiquetas de sistema predefinidas (**Facturado**, **Pendiente**, **Blueprint**).
4. Solo los usuarios con rol **Admin** pueden crear etiquetas raíz; el resto de usuarios puede asignar etiquetas existentes.
5. Las etiquetas deben ser suficientemente genéricas y escalables para servir de base a futuros visores gráficos.

Esta infraestructura de metadatos hará posible:

- Graficar relaciones y flujos mediante nodos/etiquetas.
- Filtrados y búsquedas multiplataforma usando etiquetas compartidas.
- Auditoría y trazabilidad de documentos y entidades.

> 🚀 El sistema de etiquetas será la columna vertebral del motor documental y de futuras integraciones de IA.

---

## Activación del agente @QA-Engineer

Se incorpora un cuarto perfil responsable de garantizar la calidad del software. Missions:

- Configurar **Vitest** y **React Testing Library** en el proyecto.
- Crear el primer **Test de Integridad**: comprobar que el sistema de etiquetas no permite duplicar nombres de etiquetas raíz.
- Verificar que las políticas RLS de Supabase están activas y bloquean cualquier cruce de datos entre organizaciones.
- Añadir pruebas adicionales según sea necesario para futuros módulos e internacionalización.

