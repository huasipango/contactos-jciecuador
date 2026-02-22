import type { APIContext, AstroCookies } from 'astro';
import {
  getCurrentUserEmail,
  isWorkspaceAdmin,
  checkGroupMembership,
  getUserProfile,
} from './googleAdmin';
import type { UserRole, SessionUser } from '../types';
import { ROLE_RANK, ROLE_LABELS } from '../types';

const ACCESS_TOKEN_COOKIE = 'access_token';
const ALLOWED_DOMAIN = import.meta.env.ALLOWED_DOMAIN || 'jciecuador.com';

const GROUP_PRESIDENTES = 'organizaciones.locales@jciecuador.com';
const GROUP_FUNCIONARIOS = 'junta.directiva@jciecuador.com';

const roleCache = new Map<string, { role: UserRole; expiresAt: number }>();
const profileCache = new Map<string, { profile: { displayName: string; photoUrl: string | null }; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getTokenFromCookies(cookies: AstroCookies): string | null {
  return cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export function isAllowedDomain(email: string) {
  return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

async function resolveUserRole(email: string): Promise<UserRole> {
  const cached = roleCache.get(email);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.role;
  }

  const [admin, funcionario, presidente] = await Promise.all([
    isWorkspaceAdmin(email),
    checkGroupMembership(email, GROUP_FUNCIONARIOS),
    checkGroupMembership(email, GROUP_PRESIDENTES),
  ]);

  let role: UserRole = 'miembro';
  if (admin) role = 'administrador';
  else if (funcionario) role = 'funcionario_nacional';
  else if (presidente) role = 'presidente_local';

  roleCache.set(email, { role, expiresAt: Date.now() + CACHE_TTL_MS });
  return role;
}

async function resolveUserProfile(email: string): Promise<{ displayName: string; photoUrl: string | null }> {
  const cached = profileCache.get(email);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.profile;
  }

  const profile = await getUserProfile(email);
  profileCache.set(email, { profile, expiresAt: Date.now() + CACHE_TTL_MS });
  return profile;
}

export async function getSessionUser(
  context: APIContext | { cookies: AstroCookies },
): Promise<SessionUser | null> {
  const accessToken = getTokenFromCookies(context.cookies);
  if (!accessToken) return null;

  const email = await getCurrentUserEmail(accessToken);
  if (!email || !isAllowedDomain(email)) return null;

  const normalizedEmail = email.toLowerCase();

  const [role, profile] = await Promise.all([
    resolveUserRole(normalizedEmail),
    resolveUserProfile(normalizedEmail),
  ]);

  return {
    email: normalizedEmail,
    role,
    roleLabel: ROLE_LABELS[role] || role,
    displayName: profile.displayName,
    photoUrl: profile.photoUrl,
    accessToken,
  };
}

export function requireRole(
  role: string,
  required: string[],
): boolean {
  const userRank = ROLE_RANK[role] ?? -1;
  return required.some((allowedRole) => userRank >= (ROLE_RANK[allowedRole] ?? -1));
}
