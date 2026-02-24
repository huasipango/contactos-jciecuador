import type { APIRoute } from 'astro';
import { getSessionUser, requireRole } from '../../../utils/auth';
import { getRequestById, updateRequestById, appendAuditEvent, deleteRequestById } from '../../../utils/requestStore';
import { approveRequest, rejectRequest, executeRequest } from '../../../utils/requestWorkflow';
import { sendRequestSummaryEmail } from '../../../utils/notifications';

const EDITABLE_STATUSES = new Set(['pending']);

function buildSubjectDisplay(payload: Record<string, any>) {
  const givenName = (payload?.givenName || '').trim();
  const familyName = (payload?.familyName || '').trim();
  const fullName = `${givenName} ${familyName}`.trim();
  const targetEmail = (payload?.targetEmail || '').trim();
  return fullName || targetEmail || 'Sin identificar';
}

export const GET: APIRoute = async (context) => {
  const user = await getSessionUser(context);
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  if (user.role === 'miembro') {
    return new Response(JSON.stringify({ error: 'No autorizado para este módulo' }), { status: 403 });
  }

  const request = await getRequestById(context.params.id || '');
  if (!request) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });

  if (user.role === 'presidente_local' && request.requestorEmail !== user.email) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }
  return new Response(JSON.stringify({ request }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const PATCH: APIRoute = async (context) => {
  const user = await getSessionUser(context);
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  if (user.role === 'miembro') {
    return new Response(JSON.stringify({ error: 'No autorizado para este módulo' }), { status: 403 });
  }

  const id = context.params.id || '';
  const body = await context.request.json().catch(() => null);
  if (!body) return new Response(JSON.stringify({ error: 'Body inválido' }), { status: 400 });

  if (body.action === 'submit') {
    const updated = await updateRequestById(id, (current) => ({
      ...current,
      status: current.status === 'draft' ? 'pending' : current.status,
      updatedAt: new Date().toISOString()
    }));
    if (!updated) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });
    await appendAuditEvent({
      requestId: updated.id,
      actor: user.email,
      action: 'submit_request',
      message: 'Solicitud enviada a revisión'
    });
    return new Response(JSON.stringify({ request: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (body.action === 'edit') {
    const current = await getRequestById(id);
    if (!current) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });

    const isOwnerPresident = user.role === 'presidente_local' && current.requestorEmail === user.email;
    if (!isOwnerPresident) {
      return new Response(JSON.stringify({ error: 'Solo el presidente solicitante puede editar esta solicitud' }), { status: 403 });
    }
    if (!EDITABLE_STATUSES.has(current.status)) {
      return new Response(JSON.stringify({ error: 'Solo se pueden editar solicitudes pendientes' }), { status: 400 });
    }

    const nextPayload = {
      ...current.payload,
      targetEmail: body.payload?.targetEmail ?? current.payload.targetEmail ?? '',
      givenName: body.payload?.givenName ?? current.payload.givenName ?? '',
      familyName: body.payload?.familyName ?? current.payload.familyName ?? '',
      phone: body.payload?.phone ?? current.payload.phone ?? '',
      reason: body.payload?.reason ?? current.payload.reason ?? ''
    };
    nextPayload.subjectDisplay = buildSubjectDisplay(nextPayload);

    const updated = await updateRequestById(id, (req) => ({
      ...req,
      payload: nextPayload,
      updatedAt: new Date().toISOString()
    }));
    if (!updated) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });

    await appendAuditEvent({
      requestId: updated.id,
      actor: user.email,
      action: 'edit_request',
      message: 'Solicitud actualizada por solicitante'
    });
    return new Response(JSON.stringify({ request: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (body.action === 'approve') {
    if (!requireRole(user.role, ['administrador'])) {
      return new Response(JSON.stringify({ error: 'Solo administradores pueden aprobar' }), { status: 403 });
    }
    const approved = await approveRequest(id, user.email);
    if (!approved) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });

    const executed = await executeRequest(approved.id, user.accessToken, user.email, false);
    if (!executed) {
      return new Response(JSON.stringify({ error: 'No se pudo ejecutar la solicitud aprobada' }), { status: 500 });
    }

    if (executed.status === 'error') {
      await sendRequestSummaryEmail(executed, user.email, 'Solicitud aprobada, pero falló al ejecutarse');
      return new Response(JSON.stringify({
        error: executed.error || 'La solicitud se aprobó, pero ocurrió un error al ejecutar la acción',
        request: executed
      }), { status: 500 });
    }

    await sendRequestSummaryEmail(executed, user.email, 'Solicitud aprobada y ejecutada');
    return new Response(JSON.stringify({ request: executed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (body.action === 'reject') {
    if (!requireRole(user.role, ['administrador'])) {
      return new Response(JSON.stringify({ error: 'Solo administradores pueden rechazar' }), { status: 403 });
    }
    const updated = await rejectRequest(id, user.email, body.reason || 'Sin detalle');
    if (!updated) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });
    await sendRequestSummaryEmail(updated, user.email, 'Solicitud rechazada');
    return new Response(JSON.stringify({ request: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Acción no soportada' }), { status: 400 });
};

export const DELETE: APIRoute = async (context) => {
  const user = await getSessionUser(context);
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  if (user.role === 'miembro') {
    return new Response(JSON.stringify({ error: 'No autorizado para este módulo' }), { status: 403 });
  }

  const id = context.params.id || '';
  const current = await getRequestById(id);
  if (!current) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });

  const isOwnerPresident = user.role === 'presidente_local' && current.requestorEmail === user.email;
  if (!isOwnerPresident) {
    return new Response(JSON.stringify({ error: 'Solo el presidente solicitante puede eliminar esta solicitud' }), { status: 403 });
  }
  if (!EDITABLE_STATUSES.has(current.status)) {
    return new Response(JSON.stringify({ error: 'Solo se pueden eliminar solicitudes pendientes' }), { status: 400 });
  }

  await appendAuditEvent({
    requestId: current.id,
    actor: user.email,
    action: 'delete_request',
    message: 'Solicitud eliminada por solicitante'
  });

  const removed = await deleteRequestById(id);
  if (!removed) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });

  return new Response(JSON.stringify({ request: removed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
