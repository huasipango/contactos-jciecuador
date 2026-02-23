# Flujo Neon: `test` -> `production`

## Branches del proyecto

- `production` (productiva): `br-noisy-cell-aixokpt3`
- `test` (pruebas): `br-autumn-darkness-ait5rcaq`

## Variables de entorno

Define estas variables en tu shell local (o en `.env.local` sin commitear):

```bash
export DATA_STORE=postgres
export DATABASE_URL_TEST="postgresql://..."
export DATABASE_URL_PRODUCTION="postgresql://..."
```

Opcionalmente puedes usar `DATABASE_URL_PROD` en lugar de `DATABASE_URL_PRODUCTION`.

## Migraciones versionadas

Las migraciones viven en:

- `scripts/migrations/*.sql`

Cada archivo se aplica una sola vez por branch, usando la tabla:

- `schema_migrations`

## Comandos

- Ver estado de migraciones en ambas branches:
  - `npm run db:status`
- Aplicar migraciones solo en `test`:
  - `npm run db:migrate:test`
- Aplicar migraciones solo en `production`:
  - `npm run db:migrate:production`
- Promover cambios de `test` a `production`:
  - `npm run db:promote`
  - si confirma, aplica pendientes en `production`

## Flujo recomendado

1. Crear nueva migración SQL en `scripts/migrations` (ej: `0002_add_x.sql`).
2. Ejecutar `npm run db:migrate:test`.
3. Validar la app local contra branch `test`.
4. Ejecutar `npm run db:promote` para pasar los cambios a `production`.
5. Verificar en producción (Netlify usa la URL de `production`).
