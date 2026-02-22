import { google } from 'googleapis';
import type { User as DirectoryUser } from '../types';

const USER_READ_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
const USER_WRITE_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user';
const OU_READ_SCOPE = 'https://www.googleapis.com/auth/admin.directory.orgunit.readonly';
const GROUP_MEMBER_READ_SCOPE = 'https://www.googleapis.com/auth/admin.directory.group.member.readonly';
const USER_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const OPENID_SCOPE = 'openid';

function getGoogleErrorMessage(error: any, context: string): string {
  const status = error?.response?.status;
  const reason = error?.response?.data?.error?.message
    || error?.response?.data?.error_description
    || error?.message
    || 'Error desconocido';
  return `${context} (status ${status || 'n/a'}): ${reason}`;
}

function getEnv(key: keyof ImportMetaEnv): string {
  return import.meta.env[key] ?? '';
}

function getOAuthClient() {
  const clientId = getEnv('GOOGLE_CLIENT_ID') || getEnv('PUBLIC_GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET') || getEnv('PUBLIC_GOOGLE_CLIENT_SECRET');
  const redirectUri = getEnv('GOOGLE_REDIRECT_URI') || getEnv('PUBLIC_GOOGLE_REDIRECT_URI');

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getRedirectUri() {
  return getEnv('GOOGLE_REDIRECT_URI') || getEnv('PUBLIC_GOOGLE_REDIRECT_URI');
}

function hasServiceAccountConfig() {
  return Boolean(
    getEnv('SERVICE_ACCOUNT_CLIENT_EMAIL')
    && getEnv('SERVICE_ACCOUNT_PRIVATE_KEY')
    && getEnv('WORKSPACE_ADMIN_EMAIL')
  );
}

function getServiceAccountClient(scopes: string[]) {
  const clientEmail = getEnv('SERVICE_ACCOUNT_CLIENT_EMAIL');
  const privateKey = getEnv('SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n');
  const delegatedAdmin = getEnv('WORKSPACE_ADMIN_EMAIL');

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes,
    subject: delegatedAdmin
  });
}

function getDirectoryScopes() {
  return [USER_READ_SCOPE, USER_WRITE_SCOPE, OU_READ_SCOPE, GROUP_MEMBER_READ_SCOPE];
}

async function getDirectoryAuthClient(_userAccessToken?: string) {
  if (hasServiceAccountConfig()) {
    const jwt = getServiceAccountClient(getDirectoryScopes());
    await jwt.authorize();
    return jwt;
  }
  throw new Error(
    'Falta configurar credencial de operación de Workspace. Define SERVICE_ACCOUNT_CLIENT_EMAIL, SERVICE_ACCOUNT_PRIVATE_KEY y WORKSPACE_ADMIN_EMAIL.'
  );
}

function sanitizePhoneEcuador(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('593')) return `+${digits}`;
  if (digits.startsWith('0')) return `+593${digits.slice(1)}`;
  if (digits.length === 9) return `+593${digits}`;
  return `+${digits}`;
}

function capitalizeWords(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getMonthNameEs(monthIndex: number): string {
  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ];
  return monthNames[monthIndex] || 'Mes';
}

export function getCurrentTemporaryPassword(date = new Date()): string {
  return `Clave${getMonthNameEs(date.getMonth())}${date.getFullYear()}`;
}

export function generateOauthState(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export async function getAuthUrl(state?: string) {
  const oauth2Client = getOAuthClient();
  const configuredScopes = [OPENID_SCOPE, USER_EMAIL_SCOPE];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: configuredScopes,
    include_granted_scopes: true,
    prompt: 'consent',
    state,
    hd: 'jciecuador.com',
    redirect_uri: getRedirectUri()
  });
}

export async function getTokenFromCode(code: string) {
  const oauth2Client = getOAuthClient();
  try {
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: getRedirectUri()
    });

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }
    return tokens;
  } catch (error) {
    console.error('Error in getTokenFromCode');
    throw error;
  }
}

