import type { APIRoute } from 'astro';
import { getSessionUser } from '../../../utils/auth';
import { createRequest, listRequests, appendAuditEvent } from '../../../utils/requestStore';
import { buildRequestId, resolveExecutionMode } from '../../../utils/requestWorkflow';
import type { RequestType, WorkspaceRequest } from '../../../types';

const VALID_TYPES: RequestType[] = ['create_account', 'update_phone', 'reset_password', 'delete_account'];

export const GET: APIRoute = async (context) => {
  const user = await getSessionUser(context);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }
  if (user.role === 'miembro') {
    return new Response(JSON.stringify({ error: 'No autorizado para este módulo' }), { status: 403 });
  }

  const requests = await listRequests();
  const visible = user.role === 'presidente_local'
    ? requests.filter((item) => item.requestorEmail === user.email)
    : requests;

  return new Response(JSON.stringify({ requests: visible }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async (context) => {
  const user = await getSessionUser(context);
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }
  if (user.role === 'miembro') {
    return new Response(JSON.stringify({ error: 'No autorizado para crear solicitudes' }), { status: 403 });
  }

  const body = await context.request.json().catch(() => null);
  if (!body || !VALID_TYPES.includes(body.type)) {
    return new Response(JSON.stringify({ error: 'Tipo de solicitud inválido' }), { status: 400 });
  }

  const now = new Date().toISOString();
  const executionMode = resolveExecutionMode(body.type);
  const status = executionMode === 'automatic' ? 'pending' : 'draft';

  const request: WorkspaceRequest = {
    id: buildRequestId(),
    type: body.type,
    status,
    organizationalUnit: body.organizationalUnit || body.payload?.orgUnitPath || '',
    requestorEmail: user.email,
    requestorRole: user.role,
    executionMode,
    payload: {
      targetEmail: body.payload?.targetEmail || '',
      givenName: body.payload?.givenName || '',
      familyName: body.payload?.familyName || '',
      orgUnitPath: body.payload?.orgUnitPath || '',
      phone: body.payload?.phone || '',
      reason: body.payload?.reason || 'Sin motivo especificado'
    },
    dryRun: Boolean(body.dryRun),
    createdAt: now,
    updatedAt: now
  };

  const created = await createRequest(request);
  await appendAuditEvent({
    requestId: created.id,
    actor: user.email,
    action: 'create_request',
    message: `Solicitud creada: ${created.type}`
  });

  return new Response(JSON.stringify({ request: created }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
};
