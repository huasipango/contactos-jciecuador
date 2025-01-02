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
      'https://www.googleapis.com/auth/admin.directory.orgunit.readonly'
    ],
    prompt: 'consent'
  });
}

export async function getTokenFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

export async function getUsers(accessToken: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });
  
  try {
    const response = await admin.users.list({
      customer: 'my_customer',
      orderBy: 'familyName',
      viewType: 'domain_public',
    });

    return response.data.users?.map(user => ({
      fullName: `${user.name?.givenName} ${user.name?.familyName}`,
      organizationalUnit: user.orgUnitPath || '',
      email: user.primaryEmail || '',
    })) || [];
  } catch (error) {
    console.error('Error fetching users:', error);
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
    console.error('Error fetching organizational units:', error);
    return [];
  }
} 