import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const storeFile = resolve(process.cwd(), '.data', 'requests-store.json');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL es requerido para ejecutar el backfill.');
}

if (!existsSync(storeFile)) {
  throw new Error(`No existe el archivo de entrada: ${storeFile}`);
}

const sql = neon(databaseUrl);
const raw = await readFile(storeFile, 'utf-8');
const parsed = JSON.parse(raw);

const requests = Array.isArray(parsed?.requests) ? parsed.requests : [];
const auditEvents = Array.isArray(parsed?.auditEvents) ? parsed.auditEvents : [];

let insertedRequests = 0;
let insertedAudit = 0;

for (const request of requests) {
  if (!request?.id || !request?.type || !request?.status || !request?.createdAt || !request?.updatedAt || !request?.payload) {
    continue;
  }

  const rows = await sql`
    INSERT INTO workspace_requests (
      id,
      type,
      status,
      organizational_unit,
      requestor_email,
      requestor_role,
      approved_by,
      rejected_by,
      executor_email,
      execution_mode,
      batch_id,
      dry_run,
      payload,
      result,
      error,
      created_at,
      updated_at,
      executed_at
    )
    VALUES (
      ${request.id}::uuid,
      ${request.type}::request_type,
      ${request.status}::request_status,
      ${request.organizationalUnit || ''},
      ${request.requestorEmail || ''},
      ${request.requestorRole || ''},
      ${request.approvedBy || null},
      ${request.rejectedBy || null},
      ${request.executorEmail || null},
      ${request.executionMode || 'manual_approval'}::execution_mode,
      ${request.batchId || null},
      ${Boolean(request.dryRun)},
      ${JSON.stringify(request.payload)}::jsonb,
      ${request.result ? JSON.stringify(request.result) : null}::jsonb,
      ${request.error || null},
      ${request.createdAt}::timestamptz,
      ${request.updatedAt}::timestamptz,
      ${request.executedAt || null}::timestamptz
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  if (rows.length > 0) insertedRequests += 1;
}

for (const event of auditEvents) {
  if (!event?.id || !event?.requestId || !event?.actor || !event?.action || !event?.createdAt) {
    continue;
  }

  const rows = await sql`
    INSERT INTO request_audit_events (
      id,
      request_id,
      batch_id,
      actor,
      action,
      before,
      after,
      message,
      created_at
    )
    VALUES (
      ${event.id}::uuid,
      ${event.requestId}::uuid,
      ${event.batchId || null},
      ${event.actor},
      ${event.action},
      ${event.before ? JSON.stringify(event.before) : null}::jsonb,
      ${event.after ? JSON.stringify(event.after) : null}::jsonb,
      ${event.message || null},
      ${event.createdAt}::timestamptz
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  if (rows.length > 0) insertedAudit += 1;
}

const requestCountRows = await sql`SELECT COUNT(*)::int AS total FROM workspace_requests`;
const auditCountRows = await sql`SELECT COUNT(*)::int AS total FROM request_audit_events`;
const orphanRows = await sql`
  SELECT COUNT(*)::int AS total
  FROM request_audit_events a
  LEFT JOIN workspace_requests r ON r.id = a.request_id
  WHERE r.id IS NULL
`;

console.log('Backfill completado');
console.log(`requests JSON: ${requests.length}`);
console.log(`requests insertadas: ${insertedRequests}`);
console.log(`requests en DB: ${requestCountRows[0]?.total ?? 0}`);
console.log(`audit JSON: ${auditEvents.length}`);
console.log(`audit insertadas: ${insertedAudit}`);
console.log(`audit en DB: ${auditCountRows[0]?.total ?? 0}`);
console.log(`audit huerfanas: ${orphanRows[0]?.total ?? 0}`);
