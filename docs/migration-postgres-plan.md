# Plan de migración: persistencia JSON → PostgreSQL (Neon)

## Resumen ejecutivo

- **Objetivo:** Migrar los datos operativos desde `.data/requests-store.json` (y `execution.lock`) a una base PostgreSQL gestionada, sin tocar OAuth, rutas API ni lógica de Google Admin SDK.
- **Recomendación:** **Neon** como base gestionada: mejor encaje con Netlify serverless (cold starts, conexiones efímeras), capa gratuita suficiente, sin lógica extra (Auth/Realtime) que no se usa.
- **Estrategia:** Adapter en `requestStore` que lee/escribe según feature flag (file vs DB); backfill idempotente desde JSON; lock reemplazado por tabla `execution_locks` con lease y TTL; despliegue con dual-write opcional y cutover controlado.
- **Rutas y contratos:** Se mantienen; solo cambia la implementación detrás de `requestStore.ts`.
- **Checklist:** Semana 1 (esquema + adapter + backfill), Semana 2 (dual-write + validación), salida a prod (cutover, rollback listo).

---

## 1. Recomendación: Neon vs Supabase

| Criterio | Neon | Supabase |
|----------|------|----------|
| **Modelo de conexión** | Serverless driver: conexiones efímeras, sin pooler fijo; ideal para Netlify Functions (cold start, muchas instancias). | Pooler (PgBouncer) + conexiones persistentes; también válido pero más configuración. |
| **Uso real del proyecto** | Solo se necesita PostgreSQL (requests + audit + locks). | Incluye Auth, Realtime, Storage; el proyecto ya tiene OAuth Google — no usaríamos Auth/Realtime. |
| **Complejidad operativa** | Menos piezas: DB + conexión. | Más superficie si se activan servicios que no usamos. |
| **Precio / escala** | Plan free generoso; escalado claro. | Plan free también; escalado bien definido. |
| **Backups / branching** | Backups automáticos; branches para staging. | Backups; proyectos separados para staging. |

**Recomendación final:** **Neon**. Encaja con arquitectura serverless (Netlify), solo usamos “Postgres” y se reduce complejidad y posibles fuentes de error. Supabase sería una opción igualmente válida si el equipo prefiere su consola o ya lo usa en otros proyectos.

---

## 2. Plan de migración por fases

### Fase 0 — Preparación (antes del MVP)
- Crear proyecto en Neon; obtener connection string.
- Definir variables de entorno y secrets en Netlify (ver sección 6).
- Añadir dependencia `@neondatabase/serverless` (o `pg` + pooler) en el repo.

### Fase 1 — MVP (DB como verdad única, sin dual-write)
1. Crear esquema SQL en Neon (tablas, índices, constraints).
2. Implementar adapter de DB en `requestStore.ts` (nuevo módulo, ej. `requestStoreDb.ts`) manteniendo la misma API pública.
3. Script de backfill idempotente: leer `.data/requests-store.json` → insertar en PostgreSQL con validaciones.
4. Conectar la app al adapter de DB mediante variable de entorno (ej. `DATA_STORE=postgres`).
5. Sustituir `execution.lock` por tabla `execution_locks` con lease y TTL.
6. Validar: list/create/update requests, audit, ejecución por lotes, métricas.

### Fase 2 — Producción (opcional: dual-write y cutover)
1. Si se desea seguridad extra: período de dual-write (file + DB) y comparación de resultados.
2. Cutover: `DATA_STORE=postgres` en producción; dejar de escribir en archivo.
3. Mantener rollback: `DATA_STORE=file` permite volver al JSON si es necesario (con backfill inverso o solo para lectura de respaldo).

### Fase 3 — Limpieza
1. Dejar de leer/escribir el archivo; eliminar código del adapter “file” si se unifica todo en DB.
2. Documentar runbook: backups, restore, rotación de credenciales.

---

## 3. Diseño del esquema SQL

### 3.1 Tipos ENUM (alineados con TypeScript)

