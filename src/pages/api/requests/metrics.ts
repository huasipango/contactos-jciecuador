import type { APIRoute } from 'astro';
import { getSessionUser, requireRole } from '../../../utils/auth';
import { computeRequestMetrics } from '../../../utils/requestWorkflow';

export const GET: APIRoute = async (context) => {
  const user = await getSessionUser(context);
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  if (!requireRole(user.role, ['funcionario_nacional'])) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const metrics = await computeRequestMetrics();
  return new Response(JSON.stringify(metrics), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
