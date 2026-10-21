# The Galaxy Orbit

An anfra Data Folder with one Data App: **The Galaxy Orbit**. Your app portfolio as a living galaxy. Spot the app that needs you, then plan the growth that moves it.

Live demo: https://galaxy-orbit.pages.holistics.dev/

## What is in this folder

| Path | What it is |
|---|---|
| `apps/galaxy-orbit.html` | The Data App: one HTML file that queries the datasets through the anfra SDK |
| `apps/_meta.yaml` | Display name and order in the host |
| `models/`, `models/galaxy_demo/` | AML models |
| `datasets/galaxy_demo.dataset.aml`, `datasets/galaxy_growth.dataset.aml` | The datasets the app queries: app health, campaigns and the growth journey |
| `datasets/publisher.dataset.aml` | The original publisher dataset the demo models are based on |
| `data/galaxy-demo-2026.duckdb`, `data/publisher.duckdb` | The data (DuckDB, opened read-only) |
| `.anfra/data_sources.yml` | Data sources `galaxy_demo` and `publisher`, paths relative to this folder |

## Run it with this host

From the repo root:

```sh
pnpm install
cd galaxy-orbit && anfra serve --no-apps    # core API on 127.0.0.1:7878
# in a second terminal, from the repo root:
ANFRA_REPO=galaxy-orbit pnpm dev
```

Then open the host and pick **The Galaxy Orbit**. `anfra validate` passes in this folder (anfra 0.8.0).

## About the data

All data is synthetic sample data for a made-up mobile app publisher. No real apps, users or revenue. The demo history runs to 20 October 2026, and the app compares each period with the one before it.
