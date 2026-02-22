import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { RequestAuditEvent, WorkspaceRequest } from '../types';

interface StoreShape {
  requests: WorkspaceRequest[];
  auditEvents: RequestAuditEvent[];
}

const DATA_DIR = resolve(process.cwd(), '.data');
const STORE_FILE = resolve(DATA_DIR, 'requests-store.json');
const LOCK_FILE = resolve(DATA_DIR, 'execution.lock');

const EMPTY_STORE: StoreShape = { requests: [], auditEvents: [] };

async function ensureStore() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(STORE_FILE)) {
    await writeFile(STORE_FILE, JSON.stringify(EMPTY_STORE, null, 2), 'utf-8');
  }
}

async function readStore(): Promise<StoreShape> {
  await ensureStore();
  const raw = await readFile(STORE_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw) as StoreShape;
    return {
      requests: parsed.requests || [],
      auditEvents: parsed.auditEvents || []
    };
  } catch {
    return EMPTY_STORE;
  }
}

async function saveStore(data: StoreShape) {
  await ensureStore();
  await writeFile(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function listRequests() {
  const store = await readStore();
  return store.requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAuditEvents() {
  const store = await readStore();
  return store.auditEvents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRequestById(id: string) {
  const store = await readStore();
  return store.requests.find((request) => request.id === id) || null;
}

export async function createRequest(input: WorkspaceRequest) {
  const store = await readStore();
  store.requests.push(input);
  await saveStore(store);
  return input;
}

export async function updateRequestById(id: string, updater: (current: WorkspaceRequest) => WorkspaceRequest) {
  const store = await readStore();
  const index = store.requests.findIndex((item) => item.id === id);
  if (index === -1) return null;
  store.requests[index] = updater(store.requests[index]);
  await saveStore(store);
  return store.requests[index];
}

export async function appendAuditEvent(event: Omit<RequestAuditEvent, 'id' | 'createdAt'>) {
  const store = await readStore();
  const auditEvent: RequestAuditEvent = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...event
  };
  store.auditEvents.push(auditEvent);
  await saveStore(store);
  return auditEvent;
}

export async function withExecutionLock<T>(task: () => Promise<T>): Promise<T> {
  await ensureStore();
  if (existsSync(LOCK_FILE)) {
    throw new Error('Ya existe una ejecución en curso. Intenta nuevamente en unos segundos.');
  }

  await writeFile(LOCK_FILE, String(Date.now()), 'utf-8');
  try {
    return await task();
  } finally {
    if (existsSync(LOCK_FILE)) {
      await unlink(LOCK_FILE);
    }
  }
}
