import { randomUUID } from 'node:crypto';
import {
  createWorkspaceUser,
  deleteWorkspaceUser,
  findUserByEmail,
  generateWorkspaceEmailAlias,
  resetWorkspaceUserPassword,
  updateWorkspaceUserPhone
} from './googleAdmin';
import {
  appendAuditEvent,
  getRequestById,
  listRequests,
  updateRequestById,
  withExecutionLock
} from './requestStore';
import type { RequestType, WorkspaceRequest, RequestSummaryMetrics } from '../types';

const AUTO_EXECUTE_ACTIONS = (import.meta.env.AUTO_EXECUTE_ACTIONS || 'update_phone,reset_password')
  .split(',')
  .map((entry) => entry.trim()) as RequestType[];
const REQUEST_BATCH_SIZE = Number(import.meta.env.REQUEST_BATCH_SIZE || 20);

export function resolveExecutionMode(type: RequestType): 'automatic' | 'manual_approval' {
  return AUTO_EXECUTE_ACTIONS.includes(type) ? 'automatic' : 'manual_approval';
}

function nowIso() {
  return new Date().toISOString();
}

function ensureFullNamePolicy(givenName = '', familyName = '') {
  const givenParts = givenName.trim().split(/\s+/).filter(Boolean);
  const familyParts = familyName.trim().split(/\s+/).filter(Boolean);
  if (givenParts.length < 2 || familyParts.length < 2) {
    throw new Error('Se requieren al menos 2 nombres y 2 apellidos');
  }
}

export function buildRequestId() {
  return randomUUID();
}

export async function approveRequest(requestId: string, actor: string) {
  const updated = await updateRequestById(requestId, (current) => ({
    ...current,
    status: 'approved',
    approvedBy: actor,
    updatedAt: nowIso()
  }));

  if (!updated) return null;
  await appendAuditEvent({
    requestId,
    actor,
    action: 'approve',
    message: 'Solicitud aprobada'
  });
  return updated;
}

export async function rejectRequest(requestId: string, actor: string, reason: string) {
  const updated = await updateRequestById(requestId, (current) => ({
    ...current,
    status: 'rejected',
    rejectedBy: actor,
    error: reason,
    updatedAt: nowIso()
  }));
  if (!updated) return null;
  await appendAuditEvent({
    requestId,
    actor,
    action: 'reject',
    message: reason
  });
  return updated;
}

export async function executeRequest(requestId: string, accessToken: string, actor: string, dryRun = false) {
  const request = await getRequestById(requestId);
  if (!request) {
    throw new Error('Solicitud no encontrada');
  }
  if (!['approved', 'pending'].includes(request.status)) {
    throw new Error('Solo se pueden ejecutar solicitudes en estado aprobado o pendiente');
  }
  if (request.executionMode === 'manual_approval' && request.status !== 'approved') {
    throw new Error('Esta solicitud requiere aprobación previa');
  }

  return withExecutionLock(async () => {
    const before = request.payload.targetEmail
      ? await findUserByEmail(accessToken, request.payload.targetEmail).catch(() => null)
      : null;

    await updateRequestById(request.id, (current) => ({
      ...current,
      status: 'executing',
      updatedAt: nowIso(),
      executorEmail: actor,
      dryRun
    }));

    try {
      let result: Record<string, unknown> = {};
      if (dryRun) {
        result = { simulated: true, action: request.type };
      } else {
        if (request.type === 'create_account') {
          ensureFullNamePolicy(request.payload.givenName, request.payload.familyName);
          const generatedEmail = request.payload.targetEmail
            || await generateWorkspaceEmailAlias(
              accessToken,
              request.payload.givenName || '',
              request.payload.familyName || ''
            );
          const created = await createWorkspaceUser(accessToken, {
            givenName: request.payload.givenName || '',
            familyName: request.payload.familyName || '',
            orgUnitPath: request.payload.orgUnitPath || request.organizationalUnit,
            primaryEmail: generatedEmail,
            phone: request.payload.phone || ''
          });
          result = { createdUser: created.email, temporaryPassword: 'Configurada por política mensual' };
        } else if (request.type === 'update_phone') {
          const updated = await updateWorkspaceUserPhone(
            accessToken,
            request.payload.targetEmail || '',
            request.payload.phone || ''
          );
          result = { updatedUser: updated.email, phone: updated.recoveryPhone };
        } else if (request.type === 'reset_password') {
          const reset = await resetWorkspaceUserPassword(accessToken, request.payload.targetEmail || '');
          result = { updatedUser: request.payload.targetEmail, temporaryPassword: reset.temporaryPassword };
        } else if (request.type === 'delete_account') {
          await deleteWorkspaceUser(accessToken, request.payload.targetEmail || '');
          result = { deletedUser: request.payload.targetEmail };
        }
      }

      const updated = await updateRequestById(request.id, (current) => ({
        ...current,
        status: 'executed',
        result,
        error: '',
        batchId: current.batchId || `batch-${Date.now()}`,
        executedAt: nowIso(),
        updatedAt: nowIso()
      }));

      await appendAuditEvent({
        requestId: request.id,
        actor,
        action: dryRun ? 'dry_run_execute' : 'execute',
        batchId: updated?.batchId,
        before: before as Record<string, unknown> | null,
        after: result,
        message: dryRun ? 'Ejecución simulada' : 'Ejecución completada'
      });

      return updated;
    } catch (error: any) {
      const message = error?.message || 'Error desconocido';
      const updated = await updateRequestById(request.id, (current) => ({
        ...current,
        status: 'error',
        error: message,
        updatedAt: nowIso()
      }));
      await appendAuditEvent({
        requestId: request.id,
        actor,
        action: 'execute_error',
        before: before as Record<string, unknown> | null,
        message
      });
      return updated;
    }
  });
}