```sql
-- Tipos alineados con src/types (RequestType, RequestStatus)
CREATE TYPE request_type AS ENUM (
  'create_account', 'update_phone', 'reset_password', 'delete_account'
);

CREATE TYPE request_status AS ENUM (
  'draft', 'pending', 'approved', 'rejected',
  'executing', 'executed', 'error', 'rolled_back'
);

CREATE TYPE execution_mode AS ENUM ('automatic', 'manual_approval');
```

### 3.2 Tabla `workspace_requests`

```sql
CREATE TABLE workspace_requests (
  id                UUID PRIMARY KEY,
  type              request_type NOT NULL,
  status            request_status NOT NULL,
  organizational_unit TEXT NOT NULL DEFAULT '',
  requestor_email   TEXT NOT NULL,
  requestor_role    TEXT NOT NULL,
  approved_by       TEXT,
  rejected_by       TEXT,
  executor_email    TEXT,
  execution_mode    execution_mode NOT NULL,
  batch_id          TEXT,
  dry_run           BOOLEAN DEFAULT FALSE,
  payload           JSONB NOT NULL DEFAULT '{}',
  result            JSONB,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at       TIMESTAMPTZ
);

CREATE INDEX idx_workspace_requests_created_at ON workspace_requests (created_at DESC);
CREATE INDEX idx_workspace_requests_status ON workspace_requests (status);
CREATE INDEX idx_workspace_requests_requestor ON workspace_requests (requestor_email);
CREATE INDEX idx_workspace_requests_batch ON workspace_requests (batch_id) WHERE batch_id IS NOT NULL;
```

- `payload` y `result` en JSONB permiten mantener la misma forma que en memoria (payload.targetEmail, etc.) sin cambiar contratos.

### 3.3 Tabla `request_audit_events`

```sql
CREATE TABLE request_audit_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES workspace_requests (id) ON DELETE CASCADE,
  batch_id   TEXT,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  before     JSONB,
  after      JSONB,
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_request_id ON request_audit_events (request_id);
CREATE INDEX idx_audit_created_at ON request_audit_events (created_at DESC);
CREATE INDEX idx_audit_actor ON request_audit_events (actor);
```

- FK a `workspace_requests` con ON DELETE CASCADE mantiene integridad si en el futuro se borran requests (hoy no hay delete de requests en la app).

### 3.4 Tabla `execution_locks` (sustituto transaccional del archivo `execution.lock`)

Objetivo: un solo “holder” de lock por clave, con lease y TTL para evitar locks huérfanos.

```sql
CREATE TABLE execution_locks (
  lock_key     TEXT PRIMARY KEY,
  holder_id    TEXT NOT NULL,
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);

-- Índice para limpieza de locks expirados (opcional)
CREATE INDEX idx_execution_locks_expires ON execution_locks (expires_at);
```

- **Uso:** Una sola clave, ej. `global_execution`. Adquirir = `INSERT ... ON CONFLICT (lock_key) DO UPDATE SET holder_id=..., expires_at=... WHERE execution_locks.expires_at < NOW()`; si row count = 0, no se obtuvo el lock. Liberar = `DELETE FROM execution_locks WHERE lock_key = $1 AND holder_id = $2`.
- **TTL sugerido:** 300 s (5 min); si el proceso muere, el lock se considera liberado tras ese tiempo.

### 3.5 Trigger para `updated_at` (opcional)

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_requests_updated_at
  BEFORE UPDATE ON workspace_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 4. Estrategia de migración de datos (backfill)

### 4.1 Objetivos
- Importar `requests` y `auditEvents` desde `.data/requests-store.json`.
- Idempotencia: poder re-ejecutar sin duplicar (usar `id` como clave).
- Validaciones de integridad antes y después.

### 4.2 Script de importación (Node/TS, ejecutable con `npx tsx` o en build)

