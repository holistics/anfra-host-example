# anfra host example

A host for [anfra](https://github.com/holistics/anfra) Data Apps that you run yourself, in place of the appserve pages `anfra serve` has built in. It is a reference for putting Data Apps in a page of your own: everything it needs from anfra is the published [`@holistics/anfra-sdk`](https://www.npmjs.com/package/@holistics/anfra-sdk) and the core HTTP API.

- A sidebar lists the repo's Data Apps; each opens at `/apps/<path>`.
- The stage runs the open Data App in a sandboxed frame. Its queries come back to the page over the SDK's bridge and are answered by anfra through this host's server. So are its exports: a Data App's `query.export()` downloads a query's whole result as a CSV.
- A toolbar reloads the app, and opens the inspect panel:
  - Structure: the app's parts as its markup declares them, as a tree. Hover a node to highlight it on the page, click to scroll to it, copy its handle (`[Revenue](data-anfra-block="revenue")`) to point an agent at it. Pick mode goes from the page to the tree.
  - Data: every app's queries (state, rows, executed AQL and SQL), controls and selection.
- Light or dark follows the system until you pick one with the toggle next to the title.
- In development, the open app reloads when its file or the AML changes.

Tested with anfra 0.7.1 and `@holistics/anfra-sdk` 0.7.1. Bump them together: the SDK is released with anfra.

## How it fits together

```
browser                          this host (Node, Hono)                 anfra serve --no-apps
┌──────────────────────┐        ┌────────────────────────────┐         ┌────────────────────┐
│ page (React)         │ /api   │ allowlist, rate limit,     │ /api    │ core API           │
│  └ frame: Data App ──┼─bridge─┤ "your auth goes here"  ────┼────────▶│ (no auth: private) │
│                      │ /host  │ apps/ read from ANFRA_REPO │         └────────────────────┘
└──────────────────────┘        └────────────────────────────┘
```

- **anfra** answers the core API only. Run with `--no-apps`, it serves no pages, and it must listen where only this server can reach it: `anfra serve` has no authentication.
- **The server** (`server/`) is the one origin the browser talks to:
  - `/api/core.show`, `/api/core.query` and `/api/core.query.export`, passed to anfra, and nothing else of the core API. Queries and exports are rate-limited per client, each with its own limit. The spot to check your own session is marked in `server/anfra.ts`.
  - `/exports/download/<token>/<name>`: an export's file, streamed from anfra. anfra makes its export links at this server's origin (`ANFRA_SITE_URL`, below), so the browser downloads through here, never from anfra directly. A link works for whoever has it until it expires; a host whose readers sign in checks the session here too (marked in `server/anfra.ts`).
  - `/host/apps` (the Data App tree, labelled by each file's `<title>`), `/host/files/<path>` (a definition or a file it refers to, sent sandboxed) and, in development, `/host/events` (live reload). The core API has nothing to list or read app files, so the server reads them from the repo's `apps/` folder itself.
  - `/health`: this host's version and anfra's, or 503 while anfra does not answer.
  - With `MCP=1`, `/mcp`: anfra's MCP endpoint, passed through. See [MCP](#mcp).
  - In production, the built page.
- **The page** (`src/`): every call into the SDK is in [`src/data-app.ts`](src/data-app.ts). That file is the part to copy into a host of your own; the rest is UI.

## Run it

You need Node 22 or newer, pnpm, and anfra.

1. Start anfra on the Data Folder, without its own pages:

   ```sh
   cd path/to/your/data-folder && anfra serve --no-apps
   ```

   Set `ANFRA_SITE_URL` to where the browser reaches this host, so the export links anfra makes point here: `http://localhost:5173` in development. Without it, a link points at anfra's own address, which the browser can't reach.

   Or `pnpm dev:anfra`, which does the same in `ANFRA_REPO`, with `ANFRA_SITE_URL` at `http://localhost:5173` unless you set it. With Docker:

   ```sh
   docker run --rm -p 127.0.0.1:7878:7878 -e ANFRA_SITE_URL=http://localhost:5173 -v "$PWD:/repo" ghcr.io/holistics/anfra:0.7.1 serve --no-apps --addr 0.0.0.0:7878
   ```

2. Start the host:

   ```sh
   pnpm install
   ANFRA_REPO=path/to/your/data-folder pnpm dev
   ```

   Open http://localhost:5173. Vite serves the page with hot reload and passes `/api`, `/host`, `/exports` and `/health` to the server on port 8787.

`.npmrc` points the `@holistics` scope at npmjs, in case your own npm config sends it elsewhere.

### Production

```sh
pnpm build
NODE_ENV=production ANFRA_REPO=… ANFRA_URL=… PORT=5173 HOSTNAME=0.0.0.0 pnpm start
```

Run anfra with `ANFRA_SITE_URL` at this host's public origin (`https://data.example.com`). One process serves the page, the API and the Data Apps. It reads the app tree once at startup and does not watch the repo. Built assets are cached for a year (their names are hashed); definitions for a minute, with an ETag.

## Configuration

| Variable | Default | |
|---|---|---|
| `ANFRA_REPO` | `../demo-data` | The Data Folder anfra serves. Data Apps are its `apps/**/*.html`. |
| `ANFRA_URL` | `http://127.0.0.1:7878` | Where anfra answers. Keep it off the public network. |
| `PORT`, `HOSTNAME` | `8787`, `127.0.0.1` | Where this server listens. |
| `NODE_ENV` | | `production` serves the built page, without live reload. |
| `QUERY_RATE_LIMIT` | `120` | `core.query` requests a minute per client. |
| `EXPORT_RATE_LIMIT` | `10` | `core.query.export` requests a minute per client. Each runs its query to the last row. |
| `MCP` | | `1` passes anfra's MCP endpoint through at `/mcp`. See [MCP](#mcp). |
| `TRUST_PROXY` | | `1` takes the client's address from `X-Forwarded-For`: the last entry, which the one proxy in front of this server appends. |

## MCP

With `MCP=1`, the server passes anfra's MCP endpoint (streamable HTTP) through at `/mcp`, so an agent can connect to `https://<this host>/mcp`. It is a plain passthrough, for demos: unlike `/api`, it has no allowlist, no rate limit and no auth spot. Every op anfra serves as a tool is reachable, except `core.ingest`, which rebuilds the search catalog and is refused here.

- Run anfra without `--no-mcp`: `anfra serve --no-apps` serves `/mcp`.
- `core.query.export` answers with a link to the file, downloaded through this server as a Data App's export is (`/exports/download/*`, served with or without `MCP=1`), so start anfra with `ANFRA_SITE_URL` set to this host's public URL, such as `https://demo.anfra.ai`.

## Checks

```sh
pnpm typecheck
pnpm lint      # Biome; pnpm format to fix
pnpm build
```

## Layout

```
server/
  main.ts      start: config, listen
  app.ts       the routes
  anfra.ts     /api: the allowlist, rate limits, auth spot; export downloads; /health
  mcp.ts       /mcp, passed to anfra (MCP=1)
  catalog.ts   the Data App tree
  files.ts     a file under apps/, confined and sandboxed
  events.ts    live reload: the repo watched, changes debounced
src/
  data-app.ts  every SDK call: datasets, the reader, mounting a Data App
  App.tsx      layout, routing, live reload
  components/  sidebar, stage, inspect panel; ui/ is shadcn/ui
  lib/host.ts  what the page asks the server, apart from the core API
```

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
