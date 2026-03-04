# Arquitectura y Stack Tecnológico

## 1. Base de Datos (Multi-tenancy Híbrida)
- **Estructura Global:** La tabla de `Sujetos` (Contactos/Clientes) es global para evitar duplicidades entre LX y LW.
- **Separación Lógica:** Usar el campo `Company_ID` en transacciones financieras y expedientes para separar LX y LW.
- **Escalabilidad:** Preparado para añadir "Empresa C" solo añadiendo a la tabla `Sociedades_Holding`.

## 2. Gestión Documental (SSOT)
- **Drive como Backend:** Google Workspace (Drive) es el repositorio físico, pero la navegación ocurre 100% en nuestra WebApp. Prohibida la navegación nativa en Drive.
- **IA Local / OCR:** Los documentos confidenciales se procesan primero mediante un motor OCR/NLP en entorno seguro para extraer CIF/Nombres y sugerir la carpeta (SALI tags) antes de sincronizar a la nube.

## 3. Frontend y UX
- **Trilingüe:** i18n desde la base (ES, EN, FR).
- **Seguridad en Edición:** Sistema inequívoco (banner/borde color) al entrar en "Modo Edición" para evitar borrar o alterar datos por error.
- **Librerías Obligatorias:** `libphonenumber-js` para prefijos. Validaciones Regex estrictas para NIF/CIF/NIE/VAT.

## 4. Integraciones Críticas
- **Holded API:** Sincronización bidireccional (facturas emitidas, estado de cobro, suplidos).
- **Firma Electrónica:** Vía API externa homologada.