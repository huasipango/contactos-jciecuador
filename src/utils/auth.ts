import type { APIContext, AstroCookies } from 'astro';
import { getCurrentUserEmail } from './googleAdmin';

const ACCESS_TOKEN_COOKIE = 'access_token';
const ALLOWED_DOMAIN = import.meta.env.ALLOWED_DOMAIN || 'jciecuador.com';

function parseEmailList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

const APPROVERS = parseEmailList(import.meta.env.APPROVER_EMAILS);
const EXECUTORS = parseEmailList(import.meta.env.EXECUTOR_EMAILS);

function getTokenFromCookies(cookies: AstroCookies): string | null {
  return cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export function isAllowedDomain(email: string) {
  return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export function getRoleByEmail(email: string): 'requestor' | 'approver' | 'executor' {
  const normalizedEmail = email.toLowerCase();
  if (EXECUTORS.includes(normalizedEmail)) return 'executor';
  if (APPROVERS.includes(normalizedEmail)) return 'approver';
  return 'requestor';
}

export async function getSessionUser(context: APIContext | { cookies: AstroCookies }) {
  const accessToken = getTokenFromCookies(context.cookies);
  if (!accessToken) return null;

  const email = await getCurrentUserEmail(accessToken);
  if (!email || !isAllowedDomain(email)) return null;

  return {
    email: email.toLowerCase(),
    role: getRoleByEmail(email),
    accessToken
  };
}

export function requireRole(
  role: 'requestor' | 'approver' | 'executor',
  required: Array<'requestor' | 'approver' | 'executor'>
) {
  const rank = { requestor: 1, approver: 2, executor: 3 };
  return required.some((allowedRole) => rank[role] >= rank[allowedRole]);
}
