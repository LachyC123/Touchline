/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set when building for the claude.ai Artifact viewer (`npm run build:artifact`). */
  readonly VITE_ARTIFACT?: string;
  readonly VITE_DEV_DEBUG?: string;
  readonly VITE_APP_VERSION?: string;
}
