import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const [, , inputCsvPath] = process.argv;

if (!inputCsvPath) {
  throw new Error('Uso: node scripts/import-google-form-requests.mjs "/ruta/archivo.csv"');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL no esta definido en el entorno.');
}

const ACTION_TO_TYPE = {
  'Crear cuenta': 'create_account',
  'Modificar cuenta': 'update_phone',
  'Eliminar cuenta': 'delete_account'
};

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  out.push(current);
  return out.map((value) => value.trim());
}

function normalizePhone(rawPhone) {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('593')) return `0${digits.slice(3)}`;
  if (digits.startsWith('0')) return digits;
  return `0${digits}`;
}

function toIsoDate(raw) {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 4) {
    return {
      givenName: parts.slice(0, 2).join(' '),
      familyName: parts.slice(2).join(' ')
    };
  }
  if (parts.length === 3) {
    return {
      givenName: parts.slice(0, 2).join(' '),
      familyName: parts[2]
    };
  }
  if (parts.length === 2) {
    return {
      givenName: parts[0],
      familyName: parts[1]
    };
  }
  return {
    givenName: parts[0] || '',
    familyName: ''
  };
}

function deterministicUuid(seed) {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toOrgPath(orgName) {
  const name = (orgName || '').trim();
  if (!name) return '';
  if (name.startsWith('/')) return name;
  return `/Organizaciones Locales/${name}`;
}

const rawCsv = await readFile(inputCsvPath, 'utf-8');
const lines = rawCsv.split(/\r?\n/).filter((line) => line.trim());
if (lines.length <= 1) {
  throw new Error('El CSV no contiene registros.');
}

const header = parseCsvLine(lines[0]);
const rows = lines.slice(1).map((line) => {
  const values = parseCsvLine(line);
  const record = {};
  header.forEach((key, idx) => {
    record[key] = values[idx] || '';
  });
  return record;
});

const sql = neon(databaseUrl);
let inserted = 0;
let skipped = 0;

for (const row of rows) {
  const actionLabel = row['Accion a solicitar:'] || row['Acción a solicitar:'] || '';
  const requestType = ACTION_TO_TYPE[actionLabel];
  if (!requestType) {
    skipped += 1;
    continue;
  }

  const timestamp = row.Timestamp || '';
  const createdAt = toIsoDate(timestamp);
  const email = (row['Email Address'] || '').toLowerCase();
  const orgName = row['Organizacion Local:'] || row['Organización Local:'] || '';
  const fullName = row['Nombre completo del miembro a solicitar correo corporativo:'] || '';
  const rawPhone = row['Telefono celular del miembro:'] || row['Teléfono celular del miembro:'] || '';
  const phone = normalizePhone(rawPhone);
  const { givenName, familyName } = splitName(fullName);
  const orgPath = toOrgPath(orgName);
  const seed = `${timestamp}|${email}|${actionLabel}|${orgName}|${fullName}|${rawPhone}`;
  const id = deterministicUuid(seed);

  const payload = {
    targetEmail: '',
    subjectDisplay: fullName || 'Sin identificar',
    givenName,
    familyName,
    orgUnitPath: orgPath,
    phone,
    reason: 'Importado desde formulario CSV'
  };

  const insertedRows = await sql`
    INSERT INTO workspace_requests (
      id,
      type,
      status,
      organizational_unit,
      requestor_email,
      requestor_role,
      execution_mode,
      dry_run,
      payload,
      created_at,
      updated_at
    ) VALUES (
      ${id}::uuid,
      ${requestType}::request_type,
      ${'pending'}::request_status,
      ${orgPath},
      ${email},
      ${'presidente_local'},
      ${'manual_approval'}::execution_mode,
      ${false},
      ${JSON.stringify(payload)}::jsonb,
      ${createdAt}::timestamptz,
      ${createdAt}::timestamptz
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  if (insertedRows.length === 0) {
    skipped += 1;
    continue;
  }

  inserted += 1;

  await sql`
    INSERT INTO request_audit_events (
      id,
      request_id,
      actor,
      action,
      message,
      created_at
    ) VALUES (
      gen_random_uuid(),
      ${id}::uuid,
      ${email},
      ${'import_request'},
      ${'Solicitud importada desde CSV de Google Forms'},
      ${createdAt}::timestamptz
    )
  `;
}

console.log(`Importacion completada. Insertadas: ${inserted}. Omitidas: ${skipped}. Total CSV: ${rows.length}.`);
