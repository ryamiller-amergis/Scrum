/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POLL_INTERVAL?: string;
  readonly VITE_ADO_ORG?: string;
  readonly VITE_ADO_PROJECT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
