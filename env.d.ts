/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly GOOGLE_REDIRECT_URI?: string;
  readonly PUBLIC_GOOGLE_CLIENT_ID: string;
  readonly PUBLIC_GOOGLE_CLIENT_SECRET?: string;
  readonly PUBLIC_GOOGLE_REDIRECT_URI: string;
  readonly APP_BASE_URL?: string;
  readonly ALLOWED_DOMAIN?: string;
  readonly APPROVER_EMAILS?: string;
  readonly EXECUTOR_EMAILS?: string;
  readonly AUTO_EXECUTE_ACTIONS?: string;
  readonly REQUEST_BATCH_SIZE?: string;
  readonly SERVICE_ACCOUNT_CLIENT_EMAIL?: string;
  readonly SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  readonly WORKSPACE_ADMIN_EMAIL?: string;
  readonly DATA_STORE?: 'file' | 'postgres';
  readonly DATABASE_URL?: string;
  readonly EXECUTION_LOCK_KEY?: string;
  readonly EXECUTION_LOCK_TTL_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 