- Leer `requests-store.json`.
- Validar estructura mínima: `Array.isArray(requests)`, `Array.isArray(auditEvents)`; cada request tiene `id`, `type`, `status`, `createdAt`, `updatedAt`, `payload`.
- Para cada request: `INSERT INTO workspace_requests (...) VALUES (...) ON CONFLICT (id) DO NOTHING` (o `DO UPDATE` si se quiere sobrescribir con el JSON).
- Para cada audit event: `INSERT INTO request_audit_events (...) ON CONFLICT (id) DO NOTHING`.
- Contar filas insertadas y comparar con longitudes del JSON (con tolerancia por duplicados en reintentos).

Ejemplo de firma y env:

```bash
# Uso
DATA_STORE=postgres DATABASE_URL="postgresql://..." npx tsx scripts/backfill-requests-to-postgres.ts
```

### 4.3 Validaciones de integridad
- Después del backfill: `SELECT COUNT(*) FROM workspace_requests` vs `requests.length`.
- `SELECT COUNT(*) FROM request_audit_events` vs `auditEvents.length`.
- Para cada `request_id` en `request_audit_events`, existe en `workspace_requests` (query de huérfanos).
- Opcional: checksum o conteo por `status`/`type` comparado con agregaciones en el JSON.

### 4.4 Idempotencia
- Usar `ON CONFLICT (id) DO NOTHING` en inserts (o `DO UPDATE` con criterio explícito).
- No borrar datos en el script; solo insertar/actualizar. El rollback es volver a `DATA_STORE=file` y, si hace falta, restaurar el JSON desde backup.

---

## 5. Despliegue sin downtime

### 5.1 Enfoque recomendado (simple)
- **Sin dual-write:** Un solo store activo controlado por `DATA_STORE` (`file` | `postgres`).
- **Ventana de mantenimiento corta:** Detener escrituras (deploy en horario bajo), ejecutar backfill final, desplegar con `DATA_STORE=postgres`, verificar.
- **Rollback:** Cambiar `DATA_STORE=file` y redeploy; los datos nuevos habrán ido solo a Postgres, por lo que el rollback implica “volver atrás” en datos si se había cortado ya el uso del archivo (por eso el backfill debe estar bien validado antes del cutover).

### 5.2 Opción con dual-write (más seguro, más trabajo)
- Durante un período (ej. 1 semana): toda escritura va a file y a postgres.
- Variable: `DATA_STORE=dual`; el adapter escribe en ambos y lee de `postgres` (o de `file` según otra variable) para comparar.
- Tras validar que coinciden: pasar a `DATA_STORE=postgres` y dejar de escribir en file.

### 5.3 Feature flag
- Una sola variable: `DATA_STORE=file` | `DATA_STORE=postgres` (y opcionalmente `dual`).
- En `requestStore.ts`: elegir implementación según `DATA_STORE`; la API pública (listRequests, getRequestById, createRequest, updateRequestById, appendAuditEvent, listAuditEvents, withExecutionLock) no cambia.

### 5.4 Rollback
- **Inmediato:** `DATA_STORE=file` + redeploy; la app vuelve a leer/escribir el JSON (si el archivo no se ha eliminado y está actualizado).
- Si ya se cortó el file: tener backup reciente del JSON o script que exporte desde Postgres a JSON y lo deje en `.data/` para uso de emergencia.

---

## 6. Cambios mínimos de código por capa

### 6.1 `requestStore.ts` (y nuevo adapter DB)

- **Mantener:** Misma API exportada: `listRequests`, `listAuditEvents`, `getRequestById`, `createRequest`, `updateRequestById`, `appendAuditEvent`, `withExecutionLock`.
- **Cambio:** En el punto de entrada del módulo, según `process.env.DATA_STORE` (o `import.meta.env` si se inyecta en build):
  - `file` → implementación actual (read/write JSON + lock por archivo).
  - `postgres` → nuevo módulo que usa `DATABASE_URL` y devuelve las mismas funciones implementadas con SQL.
