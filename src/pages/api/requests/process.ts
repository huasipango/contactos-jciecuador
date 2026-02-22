import type { APIRoute } from 'astro';
import { getSessionUser, requireRole } from '../../../utils/auth';
import { processPendingBatch } from '../../../utils/requestWorkflow';

export const POST: APIRoute = async (context) => {
  const user = await getSessionUser(context);
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  if (!requireRole(user.role, ['administrador'])) {
    return new Response(JSON.stringify({ error: 'Solo administradores pueden procesar lotes' }), { status: 403 });
  }

  const body = await context.request.json().catch(() => ({}));
  const dryRun = Boolean(body?.dryRun);
  const result = await processPendingBatch(user.accessToken, user.email, dryRun);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
