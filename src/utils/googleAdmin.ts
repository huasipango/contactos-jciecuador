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
      maxResults: 500,
      fields: `
        users(
          id,
          primaryEmail,
          name(fullName,givenName,familyName),
          organizations,
          orgUnitPath,
          thumbnailPhotoUrl,
          isMailboxSetup,
          suspended
        )
      `.replace(/\s+/g, '')
    });

    console.log('Raw users response:', JSON.stringify(response.data, null, 2));

    const users = response.data.users
      ?.filter(user => 
        user.isMailboxSetup && 
        !user.suspended &&
        user.orgUnitPath?.startsWith('/Organizaciones Locales/')
      )
      ?.map(user => {
        const fullName = user.name?.fullName || 
                        `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim();

        const orgName = user.orgUnitPath?.split('/').pop() || '';

        return {
          id: user.id || '',
          fullName,
          organizationalUnit: orgName,
          email: user.primaryEmail || '',
          photoUrl: user.thumbnailPhotoUrl || ''
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    console.log('Processed users:', JSON.stringify(users, null, 2));
    console.log('Total users:', users?.length || 0);
    return users || [];

  } catch (error) {
    console.error('Error fetching users:', error);
    if (error.response?.data?.error) {
      console.error('API Error Details:', error.response.data.error);
    }
    return [];
  }
}

export async function getOrganizationalUnits(accessToken: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });
  
  try {
    const response = await admin.orgunits.list({
      customerId: 'my_customer',
      type: 'all'
    });

    console.log('Raw Org Units response:', response.data);

    // Encontrar la unidad base "Organizaciones Locales"
    const allUnits = response.data.organizationUnits || [];
    const baseUnit = allUnits.find(unit => 
      unit.name === 'Organizaciones Locales'
    );

    if (!baseUnit) {
      console.log('No se encontró la unidad base "Organizaciones Locales"');
      return [];
    }

    console.log('Found base unit:', baseUnit);

    // Filtrar las unidades que son hijas directas de "Organizaciones Locales"
    const localOrgs = allUnits
      .filter(unit => unit.parentOrgUnitPath === baseUnit.orgUnitPath)
      .map(unit => {
        console.log('Processing org unit:', unit);
        return {
          name: unit.name || '',
          path: unit.orgUnitPath || '',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log('Final processed org units:', localOrgs);
    return localOrgs;

  } catch (error) {
    console.error('Error fetching organizational units:', error);
    if (error.response?.data?.error) {
      console.error('API Error Details:', error.response.data.error);
    }
    return [];
  }
} 