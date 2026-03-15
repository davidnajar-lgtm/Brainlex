# Ecosistema de Relaciones

El ecosistema muestra todas las relaciones de un contacto con otros: vínculos societarios, laborales, familiares, comerciales, etc. Puedes verlo como **lista** o como **grafo visual**.

## Crear una relación

1. En la pestaña **Ecosistema**, haz clic en **Nueva relación**
2. Selecciona el **tipo de relación** (Socio, Administrador, Representante legal, Contrario, etc.)
3. Busca y selecciona el **contacto relacionado**
4. Opcionalmente, añade: cargo, departamento, notas, sede vinculada y porcentaje de participación

> Si el contacto que buscas no existe, puedes crearlo directamente desde el selector con el botón "Crear nuevo contacto".

## Porcentaje de participación

Para relaciones societarias (socio, accionista, participada...), puedes indicar el **porcentaje de participación**. Este porcentaje:

- Aparece como badge azul en la tarjeta de la relación
- Se muestra en las aristas del grafo visual
- Solo está disponible cuando el tipo de relación es societario

## Evidencias probatorias

Cada relación puede tener **documentos adjuntos** que la respaldan (contratos, escrituras, nombramientos...). Para añadir una evidencia:

1. Abre la relación en modo edición (icono del lápiz)
2. Arrastra el archivo a la zona de carga o haz clic para seleccionarlo
3. El archivo se sube automáticamente

El badge con el número de evidencias aparece en la tarjeta de cada relación.

## Archivar y restaurar relaciones

Para archivar una relación que ya no está vigente:

1. Haz clic en el botón de archivo en la tarjeta
2. Introduce un **motivo** (obligatorio) — por ejemplo: "Relación societaria finalizada"
3. Confirma el archivado

Las relaciones archivadas se guardan en la sección **Histórico** al final de la lista. Puedes restaurarlas en cualquier momento.

> **Eliminación permanente**: Dentro del diálogo de archivado hay una opción expandible para eliminar definitivamente. Esta acción es irreversible y elimina la relación, sus evidencias y todo el historial. Requiere confirmación adicional.

## Vista Grafo

El grafo egocéntrico ofrece una visión rápida del ecosistema de relaciones:

- **Nodo central** (naranja): el contacto actual, fijo en el centro
- **Nodos periféricos**: cada contacto relacionado, coloreado por categoría
- **Aristas**: muestran el tipo de relación y el detalle (cargo, porcentaje)
- **Formas**: las personas físicas son círculos, las personas jurídicas son rectángulos

### Colores por categoría

| Color | Categoría |
|-------|-----------|
| Ámbar | Societaria |
| Azul | Laboral |
| Rosa | Familiar |
| Verde | Comercial |
| Violeta | Administrativa |
| Cian | Profesional |

### Interacción

- **Clic en un nodo periférico** → abre la ficha de ese contacto en nueva pestaña
- **Clic en el nodo central** → vuelve a la vista de lista
- **Arrastrar un nodo** → reorganiza la disposición del grafo
- La **leyenda** en la esquina inferior izquierda muestra las categorías presentes

> El grafo se reorganiza automáticamente al abrirlo. Aparece un indicador "Organizando..." mientras se calcula la disposición óptima.
