# AstraForge production deployment

AstraForge is a split-runtime application.

## Runtime ownership

### Vercel

Vercel owns the public workspace UI and frontend routing.

Set this Vercel project environment variable for Production and Preview as appropriate:

- `ASTRA_API_ORIGIN`: the HTTPS origin of the deployed AstraForge Cloudflare Worker.

When this value is present, `next.config.ts` proxies `/api/*` to the Cloudflare Worker. The browser continues to use same-origin `/api/*` URLs.

### Cloudflare Workers

Cloudflare owns the server API, D1 state, encrypted connection secrets, model routing, agent execution, Browserbase control, E2B execution, plugin brokering, and audit state.

Production configuration is generated after `pnpm build` by:

```sh
node scripts/prepare-cloudflare-deploy.mjs
```

The generated file is `dist/server/wrangler.production.json`; it is not committed.

Required GitHub repository variables:

- `ASTRA_WORKER_NAME`
- `ASTRA_API_ORIGIN`
- `ASTRA_FRONTEND_ORIGIN`
- `ASTRA_OWNER_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_D1_DATABASE_NAME`

Required GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `FORGE_VAULT_KEY`
- `ASTRA_ACCESS_TOKEN`
- `ASTRA_SESSION_SECRET`

`FORGE_VAULT_KEY` must remain the same for an existing database unless an explicit re-encryption migration is performed. Replacing it makes previously encrypted provider credentials unreadable.

`ASTRA_ACCESS_TOKEN` is the private workspace login token. It is exchanged for an HttpOnly session cookie and is never stored by the frontend.

`ASTRA_SESSION_SECRET` signs portable AstraForge sessions. Use a separate high-entropy value from the vault key and access token.

`ASTRA_OWNER_ID` is the stable owner identifier used for the private portable login. Do not change it on an existing database unless ownership rows are migrated.

## Authentication modes

AstraForge accepts either:

1. the existing host-provided ChatGPT identity headers, when running on a host that supplies them; or
2. the portable private-session flow exposed by `/api/auth`.

The portable session cookie is signed on Cloudflare and works through the Vercel external rewrite. The raw access token is only submitted to `/api/auth`.

Mutation requests are accepted only from the request's own origin or the configured `ASTRA_FRONTEND_ORIGIN`.

## D1

Create one production D1 database and put its ID and name in the GitHub variables above.

The production workflow applies the committed Drizzle migrations with:

```sh
pnpm exec wrangler d1 migrations apply DB --remote --config dist/server/wrangler.production.json
```

Do not point production at the local placeholder database ID used by the Vite development plugin.

## GitHub Actions

`.github/workflows/integration-qa.yml` is the required verification workflow for pull requests and pushes to `main`.

`.github/workflows/cloudflare-production.yml` deploys the Cloudflare backend after a push to `main` or a manual dispatch. It:

1. validates required configuration;
2. installs dependencies;
3. runs TypeScript, core, and database tests;
4. builds the Worker;
5. generates production Wrangler configuration;
6. applies D1 migrations;
7. uploads Worker secrets together with the deployment;
8. verifies that the unauthenticated `/api/auth` boundary returns HTTP 401.

## Vercel production alias

The Vercel project must have a production domain assigned to the deployment built from `main`. A Vercel `404: NOT_FOUND` at the hostname is an alias/project configuration failure, not an AstraForge application 404.

After the Cloudflare Worker is live:

1. set Vercel `ASTRA_API_ORIGIN` to the Worker origin;
2. redeploy the Vercel `main` deployment;
3. confirm the production hostname points at that deployment;
4. open the hostname in a clean browser;
5. sign in through the AstraForge access gate;
6. verify workspace load, model discovery, streaming chat, agent steps, Browserbase actions, and error recovery.

A green build alone is not production verification.