- **Nuevo archivo sugerido:** `src/utils/requestStoreDb.ts` (o `requestStore/adapters/postgres.ts`) que implementa cada función usando el cliente Neon/serverless. Ejemplo de mapeo:
  - `listRequests()` → `SELECT * FROM workspace_requests ORDER BY created_at DESC`.
  - `getRequestById(id)` → `SELECT * FROM workspace_requests WHERE id = $1`; mapear row a `WorkspaceRequest` (payload/result como JSON).
  - `createRequest(input)` → `INSERT INTO workspace_requests (...) RETURNING *`.
  - `updateRequestById(id, updater)` → SELECT, llamar `updater(current)`, UPDATE con el resultado.
  - `appendAuditEvent(event)` → INSERT en `request_audit_events` con `id = gen_random_uuid()`, `created_at = NOW()`.
  - `listAuditEvents()` → `SELECT * FROM request_audit_events ORDER BY created_at DESC`.
  - `withExecutionLock(task)` → adquirir lock en `execution_locks` (clave fija), ejecutar `task()`, liberar en `finally`.

### 6.2 API routes

- **Sin cambios de firma ni rutas.** Siguen importando desde `../../../utils/requestStore` (o desde un barrel `requestStore/index.ts` que delega al adapter). Las rutas no conocen si el store es file o postgres.

### 6.3 Variables de entorno y secrets (Netlify)

- **Nuevas (Netlify Environment / Secrets):**
  - `DATA_STORE`: `file` | `postgres` (obligatorio para elegir store).
  - `DATABASE_URL`: connection string de Neon (ej. `postgresql://user:pass@host/db?sslmode=require`). Solo necesario si `DATA_STORE=postgres`.
- **Existentes:** No tocar `GOOGLE_*`, `OAUTH_*`, ni variables usadas por auth/callbacks.

Ejemplo en Netlify UI: Site → Environment variables → Add:
- `DATA_STORE` = `postgres`
- `DATABASE_URL` = (secret, encrypted)

---

## 7. Seguridad y operación

### 7.1 Credenciales
- `DATABASE_URL` solo en Netlify Secrets (no en repo ni en .env commiteado).
- En local, usar `.env` con `DATA_STORE=file` por defecto; para probar DB, `.env.local` con `DATA_STORE=postgres` y `DATABASE_URL`.
- Rotación: cambiar contraseña en Neon y actualizar el secret en Netlify; no requiere cambio de código.

### 7.2 Backups y restore
- Neon: backups automáticos; configurar retention según política (ej. 7 días).
- Restore: desde consola Neon (PITR si está disponible en el plan).
- Opcional: job periódico (cron o Netlify scheduled function) que exporte requests/audit a S3/Blob como respaldo adicional.

### 7.3 Observabilidad
- Logs: en las funciones que usan el store, logear errores de DB (sin loguear `DATABASE_URL`).
- Métricas: tiempo de respuesta de list/get/create/update; fallos de conexión o de lock (ej. contador de “lock already held”).
- Alertas: si `DATA_STORE=postgres` y las llamadas a DB fallan de forma reiterada, alertar para considerar rollback.

### 7.4 Políticas de acceso
- En Neon: un solo usuario con permisos mínimos (SELECT, INSERT, UPDATE, DELETE en las tablas del esquema; no DROP ni superuser). No usar el usuario de mantenimiento para la app en producción.

---

## 8. Plan de pruebas

### 8.1 Unit
- Adapter Postgres: mock del cliente SQL (o DB en memoria tipo sqlite) y tests para cada función: createRequest, getRequestById, updateRequestById, listRequests, appendAuditEvent, listAuditEvents, withExecutionLock (comportamiento cuando el lock está tomado).
- requestWorkflow: ya usa requestStore; con store mockeado, los tests de approve/reject/execute/processPendingBatch/rollbackBatch siguen igual; añadir tests que usen el adapter real contra DB de prueba (integration).

