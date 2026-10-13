# anfra host example

A host for [anfra](https://github.com/holistics/anfra) Data Apps that you run yourself, in place of the appserve pages `anfra serve` has built in. It is a reference for putting Data Apps in a page of your own: everything it needs from anfra is the published [`@holistics/anfra-sdk`](https://www.npmjs.com/package/@holistics/anfra-sdk) and the core HTTP API.

- A sidebar lists the repo's Data Apps; each opens at `/apps/<path>`.
- The stage runs the open Data App in a sandboxed frame. Its queries come back to the page over the SDK's bridge and are answered by anfra through this host's server.
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
  - `/api/core.show` and `/api/core.query`, passed to anfra, and nothing else of the core API. Queries are rate-limited per client. The spot to check your own session is marked in `server/anfra.ts`.
  - `/host/apps` (the Data App tree, labelled by each file's `<title>`), `/host/files/<path>` (a definition or a file it refers to, sent sandboxed) and, in development, `/host/events` (live reload). The core API has nothing to list or read app files, so the server reads them from the repo's `apps/` folder itself.
  - `/health`: this host's version and anfra's, or 503 while anfra does not answer.
  - In production, the built page.
- **The page** (`src/`): every call into the SDK is in [`src/data-app.ts`](src/data-app.ts). That file is the part to copy into a host of your own; the rest is UI.

## Run it

You need Node 22 or newer, pnpm, and anfra.

1. Start anfra on the Data Folder, without its own pages:

   ```sh
   cd path/to/your/data-folder && anfra serve --no-apps
   ```

   Or `pnpm dev:anfra`, which does the same in `ANFRA_REPO`. With Docker:

   ```sh
   docker run --rm -p 127.0.0.1:7878:7878 -v "$PWD:/repo" ghcr.io/holistics/anfra:0.7.1 serve --no-apps --addr 0.0.0.0:7878
   ```

2. Start the host:

   ```sh
   pnpm install
   ANFRA_REPO=path/to/your/data-folder pnpm dev
   ```

   Open http://localhost:5173. Vite serves the page with hot reload and passes `/api`, `/host` and `/health` to the server on port 8787.

`.npmrc` points the `@holistics` scope at npmjs, in case your own npm config sends it elsewhere.

### Production

```sh
pnpm build
NODE_ENV=production ANFRA_REPO=… ANFRA_URL=… PORT=5173 HOSTNAME=0.0.0.0 pnpm start
```

One process serves the page, the API and the Data Apps. It reads the app tree once at startup and does not watch the repo. Built assets are cached for a year (their names are hashed); definitions for a minute, with an ETag.

## Configuration

| Variable | Default | |
|---|---|---|
| `ANFRA_REPO` | `../demo-data` | The Data Folder anfra serves. Data Apps are its `apps/**/*.html`. |
| `ANFRA_URL` | `http://127.0.0.1:7878` | Where anfra answers. Keep it off the public network. |
| `PORT`, `HOSTNAME` | `8787`, `127.0.0.1` | Where this server listens. |
| `NODE_ENV` | | `production` serves the built page, without live reload. |
| `QUERY_RATE_LIMIT` | `120` | `core.query` requests a minute per client. |
| `TRUST_PROXY` | | `1` takes the client's address from `X-Forwarded-For`: the last entry, which the one proxy in front of this server appends. |

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
  anfra.ts     /api: the allowlist, rate limit, auth spot; /health
  catalog.ts   the Data App tree
  files.ts     a file under apps/, confined and sandboxed
  events.ts    live reload: the repo watched, changes debounced
src/
  data-app.ts  every SDK call: datasets, the reader, mounting a Data App
  App.tsx      layout, routing, live reload
  components/  sidebar, home, stage; ui/ is shadcn/ui
  inspector/   the inspect panel, self-contained to carry to another host; SPEC.md says how
  lib/host.ts  what the page asks the server, apart from the core API
```

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
