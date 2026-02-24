import type { APIRoute } from 'astro';
import { getSessionUser, requireRole } from '../../../utils/auth';
import { listRequests } from '../../../utils/requestStore';

function toCsvCell(value: string) {
  return `"${(value || '').replaceAll('"', '""')}"`;
}

export const GET: APIRoute = async (context) => {
  const user = await getSessionUser(context);
  if (!user) return new Response('No autorizado', { status: 401 });
  if (!requireRole(user.role, ['funcionario_nacional'])) return new Response('No autorizado', { status: 403 });

  const requests = await listRequests();
  const rows = [
    [
      'id',
      'type',
      'status',
      'organizationalUnit',
      'requestorEmail',
      'executionMode',
      'subjectDisplay',
      'targetEmail',
      'phone',
      'createdAt',
      'updatedAt',
      'executedAt',
      'error'
    ].join(',')
  ];

  for (const request of requests) {
    rows.push([
      toCsvCell(request.id),
      toCsvCell(request.type),
      toCsvCell(request.status),
      toCsvCell(request.organizationalUnit),
      toCsvCell(request.requestorEmail),
      toCsvCell(request.executionMode),
      toCsvCell(request.payload.subjectDisplay || ''),
      toCsvCell(request.payload.targetEmail || ''),
      toCsvCell(request.payload.phone || ''),
      toCsvCell(request.createdAt),
      toCsvCell(request.updatedAt),
      toCsvCell(request.executedAt || ''),
      toCsvCell(request.error || '')
    ].join(','));
  }

  return new Response(rows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="workspace-requests.csv"'
    }
  });
};
