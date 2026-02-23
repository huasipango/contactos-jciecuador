import type { RequestAuditEvent, WorkspaceRequest } from '../types';
import * as fileStore from './requestStoreFile';
import * as dbStore from './requestStoreDb';

type RequestStore = {
  listRequests: () => Promise<WorkspaceRequest[]>;
  listAuditEvents: () => Promise<RequestAuditEvent[]>;
  getRequestById: (id: string) => Promise<WorkspaceRequest | null>;
  createRequest: (input: WorkspaceRequest) => Promise<WorkspaceRequest>;
  updateRequestById: (id: string, updater: (current: WorkspaceRequest) => WorkspaceRequest) => Promise<WorkspaceRequest | null>;
  appendAuditEvent: (event: Omit<RequestAuditEvent, 'id' | 'createdAt'>) => Promise<RequestAuditEvent>;
  withExecutionLock: <T>(task: () => Promise<T>) => Promise<T>;
};

function resolveStoreMode() {
  const mode = process.env.DATA_STORE || import.meta.env.DATA_STORE || 'file';
  return mode.toLowerCase();
}

function resolveStore(): RequestStore {
  if (resolveStoreMode() === 'postgres') {
    return dbStore;
  }
  return fileStore;
}

export async function listRequests() {
  return resolveStore().listRequests();
}

export async function listAuditEvents() {
  return resolveStore().listAuditEvents();
}

export async function getRequestById(id: string) {
  return resolveStore().getRequestById(id);
}

export async function createRequest(input: WorkspaceRequest) {
  return resolveStore().createRequest(input);
}

export async function updateRequestById(id: string, updater: (current: WorkspaceRequest) => WorkspaceRequest) {
  return resolveStore().updateRequestById(id, updater);
}

export async function appendAuditEvent(event: Omit<RequestAuditEvent, 'id' | 'createdAt'>) {
  return resolveStore().appendAuditEvent(event);
}

export async function withExecutionLock<T>(task: () => Promise<T>): Promise<T> {
  return resolveStore().withExecutionLock(task);
}
