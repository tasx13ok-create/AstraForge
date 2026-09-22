declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    FORGE_VAULT_KEY?: string;
    FORGE_DEV_AUTH?: string;
    ASTRA_ACCESS_TOKEN?: string;
    ASTRA_SESSION_SECRET?: string;
    ASTRA_OWNER_ID?: string;
    ASTRA_API_ORIGIN?: string;
    ASTRA_FRONTEND_ORIGIN?: string;
  }
}
