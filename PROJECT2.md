Necesito que este proyecto se pueda fucionar con otro proyecto de automatización para gestionar cuentas de Google Workspace (JCI Ecuador) desde un Google Sheet que recibe respuestas de un Google Form.

CONTEXTO / PROBLEMA BASE
Actualmente existe un proceso manual recurrente:
1) Presidentes de Organizaciones Locales (OL) llenan un Google Form con solicitudes de gestión de cuentas institucionales (crear, modificar, eliminar) para miembros.
2) Las respuestas llegan a un Google Sheets (“Form Responses 1”).
3) Manualmente (en la consola de Google Admin), se crea/modifica/elimina el usuario y siempre:
   - Se asigna a la Unidad Organizativa (OU) correcta (ej. si se pide portoviejo@jciecuador.com → OU “JCI Portoviejo”).
   - Se exige que cada persona tenga 2 nombres, 2 apellidos y un celular válido de Ecuador.
   - Se registra el teléfono/recoveryPhone para que el código de seguridad llegue al celular.
   - Se aplica capitalización adecuada (primer letra en mayúscula por nombre/apellido).
   - Para nuevas cuentas, se define contraseña temporal mensual: “Clave<Mes><Año>” (Ej.: ClaveFebrero2026) con la opción “cambiar contraseña al primer inicio”.
   - El correo se forma: primera letra del primer nombre + primer apellido; si ya existe, se agrega sufijo numérico incremental (acabrera@, acabrera1@, etc.).
4) Al final se reporta en el Sheet el resultado, y se envía un correo resumen a la OL solicitante con la lista de correos creados/modificados/eliminados y la contraseña temporal (si aplica).
El objetivo es eliminar la operación manual y hacerlo todo desde Apps Script, con auditoría y rollback.

REQUISITO PRINCIPAL
Automatizar la gestión de cuentas Google Workspace conectando el Google Sheet con Admin SDK (Directory API), con:
- Ejecución desde un menú “JCI Workspace” dentro de Sheets.
- Modo “Dry Run” (simulación sin cambios).
- Log/auditoría por lote (BatchId).
- Opción de revertir el último lote (rollback) si se aplicó algo incorrecto.
- Envío automático del correo resumen a los solicitantes.
- Mapeo confiable de OL → OU (jerarquía real en Workspace) para evitar asignaciones erróneas.

SOLUCIÓN IMPLEMENTADA (LO QUE YA SE CONSIGUIÓ)
1) Google Apps Script embebido en el Google Sheet (Form Responses 1).
2) Se habilitó Admin SDK / Directory API (Advanced Google Service: Admin Directory API + Admin SDK en el Cloud Project).
3) Menú en Sheets: “JCI Workspace”
   - Exportar OUs a CONFIG
   - Setup (crear LOG/columnas)
   - Procesar pendientes
   - Simular (Dry Run)
   - Revertir último lote
4) Hoja CONFIG:
   - Se exportan todas las OUs del Workspace (con jerarquía) y se obtiene el orgUnitPath real.
   - Sirve como mapeo de “Organización Local (texto del formulario)” → “orgUnitPath (API)”.
5) Hoja LOG:
   - Se registra cada operación con: fecha, batchId, fila, acción, solicitante, OL, correo afectado, status, beforeJson, afterJson, error.
   - Se usa para auditoría y para revertir el último lote.
6) Columnas automáticas agregadas al final de Form Responses 1:
   - Estado (AUTO), BatchId (AUTO), Error (AUTO), Correo resultado (AUTO), Contraseña temporal (AUTO), UserKey (AUTO).
7) Procesamiento:
   - Solo procesa filas “pendientes”: Estado vacío, PENDIENTE o ERROR.
   - CREATE: genera correo (primera letra + primer apellido + sufijo si hay conflicto), asigna OU, teléfonos, contraseña temporal mensual en español, y obliga cambio al primer login.
   - UPDATE: si no hay correo objetivo en “Correo nuevo”, resuelve el correo por Nombre + OU (listando usuarios de esa OU y comparando fullName); luego actualiza nombre, teléfonos, OU (y puede ampliarse a reset de contraseña si se requiere).
   - DELETE: si no hay correo objetivo en “Correo nuevo”, también resuelve por Nombre + OU; luego elimina.
8) Control de duplicados en CREATE:
   - Si en la fila ya hay un correo en el campo “Correo nuevo” (porque el usuario ya existe), el script no crea nada; marca SKIPPED_EXISTING y lo registra en LOG. (Esto se ajustó para evitar duplicación de cuentas).

REGLAS DE NEGOCIO IMPORTANTES (NO ROMPER)
- Nombre debe tener al menos 2 nombres y 2 apellidos; capitalización apropiada.
- Teléfono Ecuador normalizado a +593… y configurado como recoveryPhone / mobile.
- Contraseña mensual en español: Clave<Mes><Año> (Ej.: ClaveFebrero2026), con “change at next login”.
- OU siempre definida por mapeo CONFIG (no por inferencia).
- Email: primera letra del primer nombre + primer apellido; si ya existe, sufijo incremental.
- El proceso debe generar un correo resumen a la OL solicitante.
- Debe existir “Dry Run” y “Revertir último lote”.

LO QUE NECESITO DE TI (PARA FUSIÓN CON OTRO PROYECTO)
Queremos fusionar este sistema con otro proyecto (similar) y necesitamos:
1) Revisar compatibilidad del modelo de datos:
   - Encabezados del formulario/hoja, estructura LOG/CONFIG y reglas de negocio.
2) Proponer una arquitectura común:
   - Configuración centralizada de columnas, acciones, mapeos de OU, validaciones y plantillas de correo.
3) Asegurar robustez operativa:
   - Manejo de ambigüedad (múltiples usuarios con mismo nombre en una OU),
   - límites de cuota (Admin SDK),
   - bloqueo de concurrencia (LockService),
   - ejecución por lotes.
4) Mantener: menú en Sheets + Dry Run + Log + Rollback + email resumen.

ENTREGABLES ESPERADOS
- Diagnóstico de puntos de acople con el otro proyecto.
- Propuesta de diseño unificado (módulos, configuración, naming, estructura de hojas).
- Lista de cambios concretos para integrar sin perder funcionalidades existentes.
- Recomendaciones de seguridad (no exponer contraseñas en celdas si no es necesario, etc.).