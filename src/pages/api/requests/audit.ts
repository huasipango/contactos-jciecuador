import type { APIRoute } from 'astro';
import { getSessionUser, requireRole } from '../../../utils/auth';
import { listAuditEvents } from '../../../utils/requestStore';

export const GET: APIRoute = async (context) => {
  const user = await getSessionUser(context);
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  if (!requireRole(user.role, ['approver'])) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const auditEvents = await listAuditEvents();
  return new Response(JSON.stringify({ auditEvents }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
