# La Ficha del Contacto

La ficha es el lugar central donde puedes ver y editar toda la información de un contacto. Se compone de un **panel lateral izquierdo** con los datos clave y un **área principal** con pestañas temáticas.

## El Panel Lateral

A la izquierda de la ficha encontrarás un resumen rápido:

- **Nombre completo** o razón social
- **Tipo** (Persona Física o Jurídica)
- **Rol en tu sociedad** (Contacto, Pre-cliente, Cliente o Matriz)
- **Indicador de salud de datos** — un porcentaje que indica qué tan completa está la ficha

### Cambiar el rol

Debajo del badge de rol hay un enlace **"Cambiar rol en [tu sociedad]"**. Al hacer clic se despliega un selector con tres opciones:

- **Matriz**: La empresa es una de las sociedades del grupo
- **Cliente**: Ha contratado servicios
- **Pre-cliente**: Contacto con interés potencial

> Haz clic en el rol activo para **desactivarlo** y volver al estado de "Contacto base".

> El rol es **per-sociedad**: un contacto puede ser Cliente en Lexconomy y solo Contacto en Lawork. Al cambiar de sociedad en el visor, verás el rol correspondiente.

## Pestañas de la Ficha

### Filiación

La pestaña principal con toda la información de identidad y contacto:

**Bloque de Identidad** (con botón de edición):
- Nombre / Razón Social
- Apellidos
- NIF, CIF u otro identificador fiscal
- Tipo de sociedad (para personas jurídicas)

**Canales de Comunicación** (con botón de edición):
- Email principal
- Teléfono móvil y fijo (con prefijo internacional)
- Sitio web
- LinkedIn
- Canal preferido (Email o Móvil)
- Canales adicionales (teléfonos extra, emails secundarios, etc.)

**Direcciones**:
- Dirección fiscal, domicilio social, centro de trabajo, etc.
- Puedes añadir varias y marcar una como principal

**Notas internas**:
- Observaciones libres sobre el contacto

### Operativa

Muestra la actividad del contacto: expedientes vinculados, facturas y otros asuntos en curso.

### Ecosistema

La pestaña de relaciones del contacto. Tiene dos vistas que puedes alternar con el toggle **Lista / Grafo**:

**Vista Lista**:
- Todas las relaciones activas del contacto (socio, administrador, representante, contrario, etc.)
- Cada tarjeta muestra: tipo de relación, nombre del contacto relacionado, cargo, porcentaje de participación (si aplica), sede vinculada y evidencias adjuntas
- Puedes crear, editar, archivar y restaurar relaciones
- Las evidencias probatorias se suben directamente desde la tarjeta de la relación

**Vista Grafo**:
- Visualización gráfica del ecosistema de relaciones del contacto
- El contacto actual aparece como **nodo central** (naranja)
- Cada contacto relacionado aparece como un **nodo periférico** con color según la categoría de relación (societaria, laboral, familiar, comercial, etc.)
- Las personas se representan como **círculos**, las empresas como **rectángulos**
- Las aristas muestran el **tipo de relación** (CEO, Socio, Contrario...) y el detalle (cargo, porcentaje)
- **Haz clic en un nodo periférico** para ir a la ficha de ese contacto en una nueva pestaña
- **Haz clic en el nodo central** para volver a la vista de lista
- Puedes arrastrar los nodos para reorganizar el grafo

**Relaciones archivadas**: al final de la lista hay una sección plegable con el histórico de relaciones archivadas, que puedes restaurar si es necesario.

### Admin

Información administrativa del contacto:

**Ciclo de vida**: Estado actual (Activo, Cuarentena o Eliminado), con opciones de archivar o restaurar según el estado.

**Historial de auditoría**: Registro inmutable de todas las acciones realizadas sobre el contacto — creación, ediciones, archivados, restauraciones. Cada entrada muestra la acción, el módulo afectado, el usuario, la fecha y una descripción legible del cambio.

### Bóveda

El **visor documental** del contacto. Muestra las carpetas de documentos organizadas en dos secciones:

- **Blueprint**: Estructura de carpetas generada automáticamente según la taxonomía (departamento + servicio + año). Es de solo lectura.
- **Manuales**: Carpetas creadas manualmente por el usuario para organizar documentación adicional.

Puedes descargar toda la documentación de un contacto o de una carpeta específica como archivo ZIP.

## Editar la identidad

Haz clic en el icono del **lápiz** junto al título "Identidad" para abrir el modal de edición. Podrás modificar:

- Nombre y apellidos (persona física)
- Razón social y tipo de sociedad (persona jurídica)
- Tipo y número de identificación fiscal
- Notas internas

> Para personas jurídicas, el botón de **búsqueda en Google** dentro del modal te permite encontrar la empresa y autorellenar el nombre y la dirección.

> Si introduces un NIF que ya existe en otro contacto, BrainLex te mostrará un aviso de conflicto.

## Editar los canales de comunicación

Haz clic en el **lápiz** junto a "Canales" para abrir el modal de edición. Incluye:

- Email principal
- Teléfono móvil y fijo (con selector de país y prefijo)
- Web y LinkedIn (se añade `https://` automáticamente si no lo escribes)
- Canal preferido: indica si el contacto prefiere que le contactes por email o por móvil
