# Trabajar con varias empresas

BrainLex está diseñado para grupos de empresas que comparten recursos. En un mismo portal puedes gestionar varias sociedades, cada una con sus propios expedientes, facturas y roles de contacto.

## El selector de sociedad

En la barra lateral verás un recuadro con la **sociedad activa**. Al cambiar de sociedad, la aplicación se adapta automáticamente:

- El **color de acento** cambia para que siempre sepas en qué sociedad estás trabajando
- Los **expedientes y facturas** se filtran por la sociedad seleccionada
- Los **roles de los contactos** reflejan su relación con esa sociedad concreta

## Qué datos son compartidos

- **Contactos**: La ficha del contacto (nombre, NIF, teléfono, direcciones) es compartida. No necesitas crear el mismo contacto dos veces.
- **Direcciones y canales**: Son datos globales del contacto, visibles desde cualquier sociedad.
- **Etiquetas SALI**: La taxonomía es global y se puede aplicar desde cualquier sociedad.

## Qué datos son exclusivos

- **Roles**: Un contacto puede ser "Cliente" en una sociedad y "Pre-cliente" en otra. Cada sociedad gestiona sus propios roles.
- **Expedientes**: Cada expediente pertenece a una sociedad concreta.
- **Facturas**: La facturación es siempre de una sociedad específica.
- **Carpetas Blueprint**: La estructura de carpetas documentales se genera por sociedad.

## Ejemplo práctico

Imagina que tienes a "Juan García" como contacto:

- En **Lexconomy**: Juan es **Cliente** porque le llevas asuntos fiscales. Tiene expedientes de IRPF y Sociedades.
- En **Lawork**: Juan es **Pre-cliente** porque ha preguntado por servicios de prevención de riesgos, pero aún no ha contratado.

Ambas sociedades ven la misma ficha de contacto (mismo teléfono, misma dirección), pero cada una tiene su propia relación comercial con él.

> Un contacto marcado como **Matriz** solo puede serlo en una sociedad. Esta restricción evita conflictos de facturación entre sociedades del grupo.
