import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import type { RequestAuditEvent, RequestPayload, RequestType, WorkspaceRequest } from '../types';

type RequestStatus = WorkspaceRequest['status'];
type ExecutionMode = WorkspaceRequest['executionMode'];

interface DbWorkspaceRequestRow {
  id: string;
  type: RequestType;
  status: RequestStatus;
  organizational_unit: string;
  requestor_email: string;
  requestor_role: string;
  approved_by: string | null;
  rejected_by: string | null;
  executor_email: string | null;
  execution_mode: ExecutionMode;
  batch_id: string | null;
  dry_run: boolean | null;
  payload: unknown;
  result: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
  executed_at: string | null;
}

interface DbRequestAuditEventRow {
  id: string;
  request_id: string;
  batch_id: string | null;
  actor: string;
  action: string;
  before: unknown;
  after: unknown;
  message: string | null;
  created_at: string;
}

const DEFAULT_LOCK_KEY = 'global_execution';
const DEFAULT_LOCK_TTL_SECONDS = 300;

function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL || import.meta.env.DATABASE_URL;
  if (!value) {
    throw new Error('Falta DATABASE_URL para usar DATA_STORE=postgres');
  }
  return value;
}

function getSqlClient() {
  return neon(requireDatabaseUrl());
}

function toJsonObject<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function mapRequestRow(row: DbWorkspaceRequestRow): WorkspaceRequest {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    organizationalUnit: row.organizational_unit,
    requestorEmail: row.requestor_email,
    requestorRole: row.requestor_role,
    approvedBy: row.approved_by || undefined,
    rejectedBy: row.rejected_by || undefined,
    executorEmail: row.executor_email || undefined,
    executionMode: row.execution_mode,
    batchId: row.batch_id || undefined,
    dryRun: Boolean(row.dry_run),
    payload: toJsonObject<RequestPayload>(row.payload, { reason: 'Sin motivo especificado' }),
    result: toJsonObject<Record<string, unknown> | undefined>(row.result, undefined),
    error: row.error || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    executedAt: row.executed_at ? new Date(row.executed_at).toISOString() : undefined
  };
}

function mapAuditRow(row: DbRequestAuditEventRow): RequestAuditEvent {
  return {
    id: row.id,
    requestId: row.request_id,
    batchId: row.batch_id || undefined,
    actor: row.actor,
    action: row.action,
    before: toJsonObject<Record<string, unknown> | null | undefined>(row.before, undefined),
    after: toJsonObject<Record<string, unknown> | null | undefined>(row.after, undefined),
    message: row.message || undefined,
    createdAt: new Date(row.created_at).toISOString()
  };
}

export async function listRequests() {
  const sql = getSqlClient();
  const rows = await sql<DbWorkspaceRequestRow[]>`
    SELECT *
    FROM workspace_requests
    ORDER BY created_at DESC
  `;
  return rows.map(mapRequestRow);
}

export async function listAuditEvents() {
  const sql = getSqlClient();
  const rows = await sql<DbRequestAuditEventRow[]>`
    SELECT *
    FROM request_audit_events
    ORDER BY created_at DESC
  `;
  return rows.map(mapAuditRow);
}

