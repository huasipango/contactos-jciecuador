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
} 

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
  requestorRole: 'requestor' | 'approver' | 'executor';
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