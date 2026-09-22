# AstraForge

A private, persistent browser coding workspace with real editing, static previews, model connection adapters, reviewed AI patches, permission-gated remote commands, and an MCP connector path.

**Read [docs/BUILD-STATUS.md](docs/BUILD-STATUS.md) before treating this as the complete production platform.** This release is a usable initial workspace, not every production requirement implemented.

## Stack

React / TypeScript / Vinext, Monaco, xterm.js, Cloudflare Workers, D1, E2B SDK, native provider streaming APIs. Sites manages platform authentication, deployments, and the private audience.

## Run and validate

Use the configured Sites development workflow. Generate migrations after schema changes with `pnpm db:generate` and apply them to the local D1 binding before preview testing. Production deployment applies saved Drizzle migrations.

```sh
pnpm exec tsc --noEmit
node --experimental-strip-types --test tests/core.test.ts
python tests/database_test.py
pnpm build
```

Production runtime requires D1 binding `DB` and secret `FORGE_VAULT_KEY` (base64 encoded random 32 bytes). Rotate with a re-encryption migration; replacing it without migration makes existing connection keys unreadable. Never deploy development auth flags. `.dev.vars` and secrets are ignored by Git.

## Connect services

Settings → AI & connections stores each user's key encrypted. The dropdown uses live cloud catalogs from OpenRouter and Ollama plus discovery for connected providers. Configure a provider's exact model ID, then refresh its available models. A configured key is not marked validated until its service accepts a request. API usage is billed by that service; this build does not have a sponsor inference account.

For commands, configure an E2B template. Use a custom template with `pwsh` for PowerShell. Commands are bounded to 60 seconds and run in a fresh VM with internet denied; outputs are returned, filesystem changes are discarded. Do not use this runner for a long-lived dev server.

Higgsfield requires an official MCP bearer credential supported by your account. Discover the tool list in Plugins; inspect JSON input and approve each call. Outcomes after a network timeout can be unknown, so check provider job history before retrying.

GitHub requires a token limited to intended repositories, with permissions sufficient for Git objects and refs. Export creates a new `astraforge/…` branch and returns a compare URL for a PR.

Browser viewer requires a Browserbase API key and a plan supporting persistent sessions. Approve a ten-minute session, then review navigation and page reads. The Agent panel runs a persisted foreground loop with a bounded step count and asks before file writes, commands, MCP calls or browser actions. Enable each connected tool for the workspace in Plugins. Closing the panel stops scheduling subsequent steps; an already accepted action can finish.

## Core files

- `db/schema.ts`, `drizzle/`: persistent data and migrations.
- `lib/server.ts`: authentication, ownership predicates, credential encryption.
- `lib/providers.ts`: native stream normalization and actual telemetry.
- `lib/models.ts`: requested candidate catalog and extension metadata.
- `app/api/workspace/route.ts`: projects, snapshots, rules, audit and GitHub export.
- `app/api/chat/route.ts`: streaming, partial checkpoints, verified continuation.
- `app/api/terminal/route.ts`: exact grants and remote sandbox execution.
- `app/api/plugins/route.ts`: approved MCP operations.
- `app/api/models/route.ts`: authenticated live model discovery.
- `components/forge/`: visible workbench and genuine action paths.
- `tests/core.test.ts`: path/size boundaries, split streaming, truncation, quotas and reasoning request tests.

All upstream responses, files, plugin descriptions and model output are untrusted. Never turn provider text into privileges. Add new connector hosts through a reviewed broker, not an arbitrary user URL fetch.
