export interface User {
  id: string;
  fullName: string;
  givenName: string;
  familyName: string;
  organizationalUnit: string;
  organizationalUnitName: string;
  email: string;
  recoveryEmail: string;
  phone: string;
  recoveryPhone: string;
  suspended: boolean;
  archived: boolean;
  lastLoginTime: string | null;
  isInactive90d: boolean;
}

export interface OrganizationalUnit {
  name: string;
  path: string;
  parentPath: string;
}

export type UserRole = 'miembro' | 'presidente_local' | 'funcionario_nacional' | 'administrador';

export interface SessionUser {
  email: string;
  role: UserRole;
  roleLabel: string;
  displayName: string;
  photoUrl: string | null;
  accessToken: string;
}

export const ROLE_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  funcionario_nacional: 'Funcionario Nacional',
  presidente_local: 'Presidente Local',
  miembro: 'Miembro',
  executor: 'Ejecutor',
  approver: 'Aprobador',
  requestor: 'Solicitante',
};

export const ROLE_RANK: Record<string, number> = {
  miembro: 0,
  presidente_local: 1,
  funcionario_nacional: 2,
  administrador: 3,
  requestor: 1,
  approver: 2,
  executor: 3,
};

export type RequestType = 'create_account' | 'update_phone' | 'reset_password' | 'delete_account';
export type RequestStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'error'
  | 'rolled_back';

export interface RequestPayload {
  targetEmail?: string;
  subjectDisplay?: string;
  givenName?: string;
  familyName?: string;
  orgUnitPath?: string;
  phone?: string;
  reason: string;
}

export interface WorkspaceRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  organizationalUnit: string;
  requestorEmail: string;
  requestorRole: string;
  approvedBy?: string;
  rejectedBy?: string;
  executorEmail?: string;
  executionMode: 'automatic' | 'manual_approval';
  batchId?: string;
  dryRun?: boolean;
  payload: RequestPayload;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  executedAt?: string;
}

export interface RequestAuditEvent {
  id: string;
  requestId: string;
  batchId?: string;
  actor: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  message?: string;
  createdAt: string;
}

export interface RequestSummaryMetrics {
  total: number;
  byStatus: Record<RequestStatus, number>;
  byType: Record<RequestType, number>;
  averageResolutionHours: number;
}