### 8.2 Integration
- Con una base Neon de staging (o local Postgres):
  - Crear request → leer por id → actualizar → listar; comparar con comportamiento del store en archivo.
  - Append audit → listAuditEvents; comprobar orden y contenido.
  - withExecutionLock: dos llamadas concurrentes; una debe fallar con mensaje de “ejecución en curso” (o equivalente).
  - processPendingBatch: crear 2–3 requests en estado aprobado/pendiente, ejecutar batch, comprobar status y audit.

### 8.3 E2E / críticos por rol
- **Miembro:** sin acceso a listado de requests (403).
- **Presidente local:** listado filtrado por requestorEmail; no puede aprobar/rechazar.
- **Administrador:** aprobar, rechazar, ejecutar; ver audit.
- **Funcionario nacional:** listado completo, export CSV, listado de audit.
- Flujo completo: crear solicitud → enviar → aprobar → ejecutar (o batch) → ver estado ejecutado y evento de auditoría.

### 8.4 Concurrencia y locks
- Test: dos procesos intentan `withExecutionLock` a la vez; uno debe completar y el otro recibir error.
- Test: lock con TTL expirado; el siguiente intento debe poder adquirir el lock.

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Pérdida de datos en el cutover | Backfill idempotente y validado; backup del JSON antes de cortar; opción dual-write. |
| Latencia o fallos de Neon en serverless | Usar driver serverless de Neon; timeouts y reintentos acotados; rollback a `DATA_STORE=file` si hay incidente prolongado. |
| Lock huérfano (proceso muere con lock) | TTL en `execution_locks`; job o condición “WHERE expires_at < NOW()” para no bloquear indefinidamente. |
| Diferencias de tipos (enum, fechas) entre JSON y DB | Validación en backfill; tipos ENUM y TIMESTAMPTZ alineados con TypeScript. |
| Credenciales expuestas | DATABASE_URL solo en secrets; no loguear; rotación documentada. |
| Rollback sin datos recientes en file | Export script Postgres → JSON; documentar en runbook. |

---

## 10. Checklist ejecutable para el equipo

### Semana 1
- [ ] Crear proyecto Neon; obtener `DATABASE_URL` y guardarlo en Netlify (secret).
- [ ] Añadir `DATA_STORE` y `DATABASE_URL` a documentación de env vars (ej. README o docs).
- [ ] Ejecutar script SQL de creación de esquema (tablas, índices, enums, trigger) en Neon.
- [ ] Implementar `requestStoreDb.ts` (o adapter postgres) con todas las funciones usadas por la app.
- [ ] Implementar lock en DB (`execution_locks`) y sustituir uso de `execution.lock` en el adapter.
- [ ] En `requestStore.ts`, bifurcar por `DATA_STORE` hacia file o postgres.
- [ ] Escribir script de backfill; ejecutarlo contra copia del JSON actual y validar conteos e integridad.
- [ ] Probar en local con `DATA_STORE=postgres` y `DATABASE_URL` de staging: list, create, update, audit, execute, batch.

### Semana 2
- [ ] (Opcional) Implementar modo dual-write y comparar resultados file vs postgres.
- [ ] Tests unitarios/integration para adapter DB y for withExecutionLock.
- [ ] Ejecutar pruebas E2E/críticas por rol (miembro, presidente_local, administrador, funcionario_nacional).
- [ ] Documentar runbook: rollback, backup/restore, rotación de credenciales.
- [ ] Dejar listo rollback: instrucciones para poner `DATA_STORE=file` y redeploy.

### Salida a producción
- [ ] Backup explícito de `.data/requests-store.json` antes del cutover.
- [ ] Ventana de mantenimiento comunicada (si aplica).
- [ ] Backfill final en producción (o ya con dual-write validado).
- [ ] Desplegar con `DATA_STORE=postgres` en producción.
- [ ] Verificar listado, creación, aprobación y ejecución en prod.
- [ ] Monitorear logs y errores las primeras 24–48 h; tener listo el rollback.

---

*Documento generado como parte del plan de migración de persistencia. Mantener al día con decisiones en `docs/ui/decisions.md` si afectan a datos o despliegue.*
