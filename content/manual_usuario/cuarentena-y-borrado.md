# Cuarentena y borrado

BrainLex protege tus datos con un sistema de **borrado seguro en dos fases**. Cuando eliminas un contacto, no desaparece inmediatamente: primero pasa por un período de cuarentena donde puedes recuperarlo si cambias de opinión.

## El proceso de borrado

### Fase 1: Archivado (Cuarentena)

Al archivar un contacto, este pasa al estado de **cuarentena**:

- Desaparece del directorio principal
- Aparece en el **Archivo de Cuarentena** (sección Administración)
- Se puede restaurar en cualquier momento durante el período de cuarentena
- El período por defecto es de **60 meses** (5 años), configurable por sociedad

### Fase 2: Olvido definitivo

Cuando el período de cuarentena expira, el contacto se marca como **OLVIDADO**:

- Se anonimiza la información personal
- No se puede restaurar
- Se mantiene un registro anónimo por motivos legales y de auditoría

## Protección contra borrado accidental

BrainLex analiza automáticamente las dependencias del contacto antes de permitir su eliminación:

- **Tiene expedientes abiertos**: No se puede archivar directamente. Debes cerrar o reasignar los expedientes primero.
- **Tiene facturas vinculadas**: El contacto solo puede ir a cuarentena, nunca borrarse directamente.
- **Tiene documentos en Drive**: Se avisa antes de proceder.

> Si un contacto tiene dependencias críticas, BrainLex te redirige automáticamente a la cuarentena en lugar de permitir un borrado directo.

## El Archivo de Cuarentena

Accede desde la barra lateral: **Administración → Archivo de Cuarentena**.

Aquí verás:
- Lista de todos los contactos en cuarentena
- Fecha en que fueron archivados
- Tiempo restante hasta el olvido definitivo
- Botón para **restaurar** (devolver al estado activo)

## Restaurar un contacto

Para restaurar un contacto archivado:

1. Ve al Archivo de Cuarentena
2. Busca el contacto
3. Haz clic en **Restaurar**

El contacto vuelve al directorio principal con todos sus datos intactos, incluyendo expedientes, facturas y documentos.

## Archivado de relaciones

Las relaciones entre contactos también se pueden archivar de forma independiente:

- Al archivar una relación se pide un **motivo obligatorio**
- Las relaciones archivadas aparecen en la sección **Histórico** de la pestaña Ecosistema
- Se pueden **restaurar** en cualquier momento desde el histórico
- Si una relación tiene **evidencias adjuntas**, se muestra un aviso: al archivar quedan como histórico, al eliminar permanentemente se pierden

> La eliminación permanente de una relación está en una sección expandible separada y requiere una **doble confirmación** para evitar borrados accidentales.
