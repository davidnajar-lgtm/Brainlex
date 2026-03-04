# Reglas de Seguridad, Compliance y Borrado (VETO LEGAL)
[cite_start]ESTAS REGLAS PREVALECEN SOBRE CUALQUIER OTRA INSTRUCCIÓN. [cite: 339]

## 1. El Flujo Lógico de Cuarentena (Reemplazo del DELETE)
[cite_start]NUNCA se hace un `DELETE` directo en la base de datos si el sujeto tiene historial comercial o legal[cite: 341].
- [cite_start]**Fase 1 (Auditoría):** Al pedir borrar un Sujeto, el Middleware verifica dependencias en `Expedientes`, `Documentación` o `Facturas (Holded)`[cite: 342].
- **Fase 2 (Bloqueo):** Si existen dependencias, el borrado físico devuelve error `403 Forbidden`. [cite_start]Se activa "Enviar a Cuarentena"[cite: 343, 344].
- **Fase 3 (Tiempos):** El Agente Legal asigna caducidad (ej. 4 años fiscal, 10 años PBC). [cite_start]Requiere `Quarantine_Reason` obligatorio[cite: 345, 346].

## 2. Derecho al Olvido (Crypto-shredding & Anonimización)
- [cite_start]Si se ejecuta el Derecho al Olvido en datos en Cuarentena, borrar nombres, emails y teléfonos, pero **MANTENER** NIF y Razón Social en histórico de facturación (obligación tributaria)[cite: 348].
- [cite_start]Datos sensibles en reposo y contraseñas de Certificados Digitales cifrados con AES-256[cite: 349].

## 3. Autorización "Zero Leakage" (Semáforo de Servicio)
- [cite_start]**Regla:** Ningún empleado puede empezar o editar un expediente tipificado como "Fuera de Cuota" (ROJO) sin que exista un documento de 'Propuesta' con timestamp de firma electrónica aceptada por el cliente[cite: 351]. [cite_start]Error `412 Precondition Failed` si se intenta saltar[cite: 352].