export async function getRequestById(id: string) {
  const sql = getSqlClient();
  const rows = await sql<DbWorkspaceRequestRow[]>`
    SELECT *
    FROM workspace_requests
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapRequestRow(rows[0]);
}

export async function createRequest(input: WorkspaceRequest) {
  const sql = getSqlClient();
  const rows = await sql<DbWorkspaceRequestRow[]>`
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
      ${input.id}::uuid,
      ${input.type}::request_type,
      ${input.status}::request_status,
      ${input.organizationalUnit || ''},
      ${input.requestorEmail},
      ${input.requestorRole},
      ${input.approvedBy || null},
      ${input.rejectedBy || null},
      ${input.executorEmail || null},
      ${input.executionMode}::execution_mode,
      ${input.batchId || null},
      ${Boolean(input.dryRun)},
      ${JSON.stringify(input.payload)}::jsonb,
      ${input.result ? JSON.stringify(input.result) : null}::jsonb,
      ${input.error || null},
      ${input.createdAt}::timestamptz,
      ${input.updatedAt}::timestamptz,
      ${input.executedAt || null}::timestamptz
    )
    RETURNING *
  `;
  return mapRequestRow(rows[0]);
}

export async function updateRequestById(id: string, updater: (current: WorkspaceRequest) => WorkspaceRequest) {
  const current = await getRequestById(id);
  if (!current) return null;
  const next = updater(current);

  const sql = getSqlClient();
  const rows = await sql<DbWorkspaceRequestRow[]>`
    UPDATE workspace_requests
    SET
      type = ${next.type}::request_type,
      status = ${next.status}::request_status,
      organizational_unit = ${next.organizationalUnit || ''},
      requestor_email = ${next.requestorEmail},
      requestor_role = ${next.requestorRole},
      approved_by = ${next.approvedBy || null},
      rejected_by = ${next.rejectedBy || null},
      executor_email = ${next.executorEmail || null},
      execution_mode = ${next.executionMode}::execution_mode,
      batch_id = ${next.batchId || null},
      dry_run = ${Boolean(next.dryRun)},
      payload = ${JSON.stringify(next.payload)}::jsonb,
      result = ${next.result ? JSON.stringify(next.result) : null}::jsonb,
      error = ${next.error || null},
      created_at = ${next.createdAt}::timestamptz,
      updated_at = ${next.updatedAt}::timestamptz,
      executed_at = ${next.executedAt || null}::timestamptz
    WHERE id = ${id}::uuid
    RETURNING *
  `;

  if (rows.length === 0) return null;
  return mapRequestRow(rows[0]);
}

export async function deleteRequestById(id: string) {
  const sql = getSqlClient();
  const rows = await sql<DbWorkspaceRequestRow[]>`
    DELETE FROM workspace_requests
    WHERE id = ${id}::uuid
    RETURNING *
  `;
  if (rows.length === 0) return null;
  return mapRequestRow(rows[0]);
}

export async function appendAuditEvent(event: Omit<RequestAuditEvent, 'id' | 'createdAt'>) {
  const sql = getSqlClient();
  const rows = await sql<DbRequestAuditEventRow[]>`
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
      ${randomUUID()}::uuid,
      ${event.requestId}::uuid,
      ${event.batchId || null},
      ${event.actor},
      ${event.action},
      ${event.before ? JSON.stringify(event.before) : null}::jsonb,
      ${event.after ? JSON.stringify(event.after) : null}::jsonb,
      ${event.message || null},
      NOW()
    )
    RETURNING *
  `;
  return mapAuditRow(rows[0]);
}

export async function withExecutionLock<T>(task: () => Promise<T>): Promise<T> {
  const sql = getSqlClient();
  const lockKey = process.env.EXECUTION_LOCK_KEY || import.meta.env.EXECUTION_LOCK_KEY || DEFAULT_LOCK_KEY;
  const ttlValue = Number(process.env.EXECUTION_LOCK_TTL_SECONDS || import.meta.env.EXECUTION_LOCK_TTL_SECONDS || DEFAULT_LOCK_TTL_SECONDS);
  const ttlSeconds = Number.isFinite(ttlValue) && ttlValue > 0 ? ttlValue : DEFAULT_LOCK_TTL_SECONDS;
  const holderId = randomUUID();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const acquisition = await sql<{ lock_key: string }[]>`
    INSERT INTO execution_locks (lock_key, holder_id, expires_at)
    VALUES (${lockKey}, ${holderId}, ${expiresAt}::timestamptz)
    ON CONFLICT (lock_key) DO UPDATE
    SET
      holder_id = EXCLUDED.holder_id,
      acquired_at = NOW(),
      expires_at = EXCLUDED.expires_at
    WHERE execution_locks.expires_at < NOW()
    RETURNING lock_key
  `;

  if (acquisition.length === 0) {
    throw new Error('Ya existe una ejecución en curso. Intenta nuevamente en unos segundos.');
  }

  try {
    return await task();
  } finally {
    await sql`
      DELETE FROM execution_locks
      WHERE lock_key = ${lockKey}
      AND holder_id = ${holderId}
    `;
  }
}
