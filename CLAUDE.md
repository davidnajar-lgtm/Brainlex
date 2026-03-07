# Agentes de Proyecto

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