export async function processPendingBatch(accessToken: string, actor: string, dryRun = false) {
  const all = await listRequests();
  const pending = all
    .filter((request) => request.status === 'pending' || (request.status === 'approved' && request.executionMode === 'manual_approval'))
    .slice(0, REQUEST_BATCH_SIZE);

  const batchId = `batch-${Date.now()}`;
  const executed: WorkspaceRequest[] = [];
  for (const request of pending) {
    if (request.executionMode === 'manual_approval' && request.status !== 'approved') {
      continue;
    }
    await updateRequestById(request.id, (current) => ({ ...current, batchId, updatedAt: nowIso() }));
    const result = await executeRequest(request.id, accessToken, actor, dryRun);
    if (result) executed.push(result);
  }
  return { batchId, total: executed.length, requests: executed };
}

export async function rollbackBatch(batchId: string, actor: string) {
  const requests = (await listRequests()).filter((item) => item.batchId === batchId && item.status === 'executed');
  const rolledBack: WorkspaceRequest[] = [];

  for (const request of requests) {
    const updated = await updateRequestById(request.id, (current) => ({
      ...current,
      status: 'rolled_back',
      updatedAt: nowIso()
    }));
    if (updated) {
      rolledBack.push(updated);
      await appendAuditEvent({
        requestId: request.id,
        actor,
        action: 'rollback_mark',
        batchId,
        message: 'Marcado como rollback. Operación técnica debe validarse manualmente.'
      });
    }
  }
  return { batchId, total: rolledBack.length, requests: rolledBack };
}

export async function computeRequestMetrics(): Promise<RequestSummaryMetrics> {
  const requests = await listRequests();
  const byStatus: RequestSummaryMetrics['byStatus'] = {
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    executing: 0,
    executed: 0,
    error: 0,
    rolled_back: 0
  };
  const byType: RequestSummaryMetrics['byType'] = {
    create_account: 0,
    update_phone: 0,
    reset_password: 0,
    delete_account: 0
  };

  let totalResolutionHours = 0;
  let resolvedItems = 0;

  for (const request of requests) {
    byStatus[request.status] += 1;
    byType[request.type] += 1;
    if (request.executedAt) {
      resolvedItems += 1;
      totalResolutionHours += (new Date(request.executedAt).getTime() - new Date(request.createdAt).getTime()) / 3600000;
    }
  }

  return {
    total: requests.length,
    byStatus,
    byType,
    averageResolutionHours: resolvedItems > 0 ? Number((totalResolutionHours / resolvedItems).toFixed(2)) : 0
  };
}
