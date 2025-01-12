import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const oauth2Client = new OAuth2Client(
  import.meta.env.PUBLIC_GOOGLE_CLIENT_ID,
  import.meta.env.PUBLIC_GOOGLE_CLIENT_SECRET,
  import.meta.env.PUBLIC_GOOGLE_REDIRECT_URI
);

export async function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.group.readonly'
    ],
    prompt: 'consent',
    redirect_uri: import.meta.env.PUBLIC_GOOGLE_REDIRECT_URI
  });
}

export async function getTokenFromCode(code: string) {
  try {
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: import.meta.env.PUBLIC_GOOGLE_REDIRECT_URI
    });
    
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }
    
    oauth2Client.setCredentials(tokens);
    return tokens;
  } catch (error) {
    throw error;
  }
}

export async function getUsers(accessToken: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });
  
  try {
    let allUsers: any[] = [];
    let pageToken: string | undefined;

    do {
      const response = await admin.users.list({
        customer: 'my_customer',
        orderBy: 'familyName',
        viewType: 'domain_public',
        maxResults: 500,
        pageToken,
        fields: 'nextPageToken,users(primaryEmail,name/fullName,name/givenName,name/familyName,orgUnitPath,suspended)'
      });

      if (response.data.users) {
        const activeUsers = response.data.users.filter(user => !user.suspended);
        allUsers = allUsers.concat(activeUsers);
      }
      
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    // Procesar y ordenar usuarios
    return allUsers
      .map(user => ({
        fullName: `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim(),
        organizationalUnit: user.orgUnitPath || '',
        email: user.primaryEmail || '',
        lastName: user.name?.familyName || ''
      }))
      .sort((a, b) => {
        const lastNameCompare = a.lastName.localeCompare(b.lastName);
        if (lastNameCompare !== 0) return lastNameCompare;
        return a.fullName.localeCompare(b.fullName);
      })
      .map(({ lastName, ...user }) => user);

  } catch (error) {
    return [];
  }
}

export async function getOrganizationalUnits(accessToken: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });
  
  try {
    const response = await admin.orgunits.list({
      customerId: 'my_customer',
    });

    return response.data.organizationUnits
      ?.filter(unit => unit.parentOrgUnitPath === '/JCI Ecuador/Organizaciones Locales')
      .map(unit => ({
        name: unit.name || '',
        path: unit.orgUnitPath || '',
      })) || [];
  } catch (error) {
    return [];
  }
}

export async function getUser(accessToken: string, userKey: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });
  
  try {
    const response = await admin.users.get({
      userKey,
      customer: 'my_customer',
      viewType: 'admin_view',
      fields: '*'
    });

    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function getOrganizationUnit(accessToken: string, orgUnitId: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });
  
  try {
    const listResponse = await admin.orgunits.list({
      customerId: 'my_customer',
      type: 'all'
    });

    const orgUnit = listResponse.data.organizationUnits?.find(
      unit => unit.orgUnitId === orgUnitId
    );

    if (!orgUnit?.orgUnitPath) {
      throw new Error(`No se encontró la unidad organizativa con ID: ${orgUnitId}`);
    }

    const response = await admin.orgunits.get({
      customerId: 'my_customer',
      orgUnitPath: orgUnit.orgUnitPath.substring(1),
      fields: '*'
    });

    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function listAllOrganizationUnits(accessToken: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });
  
  try {
    const response = await admin.orgunits.list({
      customerId: 'my_customer',
      type: 'all',  // Para obtener todas las unidades organizativas
      fields: '*'   // Obtener todos los campos disponibles
    });

    return response.data;
  } catch (error) {
    throw error;
  }
} 