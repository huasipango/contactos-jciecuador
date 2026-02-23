import type { APIRoute } from 'astro';
import { getSessionUser, requireRole } from '../../../utils/auth';
import { getRequestById, updateRequestById, appendAuditEvent } from '../../../utils/requestStore';
import { approveRequest, rejectRequest } from '../../../utils/requestWorkflow';
import { sendRequestSummaryEmail } from '../../../utils/notifications';

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

  if (body.action === 'approve') {
    if (!requireRole(user.role, ['administrador'])) {
      return new Response(JSON.stringify({ error: 'Solo administradores pueden aprobar' }), { status: 403 });
    }
    const updated = await approveRequest(id, user.email);
    if (!updated) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });
    await sendRequestSummaryEmail(updated, user.email, 'Solicitud aprobada');
    return new Response(JSON.stringify({ request: updated }), {
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
