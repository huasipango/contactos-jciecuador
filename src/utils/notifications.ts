import { appendAuditEvent } from './requestStore';
import type { WorkspaceRequest } from '../types';

export async function sendRequestSummaryEmail(
  request: WorkspaceRequest,
  actor: string,
  statusMessage: string
) {
  await appendAuditEvent({
    requestId: request.id,
    actor,
    action: 'notify_summary',
    message: `Notificación registrada para ${request.requestorEmail}: ${statusMessage}`
  });
}