function mapDirectoryUser(user: any): DirectoryUser {
  const fullName = user.name?.fullName
    || `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim();
  const lastLoginTime = user.lastLoginTime && user.lastLoginTime !== '1970-01-01T00:00:00.000Z'
    ? user.lastLoginTime
    : null;

  return {
    id: user.id || '',
    fullName,
    givenName: user.name?.givenName || '',
    familyName: user.name?.familyName || '',
    organizationalUnit: user.orgUnitPath || '',
    organizationalUnitName: (user.orgUnitPath || '').split('/').filter(Boolean).pop() || '',
    email: user.primaryEmail || '',
    recoveryEmail: user.recoveryEmail || '',
    phone: user.phones?.find((phone: any) => phone.type === 'mobile')?.value || '',
    recoveryPhone: user.recoveryPhone || '',
    suspended: Boolean(user.suspended),
    archived: Boolean(user.archived),
    lastLoginTime,
    isInactive90d: Boolean(lastLoginTime && Date.now() - new Date(lastLoginTime).getTime() > 90 * 24 * 60 * 60 * 1000)
  };
}

export async function getUsers(accessToken: string) {
  const authClient = await getDirectoryAuthClient(accessToken);
  const admin = google.admin({ version: 'directory_v1', auth: authClient });

  try {
    let allUsers: any[] = [];
    let pageToken: string | undefined;

    do {
      const response = await admin.users.list({
        customer: 'my_customer',
        orderBy: 'familyName',
        viewType: 'admin_view',
        maxResults: 500,
        pageToken,
        fields: 'nextPageToken,users(id,primaryEmail,name/fullName,name/givenName,name/familyName,orgUnitPath,suspended,archived,lastLoginTime,recoveryEmail,recoveryPhone,phones)'
      });

      if (response.data.users) {
        allUsers = allUsers.concat(response.data.users);
      }
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return allUsers
      .map(mapDirectoryUser)
      .sort((a, b) => {
        const ouCompare = a.organizationalUnit.localeCompare(b.organizationalUnit);
        if (ouCompare !== 0) return ouCompare;
        return a.fullName.localeCompare(b.fullName);
      });
  } catch (error) {
    const message = getGoogleErrorMessage(error, 'Error al consultar usuarios en Google Admin');
    console.error(message);
    throw new Error(message);
  }
}

export async function getOrganizationalUnits(accessToken: string) {
  const authClient = await getDirectoryAuthClient(accessToken);
  const admin = google.admin({ version: 'directory_v1', auth: authClient });

  try {
    const response = await admin.orgunits.list({
      customerId: 'my_customer'
    });

    return response.data.organizationUnits
      ?.filter((unit) => unit.parentOrgUnitPath?.startsWith('/JCI Ecuador') || unit.orgUnitPath?.startsWith('/JCI Ecuador'))
      .map((unit) => ({
        name: unit.name || '',
        path: unit.orgUnitPath || ''
      })) || [];
  } catch (error) {
    const message = getGoogleErrorMessage(error, 'Error al consultar unidades organizativas');
    console.error(message);
    throw new Error(message);
  }
}

export async function getCurrentUserEmail(accessToken: string): Promise<string | null> {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  try {
    const response = await oauth2.userinfo.get();
    return response.data.email || null;
  } catch {
    try {
      const tokenInfo = await oauth2.tokeninfo({ access_token: accessToken });
      return tokenInfo.data.email || null;
    } catch {
      return null;
    }
  }
}

export async function findUserByEmail(accessToken: string, email: string) {
  const authClient = await getDirectoryAuthClient(accessToken);
  const admin = google.admin({ version: 'directory_v1', auth: authClient });
  const response = await admin.users.get({
    userKey: email,
    projection: 'full'
  });
  return mapDirectoryUser(response.data);
}

export async function createWorkspaceUser(
  accessToken: string,
  input: {
    givenName: string;
    familyName: string;
    orgUnitPath: string;
    primaryEmail: string;
    phone: string;
  }
) {
  const authClient = await getDirectoryAuthClient(accessToken);
  const admin = google.admin({ version: 'directory_v1', auth: authClient });

  const response = await admin.users.insert({
    requestBody: {
      primaryEmail: input.primaryEmail.toLowerCase(),
      name: {
        givenName: capitalizeWords(input.givenName),
        familyName: capitalizeWords(input.familyName)
      },
      orgUnitPath: input.orgUnitPath,
      password: getCurrentTemporaryPassword(),
      changePasswordAtNextLogin: true,
      recoveryPhone: sanitizePhoneEcuador(input.phone),
      phones: input.phone ? [{ type: 'mobile', value: sanitizePhoneEcuador(input.phone), primary: true }] : []
    }
  });
  return mapDirectoryUser(response.data);
}

export async function generateWorkspaceEmailAlias(
  accessToken: string,
  givenName: string,
  familyName: string
) {
  const authClient = await getDirectoryAuthClient(accessToken);
  const admin = google.admin({ version: 'directory_v1', auth: authClient });

  const firstNameToken = givenName.trim().split(/\s+/)[0] || '';
  const firstLastNameToken = familyName.trim().split(/\s+/)[0] || '';
  const base = `${firstNameToken.charAt(0)}${firstLastNameToken}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  if (!base) {
    throw new Error('No se pudo construir el correo con los nombres y apellidos entregados');
  }

  let suffix = 0;
  while (suffix < 200) {
    const localPart = suffix === 0 ? base : `${base}${suffix}`;
    const email = `${localPart}@jciecuador.com`;
    try {
      await admin.users.get({ userKey: email });
      suffix += 1;
    } catch {
      return email;
    }
  }
  throw new Error('No se encontró un alias disponible para la cuenta');
}

