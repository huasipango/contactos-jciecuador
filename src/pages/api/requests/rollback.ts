import type { APIRoute } from 'astro';
import { getSessionUser, requireRole } from '../../../utils/auth';
import { rollbackBatch } from '../../../utils/requestWorkflow';

export const POST: APIRoute = async (context) => {
  const user = await getSessionUser(context);
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  if (!requireRole(user.role, ['administrador'])) {
    return new Response(JSON.stringify({ error: 'Solo administradores pueden revertir lotes' }), { status: 403 });
  }

  const body = await context.request.json().catch(() => null);
  if (!body?.batchId) {
    return new Response(JSON.stringify({ error: 'batchId es requerido' }), { status: 400 });
  }

  const result = await rollbackBatch(body.batchId, user.email);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
