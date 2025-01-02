/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GOOGLE_CLIENT_ID: string;
  readonly PUBLIC_GOOGLE_CLIENT_SECRET: string;
  readonly PUBLIC_GOOGLE_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 