export async function updateWorkspaceUserPhone(accessToken: string, email: string, phone: string) {
  const authClient = await getDirectoryAuthClient(accessToken);
  const admin = google.admin({ version: 'directory_v1', auth: authClient });
  const normalizedPhone = sanitizePhoneEcuador(phone);
  const response = await admin.users.patch({
    userKey: email,
    requestBody: {
      recoveryPhone: normalizedPhone,
      phones: [{ type: 'mobile', value: normalizedPhone, primary: true }]
    }
  });
  return mapDirectoryUser(response.data);
}

export async function resetWorkspaceUserPassword(accessToken: string, email: string) {
  const authClient = await getDirectoryAuthClient(accessToken);
  const admin = google.admin({ version: 'directory_v1', auth: authClient });
  const temporaryPassword = getCurrentTemporaryPassword();
  await admin.users.patch({
    userKey: email,
    requestBody: {
      password: temporaryPassword,
      changePasswordAtNextLogin: true
    }
  });
  return { temporaryPassword };
}

export async function deleteWorkspaceUser(accessToken: string, email: string) {
  const authClient = await getDirectoryAuthClient(accessToken);
  const admin = google.admin({ version: 'directory_v1', auth: authClient });
  await admin.users.delete({ userKey: email });
}

export async function isWorkspaceAdmin(email: string): Promise<boolean> {
  const authClient = await getDirectoryAuthClient();
  const admin = google.admin({ version: 'directory_v1', auth: authClient });
  try {
    const response = await admin.users.get({
      userKey: email,
      fields: 'isAdmin',
    });
    return response.data.isAdmin === true;
  } catch {
    return false;
  }
}

export async function checkGroupMembership(email: string, groupEmail: string): Promise<boolean> {
  const authClient = await getDirectoryAuthClient();
  const admin = google.admin({ version: 'directory_v1', auth: authClient });
  try {
    const response = await admin.members.hasMember({
      groupKey: groupEmail,
      memberKey: email,
    });
    return response.data.isMember === true;
  } catch {
    return false;
  }
}

export async function getUserProfile(email: string): Promise<{ displayName: string; photoUrl: string | null }> {
  const authClient = await getDirectoryAuthClient();
  const admin = google.admin({ version: 'directory_v1', auth: authClient });
  try {
    const response = await admin.users.get({
      userKey: email,
      projection: 'basic',
      fields: 'name/fullName,name/givenName,name/familyName,thumbnailPhotoUrl',
    });
    const fullName = response.data.name?.fullName
      || `${response.data.name?.givenName || ''} ${response.data.name?.familyName || ''}`.trim();
    return {
      displayName: fullName || email.split('@')[0],
      photoUrl: response.data.thumbnailPhotoUrl || null,
    };
  } catch {
    return {
      displayName: email.split('@')[0],
      photoUrl: null,
    };
  }
}