/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin when it is not the same origin; the dev proxy covers the default. */
  readonly VITE_API_BASE_URL?: string;
  /** Set to "1" to run the frontend against the localStorage mock instead of the API. */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
