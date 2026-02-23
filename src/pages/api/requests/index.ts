import type { APIRoute } from 'astro';
import { getSessionUser } from '../../../utils/auth';
import { createRequest, listRequests, appendAuditEvent } from '../../../utils/requestStore';
import { buildRequestId, resolveExecutionMode } from '../../../utils/requestWorkflow';
import type { RequestType, WorkspaceRequest } from '../../../types';
import { findUserByEmail } from '../../../utils/googleAdmin';

const VALID_TYPES: RequestType[] = ['create_account', 'update_phone', 'reset_password', 'delete_account'];

function buildSubjectDisplay(body: any) {
  const givenName = (body?.payload?.givenName || '').trim();
  const familyName = (body?.payload?.familyName || '').trim();
  const fullName = `${givenName} ${familyName}`.trim();
  const targetEmail = (body?.payload?.targetEmail || '').trim();
  return fullName || targetEmail || 'Sin identificar';
}

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
  const status = 'pending';
  const subjectDisplay = buildSubjectDisplay(body);

  let organizationalUnit = body.organizationalUnit || body.payload?.orgUnitPath || '';
  if (user.role === 'presidente_local') {
    try {
      const actorProfile = await findUserByEmail(user.accessToken, user.email);
      organizationalUnit = actorProfile.organizationalUnit;
    } catch {
      return new Response(JSON.stringify({ error: 'No se pudo validar la organización local del solicitante' }), { status: 400 });
    }

    if (!organizationalUnit) {
      return new Response(JSON.stringify({ error: 'No se encontró una organización local asignada para tu usuario' }), { status: 400 });
    }
  }

  const request: WorkspaceRequest = {
    id: buildRequestId(),
    type: body.type,
    status,
    organizationalUnit,
    requestorEmail: user.email,
    requestorRole: user.role,
    executionMode,
    payload: {
      targetEmail: body.payload?.targetEmail || '',
      subjectDisplay,
      givenName: body.payload?.givenName || '',
      familyName: body.payload?.familyName || '',
      orgUnitPath: organizationalUnit,
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
